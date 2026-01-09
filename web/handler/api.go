// Package handler 提供 HTTP 请求处理器
package handler

import (
	"archive/zip"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"doc-generator-web/service"
)

// 错误代码
const (
	ErrClientNotFound       = "CLIENT_NOT_FOUND"
	ErrDocTypeNotFound      = "DOC_TYPE_NOT_FOUND"
	ErrBuildFailed          = "BUILD_FAILED"
	ErrFileNotFound         = "FILE_NOT_FOUND"
	ErrInvalidInput         = "INVALID_INPUT"
	ErrClientExists         = "CLIENT_EXISTS"
	ErrDocTypeExists        = "DOC_TYPE_EXISTS"
	ErrConfigNotFound       = "CONFIG_NOT_FOUND"
	ErrPresetConfigReadonly = "PRESET_CONFIG_READONLY"
)

// Response API 响应格式
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Code    string      `json:"code,omitempty"`
}

// GenerateRequest 生成请求（支持多选）
type GenerateRequest struct {
	ClientConfig  string                 `json:"clientConfig"`  // 客户配置目录名
	DocumentTypes []string               `json:"documentTypes"` // 文档类型列表
	ClientName    string                 `json:"clientName"`    // 自定义客户名称（可选）
	Format        string                 `json:"format"`        // 输出格式：word 或 pdf（默认: word）
	Variables     map[string]interface{} `json:"variables"`     // 变量值（可选）
}

// GeneratedFile 生成的文件信息
type GeneratedFile struct {
	FileName    string `json:"fileName"`
	DownloadURL string `json:"downloadUrl"`
}

// APIHandler API 处理器
type APIHandler struct {
	clientSvc     *service.ClientService
	docSvc        *service.DocumentService
	buildSvc      *service.BuildService
	moduleSvc     *service.ModuleService
	templateSvc   *service.TemplateService
	configMgr     *service.ConfigManager
	variableSvc   *service.VariableService
	adminPassword string
}

// NewAPIHandler 创建 API 处理器实例
func NewAPIHandler(clientSvc *service.ClientService, docSvc *service.DocumentService, buildSvc *service.BuildService, moduleSvc *service.ModuleService, templateSvc *service.TemplateService, configMgr *service.ConfigManager, srcDir string, adminPassword string) *APIHandler {
	// 创建变量服务
	variableSvc := service.NewVariableService(srcDir)
	
	return &APIHandler{
		clientSvc:     clientSvc,
		docSvc:        docSvc,
		buildSvc:      buildSvc,
		moduleSvc:     moduleSvc,
		templateSvc:   templateSvc,
		configMgr:     configMgr,
		variableSvc:   variableSvc,
		adminPassword: adminPassword,
	}
}

// RegisterRoutes 注册路由
func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/clients", h.handleClients)
	mux.HandleFunc("/api/clients/", h.handleClientDocs)
	mux.HandleFunc("/api/generate", h.handleGenerate)
	mux.HandleFunc("/api/download/", h.handleDownload)
	mux.HandleFunc("/api/download-zip", h.handleDownloadZip)
	// 新增：自定义配置相关路由
	mux.HandleFunc("/api/modules", h.handleModules)
	mux.HandleFunc("/api/templates", h.handleTemplates)
	mux.HandleFunc("/api/configs", h.handleConfigs)
	mux.HandleFunc("/api/configs/", h.handleConfigDetail)
	// 新增：变量模板相关路由
	mux.HandleFunc("/api/variables", h.handleVariables)
	// 新增：客户锁定相关路由
	mux.HandleFunc("/api/lock/", h.handleClientLock)
}

// handleClients 处理客户列表请求
func (h *APIHandler) handleClients(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}
	h.listClients(w, r)
}

// listClients 获取客户列表
func (h *APIHandler) listClients(w http.ResponseWriter, r *http.Request) {
	clients, err := h.clientSvc.ListClients()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"clients": clients,
	})
}

// handleClientDocs 处理客户文档类型请求
func (h *APIHandler) handleClientDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	// 解析路径: /api/clients/{name}/docs
	path := strings.TrimPrefix(r.URL.Path, "/api/clients/")
	parts := strings.Split(path, "/")
	
	if len(parts) < 2 || parts[1] != "docs" {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求路径", ErrInvalidInput)
		return
	}

	clientName, err := url.PathUnescape(parts[0])
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的客户名称", ErrInvalidInput)
		return
	}

	// 检查客户是否存在
	if !h.clientSvc.ClientExists(clientName) {
		h.errorResponse(w, http.StatusNotFound, "客户不存在", ErrClientNotFound)
		return
	}

	docTypes, err := h.docSvc.ListDocumentTypes(clientName)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"documentTypes": docTypes,
	})
}

// handleGenerate 处理文档生成请求（支持多选）
func (h *APIHandler) handleGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if req.ClientConfig == "" {
		h.errorResponse(w, http.StatusBadRequest, "客户配置不能为空", ErrInvalidInput)
		return
	}

	if len(req.DocumentTypes) == 0 {
		h.errorResponse(w, http.StatusBadRequest, "请至少选择一个文档类型", ErrInvalidInput)
		return
	}

	// 检查客户是否存在
	if !h.clientSvc.ClientExists(req.ClientConfig) {
		h.errorResponse(w, http.StatusNotFound, "客户配置不存在", ErrClientNotFound)
		return
	}

	// 批量生成文档
	var files []GeneratedFile
	var errors []string
	var mu sync.Mutex
	var wg sync.WaitGroup

	// 默认格式为 word
	format := req.Format
	if format == "" {
		format = "word"
	}

	for _, docType := range req.DocumentTypes {
		wg.Add(1)
		go func(dt string) {
			defer wg.Done()

			// 获取变量值：优先使用请求中的变量，否则从配置中读取
			variables := req.Variables
			if len(variables) == 0 {
				// 尝试从配置中读取变量
				if cfg, err := h.configMgr.GetConfig(req.ClientConfig, dt); err == nil && cfg != nil {
					variables = cfg.Variables
				}
			}

			buildReq := service.BuildRequest{
				ClientName:   req.ClientConfig,
				DocumentType: dt,
				CustomName:   req.ClientName,
				Format:       format,
				Variables:    variables,
			}

			result, err := h.buildSvc.Build(buildReq)
			
			mu.Lock()
			defer mu.Unlock()

			if err != nil || !result.Success {
				errMsg := dt + ": "
				if err != nil {
					errMsg += err.Error()
				} else {
					errMsg += result.Error
					// 如果有详细输出，提取关键错误信息
					if result.Output != "" {
						// 提取 Pandoc/LaTeX 错误信息
						detailErr := extractErrorDetail(result.Output)
						if detailErr != "" {
							errMsg += "\n详细信息: " + detailErr
						}
					}
				}
				errors = append(errors, errMsg)
				return
			}

			files = append(files, GeneratedFile{
				FileName:    result.FileName,
				DownloadURL: "/api/download/" + url.PathEscape(result.FileName),
			})
		}(docType)
	}

	wg.Wait()

	if len(files) == 0 {
		h.errorResponse(w, http.StatusInternalServerError, "所有文档生成失败: "+strings.Join(errors, "; "), ErrBuildFailed)
		return
	}

	response := map[string]interface{}{
		"files": files,
	}
	if len(errors) > 0 {
		response["warnings"] = errors
	}

	h.successResponse(w, response)
}

// handleDownload 处理文件下载请求
func (h *APIHandler) handleDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	// 解析文件名
	fileName := strings.TrimPrefix(r.URL.Path, "/api/download/")
	fileName, err := url.PathUnescape(fileName)
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的文件名", ErrInvalidInput)
		return
	}

	if fileName == "" {
		h.errorResponse(w, http.StatusBadRequest, "文件名不能为空", ErrInvalidInput)
		return
	}

	// 获取文件路径
	filePath, err := h.buildSvc.GetBuildOutput(fileName)
	if err != nil {
		h.errorResponse(w, http.StatusNotFound, err.Error(), ErrFileNotFound)
		return
	}

	// 设置响应头（根据文件类型）
	contentType := GetContentType(fileName)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(fileName))
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	// 发送文件
	http.ServeFile(w, r, filePath)
}

// successResponse 发送成功响应
func (h *APIHandler) successResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(Response{
		Success: true,
		Data:    data,
	})
}

// errorResponse 发送错误响应
func (h *APIHandler) errorResponse(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   message,
		Code:    code,
	})
}

// methodNotAllowed 发送方法不允许响应
func (h *APIHandler) methodNotAllowed(w http.ResponseWriter) {
	h.errorResponse(w, http.StatusMethodNotAllowed, "方法不允许", "")
}

// GetContentType 获取文件的 Content-Type
func GetContentType(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".doc":
		return "application/msword"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}

// ZipRequest 打包下载请求
type ZipRequest struct {
	Files []string `json:"files"`
}

// handleDownloadZip 处理打包下载请求
func (h *APIHandler) handleDownloadZip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req ZipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if len(req.Files) == 0 {
		h.errorResponse(w, http.StatusBadRequest, "文件列表不能为空", ErrInvalidInput)
		return
	}

	// 设置响应头
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape("文档打包.zip"))

	// 创建 zip writer
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	for _, fileName := range req.Files {
		filePath, err := h.buildSvc.GetBuildOutput(fileName)
		if err != nil {
			continue
		}

		file, err := os.Open(filePath)
		if err != nil {
			continue
		}

		writer, err := zipWriter.Create(fileName)
		if err != nil {
			file.Close()
			continue
		}

		io.Copy(writer, file)
		file.Close()
	}
}


// CreateConfigRequest 创建配置请求
type CreateConfigRequest struct {
	ClientName    string                 `json:"clientName"`
	DocTypeName   string                 `json:"docTypeName"`
	DisplayName   string                 `json:"displayName"`
	Template      string                 `json:"template"`
	Modules       []string               `json:"modules"`
	PandocArgs    []string               `json:"pandocArgs"`
	OutputPattern string                 `json:"outputPattern"`
	PdfOptions    *service.PdfOptions    `json:"pdfOptions,omitempty"`
	Variables     map[string]interface{} `json:"variables,omitempty"`
}

// handleModules 处理模块列表请求
func (h *APIHandler) handleModules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	// 获取树形结构
	tree, err := h.moduleSvc.ListModulesWithTree()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	// 同时返回扁平列表（兼容旧版）和树形结构
	modules, _ := h.moduleSvc.ListModules()

	h.successResponse(w, map[string]interface{}{
		"modules": modules,
		"tree":    tree,
	})
}

// handleTemplates 处理模板列表请求
func (h *APIHandler) handleTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	templates, err := h.templateSvc.ListTemplates()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"templates": templates,
	})
}

// handleConfigs 处理配置创建请求
func (h *APIHandler) handleConfigs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req CreateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	config := service.CustomConfig{
		ClientName:    req.ClientName,
		DocTypeName:   req.DocTypeName,
		DisplayName:   req.DisplayName,
		Template:      req.Template,
		Modules:       req.Modules,
		PandocArgs:    req.PandocArgs,
		OutputPattern: req.OutputPattern,
		PdfOptions:    req.PdfOptions,
		Variables:     req.Variables,
	}

	if config.DisplayName == "" {
		config.DisplayName = config.ClientName
	}

	if err := h.configMgr.CreateConfig(config); err != nil {
		// 根据错误类型返回不同的状态码
		errMsg := err.Error()
		if strings.Contains(errMsg, "已存在") {
			h.errorResponse(w, http.StatusConflict, errMsg, ErrDocTypeExists)
		} else if strings.Contains(errMsg, "不能为空") || strings.Contains(errMsg, "非法字符") || strings.Contains(errMsg, "至少选择") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidInput)
		} else if strings.Contains(errMsg, "预置") {
			h.errorResponse(w, http.StatusForbidden, errMsg, ErrPresetConfigReadonly)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "配置创建成功",
		"client":  req.ClientName,
		"docType": req.DocTypeName,
	})
}

// handleConfigDetail 处理配置详情请求（GET/PUT/DELETE）
func (h *APIHandler) handleConfigDetail(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/configs/{client}/{docType}
	path := strings.TrimPrefix(r.URL.Path, "/api/configs/")
	parts := strings.Split(path, "/")

	if len(parts) < 2 {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求路径", ErrInvalidInput)
		return
	}

	clientName, err := url.PathUnescape(parts[0])
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的客户名称", ErrInvalidInput)
		return
	}

	docTypeName, err := url.PathUnescape(parts[1])
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的文档类型名称", ErrInvalidInput)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getConfig(w, clientName, docTypeName)
	case http.MethodPut:
		h.updateConfig(w, r, clientName, docTypeName)
	case http.MethodDelete:
		h.deleteConfig(w, clientName, docTypeName)
	default:
		h.methodNotAllowed(w)
	}
}

// getConfig 获取配置详情
func (h *APIHandler) getConfig(w http.ResponseWriter, clientName, docTypeName string) {
	config, err := h.configMgr.GetConfig(clientName, docTypeName)
	if err != nil {
		if strings.Contains(err.Error(), "不存在") {
			h.errorResponse(w, http.StatusNotFound, err.Error(), ErrConfigNotFound)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"config":   config,
		"isCustom": h.configMgr.IsCustomConfig(clientName),
	})
}

// updateConfig 更新配置
func (h *APIHandler) updateConfig(w http.ResponseWriter, r *http.Request, clientName, docTypeName string) {
	var req CreateConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	config := service.CustomConfig{
		ClientName:    clientName,
		DocTypeName:   docTypeName,
		DisplayName:   req.DisplayName,
		Template:      req.Template,
		Modules:       req.Modules,
		PandocArgs:    req.PandocArgs,
		OutputPattern: req.OutputPattern,
		PdfOptions:    req.PdfOptions,
		Variables:     req.Variables,
	}

	if err := h.configMgr.UpdateConfig(clientName, docTypeName, config); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrConfigNotFound)
		} else if strings.Contains(errMsg, "已锁定") {
			h.errorResponse(w, http.StatusForbidden, errMsg, "CONFIG_LOCKED")
		} else if strings.Contains(errMsg, "不能为空") || strings.Contains(errMsg, "至少选择") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidInput)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "配置更新成功",
	})
}

// deleteConfig 删除配置
func (h *APIHandler) deleteConfig(w http.ResponseWriter, clientName, docTypeName string) {
	if err := h.configMgr.DeleteConfig(clientName, docTypeName); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrConfigNotFound)
		} else if strings.Contains(errMsg, "预置") {
			h.errorResponse(w, http.StatusForbidden, errMsg, ErrPresetConfigReadonly)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "配置删除成功",
	})
}


// VariablesRequest 变量提取请求
type VariablesRequest struct {
	Modules []string `json:"modules"`
}

// handleVariables 处理变量提取请求
func (h *APIHandler) handleVariables(w http.ResponseWriter, r *http.Request) {
	log.Printf("[API] handleVariables 被调用, 方法: %s", r.Method)
	
	if r.Method == http.MethodGet {
		// GET 请求：从 query 参数获取模块列表
		modulesParam := r.URL.Query().Get("modules")
		log.Printf("[API] GET 请求, modules 参数: %s", modulesParam)
		if modulesParam == "" {
			h.errorResponse(w, http.StatusBadRequest, "modules 参数不能为空", ErrInvalidInput)
			return
		}
		modules := strings.Split(modulesParam, ",")
		h.extractVariables(w, modules)
		return
	}

	if r.Method == http.MethodPost {
		// POST 请求：从 body 获取模块列表
		var req VariablesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("[API] POST 请求解析失败: %v", err)
			h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
			return
		}
		log.Printf("[API] POST 请求, 模块数量: %d, 模块列表: %v", len(req.Modules), req.Modules)
		if len(req.Modules) == 0 {
			h.errorResponse(w, http.StatusBadRequest, "modules 不能为空", ErrInvalidInput)
			return
		}
		h.extractVariables(w, req.Modules)
		return
	}

	h.methodNotAllowed(w)
}

// extractVariables 提取变量声明
func (h *APIHandler) extractVariables(w http.ResponseWriter, modules []string) {
	log.Printf("[API] extractVariables 被调用, 模块: %v", modules)
	variables, errors := h.variableSvc.ExtractVariables(modules)
	log.Printf("[API] 提取到变量数量: %d, 错误数量: %d", len(variables), len(errors))
	
	if len(variables) > 0 {
		for _, v := range variables {
			log.Printf("[API]   变量: %s (类型: %s, 来源: %s)", v.Name, v.Type, v.SourceFile)
		}
	}

	response := service.VariablesResponse{
		Variables: variables,
	}

	if len(errors) > 0 {
		response.Errors = errors
	}

	h.successResponse(w, response)
}

// handleClientLock 处理客户锁定/解锁请求
func (h *APIHandler) handleClientLock(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/lock/{clientName}
	clientName := strings.TrimPrefix(r.URL.Path, "/api/lock/")
	clientName, err := url.PathUnescape(clientName)
	if err != nil || clientName == "" {
		h.errorResponse(w, http.StatusBadRequest, "无效的客户名称", ErrInvalidInput)
		return
	}

	switch r.Method {
	case http.MethodGet:
		// 获取锁定状态
		locked := h.configMgr.IsClientLocked(clientName)
		h.successResponse(w, map[string]interface{}{
			"clientName": clientName,
			"locked":     locked,
		})
	case http.MethodPost:
		// 锁定客户 - 需要验证密码
		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
			return
		}
		if req.Password != h.adminPassword {
			h.errorResponse(w, http.StatusUnauthorized, "管理密码错误", "INVALID_PASSWORD")
			return
		}
		if err := h.configMgr.LockClient(clientName); err != nil {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
			return
		}
		h.successResponse(w, map[string]interface{}{
			"message": "客户配置已锁定",
		})
	case http.MethodDelete:
		// 解锁客户 - 需要验证密码
		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
			return
		}
		if req.Password != h.adminPassword {
			h.errorResponse(w, http.StatusUnauthorized, "管理密码错误", "INVALID_PASSWORD")
			return
		}
		if err := h.configMgr.UnlockClient(clientName); err != nil {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
			return
		}
		h.successResponse(w, map[string]interface{}{
			"message": "客户配置已解锁",
		})
	default:
		h.methodNotAllowed(w)
	}
}

// extractErrorDetail 从构建输出中提取关键错误信息
func extractErrorDetail(output string) string {
	var details []string
	
	// 匹配 LaTeX/fontspec 错误
	fontErrRegex := regexp.MustCompile(`The font "([^"]+)" cannot be found`)
	if matches := fontErrRegex.FindStringSubmatch(output); len(matches) > 1 {
		details = append(details, "字体 \""+matches[1]+"\" 未安装")
	}
	
	// 匹配 Pandoc 错误
	if strings.Contains(output, "Error producing PDF") {
		details = append(details, "PDF 生成失败")
	}
	
	// 匹配文件未找到错误
	fileNotFoundRegex := regexp.MustCompile(`(?i)(?:file not found|cannot find|no such file)[:\s]*([^\n]+)`)
	if matches := fileNotFoundRegex.FindStringSubmatch(output); len(matches) > 1 {
		details = append(details, "文件未找到: "+strings.TrimSpace(matches[1]))
	}
	
	// 匹配 LaTeX 包错误
	pkgErrRegex := regexp.MustCompile(`Package ([^\s]+) Error: ([^\n]+)`)
	if matches := pkgErrRegex.FindStringSubmatch(output); len(matches) > 2 {
		details = append(details, matches[1]+" 错误: "+matches[2])
	}
	
	// 匹配一般性错误行
	if len(details) == 0 {
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.Contains(strings.ToLower(line), "error") && len(line) < 200 {
				details = append(details, line)
				if len(details) >= 3 {
					break
				}
			}
		}
	}
	
	if len(details) == 0 {
		return ""
	}
	
	return strings.Join(details, "; ")
}
