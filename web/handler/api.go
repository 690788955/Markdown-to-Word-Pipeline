// Package handler 提供 HTTP 请求处理器
package handler

import (
	"archive/zip"
	"crypto/subtle"
	"encoding/json"
	"fmt"
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
	editorSvc     *service.EditorService
	gitSvc        *service.GitService
	resourceSvc   *service.ResourceService
	srcDir        string
	adminPassword string
}

// NewAPIHandler 创建 API 处理器实例
func NewAPIHandler(clientSvc *service.ClientService, docSvc *service.DocumentService, buildSvc *service.BuildService, moduleSvc *service.ModuleService, templateSvc *service.TemplateService, configMgr *service.ConfigManager, editorSvc *service.EditorService, srcDir string, adminPassword string, fontsDir string, templatesDir string, clientsDir string) *APIHandler {
	// 创建变量服务
	variableSvc := service.NewVariableService(srcDir)

	// 创建 Git 服务（工作目录为 srcDir 的父目录，即项目根目录）
	workDir := filepath.Dir(srcDir)
	gitSvc := service.NewGitService(workDir)
	gitSvc.LoadCredentialsFromEnv()

	// 创建资源服务
	resourceSvc := service.NewResourceService(fontsDir, templatesDir, clientsDir)

	// 检测 Git 是否可用
	if version, err := gitSvc.CheckGitAvailable(); err == nil {
		log.Printf("[APIHandler] Git 可用，版本: %s", version)
	} else {
		log.Printf("[APIHandler] Git 不可用: %v", err)
	}

	return &APIHandler{
		clientSvc:     clientSvc,
		docSvc:        docSvc,
		buildSvc:      buildSvc,
		moduleSvc:     moduleSvc,
		templateSvc:   templateSvc,
		configMgr:     configMgr,
		variableSvc:   variableSvc,
		editorSvc:     editorSvc,
		gitSvc:        gitSvc,
		resourceSvc:   resourceSvc,
		srcDir:        srcDir,
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
	// 新建编辑器相关路由
	mux.HandleFunc("/api/editor/module", h.handleEditorModule)
	mux.HandleFunc("/api/editor/module/", h.handleEditorModuleWithPath)
	mux.HandleFunc("/api/editor/tree", h.handleEditorTree)
	mux.HandleFunc("/api/editor/tree/order", h.handleEditorTreeOrder)
	mux.HandleFunc("/api/editor/upload", h.handleEditorUpload)
	mux.HandleFunc("/api/editor/image/", h.handleEditorImage)                       // 图片删除路由
	mux.HandleFunc("/api/editor/attachments", h.handleEditorAttachments)            // 附件列表路由
	mux.HandleFunc("/api/editor/attachment/rename", h.handleEditorAttachmentRename) // 附件重命名路由
	mux.HandleFunc("/api/src/", h.handleSrcStatic)
	// 新增：Git 相关路由
	mux.HandleFunc("/api/git/check", h.handleGitCheck)
	mux.HandleFunc("/api/git/status", h.handleGitStatus)
	mux.HandleFunc("/api/git/changes", h.handleGitChanges)
	mux.HandleFunc("/api/git/init", h.handleGitInit)
	mux.HandleFunc("/api/git/commit", h.handleGitCommit)
	mux.HandleFunc("/api/git/push", h.handleGitPush)
	mux.HandleFunc("/api/git/pull", h.handleGitPull)
	mux.HandleFunc("/api/git/log", h.handleGitLog)
	mux.HandleFunc("/api/git/remote", h.handleGitRemote)
	mux.HandleFunc("/api/git/credentials", h.handleGitCredentials)
	// 新增：Git 暂存区操作路由
	mux.HandleFunc("/api/git/stage", h.handleGitStage)
	mux.HandleFunc("/api/git/unstage", h.handleGitUnstage)
	mux.HandleFunc("/api/git/stage-all", h.handleGitStageAll)
	mux.HandleFunc("/api/git/unstage-all", h.handleGitUnstageAll)
	mux.HandleFunc("/api/git/discard", h.handleGitDiscard)
	mux.HandleFunc("/api/git/file-history", h.handleGitFileHistory)
	mux.HandleFunc("/api/git/file-show", h.handleGitFileShow)
	// 新增：资源管理路由
	mux.HandleFunc("/api/resources/fonts", h.handleResourceFonts)
	mux.HandleFunc("/api/resources/fonts/", h.handleResourceFontDetail)
	mux.HandleFunc("/api/resources/templates", h.handleResourceTemplates)
	mux.HandleFunc("/api/resources/templates/", h.handleResourceTemplateDetail)
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

	// 检查是否需要预览数据
	preview := r.URL.Query().Get("preview") == "true"

	if preview {
		// 返回带预览的文档类型列表
		docTypesWithPreview, err := h.docSvc.ListDocumentTypesWithPreview(clientName)
		if err != nil {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
			return
		}
		h.successResponse(w, map[string]interface{}{
			"documentTypes": docTypesWithPreview,
		})
		return
	}

	// 返回基本文档类型列表（向后兼容）
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
					// 直接附加完整的构建输出
					if result.Output != "" {
						errMsg += "\n\n--- 构建输出 ---\n" + result.Output
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
	if err := json.NewEncoder(w).Encode(Response{
		Success: true,
		Data:    data,
	}); err != nil {
		log.Printf("[API] JSON 编码失败: %v", err)
	}
}

// errorResponse 发送错误响应
func (h *APIHandler) errorResponse(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   message,
		Code:    code,
	}); err != nil {
		log.Printf("[API] JSON 编码失败: %v", err)
	}
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
	ClientName    string                  `json:"clientName"`
	DocTypeName   string                  `json:"docTypeName"`
	DisplayName   string                  `json:"displayName"`
	Template      string                  `json:"template"`
	Modules       []string                `json:"modules"`
	PandocArgs    []string                `json:"pandocArgs"`
	OutputPattern string                  `json:"outputPattern"`
	PdfOptions    *service.PdfOptions     `json:"pdfOptions,omitempty"`
	Variables     map[string]interface{}  `json:"variables,omitempty"`
	Metadata      *service.MetadataConfig `json:"metadata,omitempty"`
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
		Metadata:      req.Metadata,
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
		Metadata:      req.Metadata,
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
		if subtle.ConstantTimeCompare([]byte(req.Password), []byte(h.adminPassword)) != 1 {
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
		if subtle.ConstantTimeCompare([]byte(req.Password), []byte(h.adminPassword)) != 1 {
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

	// 匹配 LaTeX 文件未找到错误 (如 ctexhook.sty)
	latexFileRegex := regexp.MustCompile(`File \x60([^']+)' not found`)
	if matches := latexFileRegex.FindStringSubmatch(output); len(matches) > 1 {
		details = append(details, "LaTeX 文件未找到: "+matches[1])
	}

	// 匹配 ! 开头的 LaTeX 错误（如 ! Illegal parameter number）
	latexBangErrRegex := regexp.MustCompile(`(?m)^! ([^\n]+)`)
	if matches := latexBangErrRegex.FindAllStringSubmatch(output, 3); len(matches) > 0 {
		for _, m := range matches {
			if len(m) > 1 {
				errMsg := strings.TrimSpace(m[1])
				// 跳过 Emergency stop（单独处理）
				if !strings.Contains(errMsg, "Emergency stop") {
					details = append(details, "LaTeX: "+errMsg)
				}
			}
		}
	}

	// 匹配 Pandoc 错误
	if strings.Contains(output, "Error producing PDF") {
		if len(details) == 0 {
			details = append(details, "PDF 生成失败")
		}
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

	// 匹配 Emergency stop
	if strings.Contains(output, "Emergency stop") {
		if len(details) == 0 {
			details = append(details, "LaTeX 紧急停止")
		}
	}

	// 如果还没有找到错误，尝试匹配一般性错误行
	if len(details) == 0 {
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.Contains(strings.ToLower(line), "error") && len(line) < 200 && len(line) > 5 {
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

	return strings.Join(details, "\n")
}

// ==================== 编辑器相关处理 ====================

// SaveModuleRequest 保存模块请求
type SaveModuleRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// CreateModuleRequest 创建模块请求
type CreateModuleRequest struct {
	Path string `json:"path"`
}

// handleEditorModule 处理编辑器模块请求
func (h *APIHandler) handleEditorModule(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getModule(w, r)
	case http.MethodPut:
		h.saveModule(w, r)
	case http.MethodPost:
		h.createModule(w, r)
	default:
		h.methodNotAllowed(w)
	}
}

// getModule 读取模块内容
func (h *APIHandler) getModule(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 参数不能为空", ErrInvalidInput)
		return
	}

	content, err := h.editorSvc.ReadModule(path)
	if err != nil {
		switch err {
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, err.Error(), ErrFileNotFound)
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILE_TYPE")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, content)
}

// saveModule 保存模块内容
func (h *APIHandler) saveModule(w http.ResponseWriter, r *http.Request) {
	var req SaveModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if req.Path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 不能为空", ErrInvalidInput)
		return
	}

	if err := h.editorSvc.SaveModule(req.Path, req.Content); err != nil {
		switch err {
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, err.Error(), ErrFileNotFound)
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILE_TYPE")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "保存成功",
	})
}

// createModule 创建新模块
func (h *APIHandler) createModule(w http.ResponseWriter, r *http.Request) {
	var req CreateModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if req.Path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 不能为空", ErrInvalidInput)
		return
	}

	if err := h.editorSvc.CreateModule(req.Path); err != nil {
		switch err {
		case service.ErrFileExists:
			h.errorResponse(w, http.StatusConflict, err.Error(), "FILE_EXISTS")
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILE_TYPE")
		case service.ErrInvalidFilename:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILENAME")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"path":    req.Path,
		"message": "创建成功",
	})
}

// handleEditorTree 获取文件树
func (h *APIHandler) handleEditorTree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	tree, err := h.editorSvc.GetFileTree()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"tree": tree,
	})
}

// EditorTreeOrderRequest 文件树排序请求
type EditorTreeOrderRequest struct {
	ParentPath string   `json:"parentPath"`
	Order      []string `json:"order"`
}

// handleEditorTreeOrder 保存文件树排序
func (h *APIHandler) handleEditorTreeOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req EditorTreeOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "请求格式错误", ErrInvalidInput)
		return
	}

	if err := h.editorSvc.SaveTreeOrder(req.ParentPath, req.Order); err != nil {
		switch err {
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "排序已保存",
	})
}

// RenameModuleRequest 重命名模块请求
type RenameModuleRequest struct {
	NewPath string `json:"newPath"`
}

// handleEditorModuleWithPath 处理带路径的编辑器模块请求（DELETE, PUT rename）
func (h *APIHandler) handleEditorModuleWithPath(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/editor/module/{path} 或 /api/editor/module/{path}/rename
	path := strings.TrimPrefix(r.URL.Path, "/api/editor/module/")

	// 检查是否是重命名请求
	if strings.HasSuffix(path, "/rename") {
		path = strings.TrimSuffix(path, "/rename")
		path, _ = url.PathUnescape(path)
		h.renameModule(w, r, path)
		return
	}

	path, _ = url.PathUnescape(path)

	switch r.Method {
	case http.MethodDelete:
		h.deleteModule(w, path)
	default:
		h.methodNotAllowed(w)
	}
}

// deleteModule 删除模块
func (h *APIHandler) deleteModule(w http.ResponseWriter, path string) {
	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 不能为空", ErrInvalidInput)
		return
	}

	if err := h.editorSvc.DeleteModule(path); err != nil {
		switch err {
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, err.Error(), ErrFileNotFound)
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILE_TYPE")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "删除成功",
	})
}

// renameModule 重命名模块
func (h *APIHandler) renameModule(w http.ResponseWriter, r *http.Request, oldPath string) {
	if r.Method != http.MethodPut {
		h.methodNotAllowed(w)
		return
	}

	var req RenameModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if oldPath == "" || req.NewPath == "" {
		h.errorResponse(w, http.StatusBadRequest, "路径不能为空", ErrInvalidInput)
		return
	}

	if err := h.editorSvc.RenameModule(oldPath, req.NewPath); err != nil {
		switch err {
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, err.Error(), ErrFileNotFound)
		case service.ErrFileExists:
			h.errorResponse(w, http.StatusConflict, err.Error(), "FILE_EXISTS")
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, err.Error(), "INVALID_FILE_TYPE")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "重命名成功",
		"newPath": req.NewPath,
	})
}

// handleSrcStatic 处理 src 目录静态文件请求
func (h *APIHandler) handleSrcStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	// 解析路径: /api/src/{path}
	path := strings.TrimPrefix(r.URL.Path, "/api/src/")
	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "路径不能为空", ErrInvalidInput)
		return
	}

	// 安全检查：防止目录遍历
	if strings.Contains(path, "..") {
		h.errorResponse(w, http.StatusForbidden, "禁止访问该路径", "PATH_FORBIDDEN")
		return
	}

	// 构建完整路径
	fullPath := filepath.Join(h.srcDir, path)

	// 确保路径在 srcDir 内
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		h.errorResponse(w, http.StatusForbidden, "无效的路径", "PATH_FORBIDDEN")
		return
	}

	absSrcDir, err := filepath.Abs(h.srcDir)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, "服务器错误", "")
		return
	}

	if !strings.HasPrefix(absPath, absSrcDir) {
		h.errorResponse(w, http.StatusForbidden, "禁止访问该路径", "PATH_FORBIDDEN")
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		h.errorResponse(w, http.StatusNotFound, "文件不存在", ErrFileNotFound)
		return
	}

	// 提供文件服务
	http.ServeFile(w, r, absPath)
}

// ==================== Git 相关处理 ====================

// handleGitCheck 检测 Git 是否可用
func (h *APIHandler) handleGitCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	version, err := h.gitSvc.CheckGitAvailable()
	if err != nil {
		h.successResponse(w, map[string]interface{}{
			"available": false,
			"error":     err.Error(),
		})
		return
	}

	h.successResponse(w, map[string]interface{}{
		"available": true,
		"version":   version,
	})
}

// handleGitStatus 获取 Git 仓库状态
func (h *APIHandler) handleGitStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	status, err := h.gitSvc.GetStatus()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, status)
}

// handleGitChanges 获取变更文件列表
func (h *APIHandler) handleGitChanges(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	changesResult, err := h.gitSvc.GetChangesResult()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	// 同时返回旧格式的 byDir（兼容）
	byDir, _ := h.gitSvc.GetChangesByDirectory()

	h.successResponse(w, map[string]interface{}{
		"staged":   changesResult.Staged,
		"unstaged": changesResult.Unstaged,
		"byDir":    byDir,
	})
}

// handleGitInit 初始化 Git 仓库
func (h *APIHandler) handleGitInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	if err := h.gitSvc.Init(); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "Git 仓库初始化成功",
	})
}

// GitCommitRequest 提交请求
type GitCommitRequest struct {
	Message string   `json:"message"`
	Files   []string `json:"files,omitempty"`
}

// handleGitCommit 提交变更
func (h *APIHandler) handleGitCommit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req GitCommitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	hash, err := h.gitSvc.Commit(req.Message, req.Files)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "提交成功",
		"hash":    hash,
	})
}

// handleGitPush 推送到远程
func (h *APIHandler) handleGitPush(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	if err := h.gitSvc.Push(); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "推送成功",
	})
}

// handleGitPull 从远程拉取
func (h *APIHandler) handleGitPull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	conflicts, err := h.gitSvc.Pull()
	if err != nil {
		response := map[string]interface{}{
			"error": err.Error(),
		}
		if len(conflicts) > 0 {
			response["conflicts"] = conflicts
		}
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_CONFLICT")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "拉取成功",
	})
}

// handleGitLog 获取提交历史
func (h *APIHandler) handleGitLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	// 解析分页参数
	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := parseInt(l); err == nil && n > 0 {
			limit = n
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := parseInt(o); err == nil && n >= 0 {
			offset = n
		}
	}

	commits, total, err := h.gitSvc.GetLog(limit, offset)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"commits": commits,
		"total":   total,
	})
}

// parseInt 解析整数
func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}

// GitRemoteRequest 远程仓库配置请求
type GitRemoteRequest struct {
	URL string `json:"url"`
}

// handleGitRemote 处理远程仓库配置
func (h *APIHandler) handleGitRemote(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		url, err := h.gitSvc.GetRemote()
		if err != nil {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
			return
		}
		protocol := h.gitSvc.GetRemoteProtocol(url)
		h.successResponse(w, map[string]interface{}{
			"url":      url,
			"protocol": protocol,
		})
	case http.MethodPost:
		var req GitRemoteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
			return
		}
		if err := h.gitSvc.SetRemote(req.URL); err != nil {
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
			return
		}
		h.successResponse(w, map[string]interface{}{
			"message": "远程仓库配置成功",
		})
	default:
		h.methodNotAllowed(w)
	}
}

// GitCredentialsRequest 凭据配置请求
type GitCredentialsRequest struct {
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
	Token    string `json:"token,omitempty"`
}

// handleGitCredentials 处理凭据配置
func (h *APIHandler) handleGitCredentials(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		creds := h.gitSvc.GetCredentials()
		if creds == nil {
			h.successResponse(w, map[string]interface{}{
				"configured": false,
			})
			return
		}
		h.successResponse(w, map[string]interface{}{
			"configured": true,
			"username":   creds.Username,
		})
	case http.MethodPost:
		var req GitCredentialsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
			return
		}
		h.gitSvc.SetCredentials(&service.GitCredentials{
			Username: req.Username,
			Password: req.Password,
			Token:    req.Token,
		})
		h.successResponse(w, map[string]interface{}{
			"message": "凭据配置成功",
		})
	default:
		h.methodNotAllowed(w)
	}
}

// GitFilesRequest 文件列表请求
type GitFilesRequest struct {
	Files []string `json:"files"`
}

// handleGitStage 暂存指定文件
func (h *APIHandler) handleGitStage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req GitFilesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if len(req.Files) == 0 {
		h.errorResponse(w, http.StatusBadRequest, "文件列表不能为空", ErrInvalidInput)
		return
	}

	if err := h.gitSvc.Stage(req.Files); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "暂存成功",
	})
}

// handleGitUnstage 取消暂存指定文件
func (h *APIHandler) handleGitUnstage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req GitFilesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if len(req.Files) == 0 {
		h.errorResponse(w, http.StatusBadRequest, "文件列表不能为空", ErrInvalidInput)
		return
	}

	if err := h.gitSvc.Unstage(req.Files); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "取消暂存成功",
	})
}

// handleGitStageAll 暂存所有变更
func (h *APIHandler) handleGitStageAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	if err := h.gitSvc.StageAll(); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "全部暂存成功",
	})
}

// handleGitUnstageAll 取消暂存所有文件
func (h *APIHandler) handleGitUnstageAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	if err := h.gitSvc.UnstageAll(); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "全部取消暂存成功",
	})
}

// handleGitDiscard 放弃指定文件的更改
func (h *APIHandler) handleGitDiscard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req GitFilesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求格式", ErrInvalidInput)
		return
	}

	if len(req.Files) == 0 {
		h.errorResponse(w, http.StatusBadRequest, "文件列表不能为空", ErrInvalidInput)
		return
	}

	if err := h.gitSvc.Discard(req.Files); err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "放弃更改成功",
	})
}

// handleEditorUpload 处理编辑器图片上传
func (h *APIHandler) handleEditorUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	// 限制上传大小 (10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "请求过大或格式错误", ErrInvalidInput)
		return
	}

	// 获取模块路径
	modulePath := r.FormValue("modulePath")

	files := r.MultipartForm.File["file[]"]
	succMap := make(map[string]string)
	errFiles := make([]string, 0)

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			errFiles = append(errFiles, fileHeader.Filename)
			continue
		}

		content, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			errFiles = append(errFiles, fileHeader.Filename)
			continue
		}

		// 使用 SaveImage 保存，传入模块路径
		relPath, err := h.editorSvc.SaveImage(modulePath, fileHeader.Filename, content)
		if err != nil {
			log.Printf("[API] 保存图片失败: %v", err)
			errFiles = append(errFiles, fileHeader.Filename)
			continue
		}

		succMap[fileHeader.Filename] = relPath
	}

	response := map[string]interface{}{
		"msg":  "",
		"code": 0,
		"data": map[string]interface{}{
			"errFiles": errFiles,
			"succMap":  succMap,
		},
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(response)
}

// handleEditorImage 处理编辑器图片操作（删除）
func (h *APIHandler) handleEditorImage(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/editor/image/{path}
	path := strings.TrimPrefix(r.URL.Path, "/api/editor/image/")
	path, _ = url.PathUnescape(path)

	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "图片路径不能为空", ErrInvalidInput)
		return
	}

	switch r.Method {
	case http.MethodDelete:
		h.deleteImage(w, path)
	default:
		h.methodNotAllowed(w)
	}
}

// deleteImage 删除图片
func (h *APIHandler) deleteImage(w http.ResponseWriter, path string) {
	if err := h.editorSvc.DeleteImage(path); err != nil {
		switch err {
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, "图片不存在", ErrFileNotFound)
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, "禁止访问该路径", "PATH_FORBIDDEN")
		case service.ErrInvalidFileType:
			h.errorResponse(w, http.StatusBadRequest, "不是有效的图片文件", "INVALID_FILE_TYPE")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "图片删除成功",
	})
}

// ==================== 资源管理相关处理 ====================

// 资源管理错误码
const (
	ErrInvalidFileType = "INVALID_FILE_TYPE"
	ErrFileTooLarge    = "FILE_TOO_LARGE"
	ErrInvalidFilename = "INVALID_FILENAME"
	ErrFileExists      = "FILE_EXISTS"
	ErrTemplateInUse   = "TEMPLATE_IN_USE"
	ErrUploadFailed    = "UPLOAD_FAILED"
	ErrDeleteFailed    = "DELETE_FAILED"
)

// handleResourceFonts 处理字体资源请求（列表和上传）
func (h *APIHandler) handleResourceFonts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listFonts(w)
	case http.MethodPost:
		h.uploadFont(w, r)
	default:
		h.methodNotAllowed(w)
	}
}

// listFonts 获取字体列表
func (h *APIHandler) listFonts(w http.ResponseWriter) {
	fonts, err := h.resourceSvc.ListFonts()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"fonts": fonts,
	})
}

// uploadFont 上传字体文件
func (h *APIHandler) uploadFont(w http.ResponseWriter, r *http.Request) {
	// 限制上传大小 (50MB)
	if err := r.ParseMultipartForm(service.MaxFontFileSize); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "请求过大或格式错误", ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "未找到上传文件", ErrInvalidInput)
		return
	}
	defer file.Close()

	filename := header.Filename
	overwrite := r.FormValue("overwrite") == "true"

	// 检查文件是否已存在
	if !overwrite && h.resourceSvc.FontExists(filename) {
		h.errorResponse(w, http.StatusConflict, "文件已存在，请确认是否覆盖", ErrFileExists)
		return
	}

	// 上传文件
	if err := h.resourceSvc.UploadFont(filename, file, header.Size); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不支持") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidFileType)
		} else if strings.Contains(errMsg, "超过限制") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrFileTooLarge)
		} else if strings.Contains(errMsg, "非法字符") || strings.Contains(errMsg, "不能为空") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidFilename)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, ErrUploadFailed)
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message":  "上传成功",
		"filename": filename,
	})
}

// handleResourceFontDetail 处理单个字体文件请求（删除）
func (h *APIHandler) handleResourceFontDetail(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/resources/fonts/{filename}
	filename := strings.TrimPrefix(r.URL.Path, "/api/resources/fonts/")
	filename, err := url.PathUnescape(filename)
	if err != nil || filename == "" {
		h.errorResponse(w, http.StatusBadRequest, "无效的文件名", ErrInvalidInput)
		return
	}

	switch r.Method {
	case http.MethodDelete:
		h.deleteFont(w, filename)
	default:
		h.methodNotAllowed(w)
	}
}

// deleteFont 删除字体文件
func (h *APIHandler) deleteFont(w http.ResponseWriter, filename string) {
	if err := h.resourceSvc.DeleteFont(filename); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrFileNotFound)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, ErrDeleteFailed)
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message": "删除成功",
	})
}

// handleResourceTemplates 处理模板资源请求（列表和上传）
func (h *APIHandler) handleResourceTemplates(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listTemplatesResource(w)
	case http.MethodPost:
		h.uploadTemplate(w, r)
	default:
		h.methodNotAllowed(w)
	}
}

// listTemplatesResource 获取模板列表（资源管理）
func (h *APIHandler) listTemplatesResource(w http.ResponseWriter) {
	templates, err := h.resourceSvc.ListTemplates()
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"templates": templates,
	})
}

// uploadTemplate 上传模板文件
func (h *APIHandler) uploadTemplate(w http.ResponseWriter, r *http.Request) {
	// 限制上传大小 (20MB)
	if err := r.ParseMultipartForm(service.MaxTemplateFileSize); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "请求过大或格式错误", ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		h.errorResponse(w, http.StatusBadRequest, "未找到上传文件", ErrInvalidInput)
		return
	}
	defer file.Close()

	filename := header.Filename
	overwrite := r.FormValue("overwrite") == "true"

	// 检查文件是否已存在
	if !overwrite && h.resourceSvc.TemplateExists(filename) {
		h.errorResponse(w, http.StatusConflict, "文件已存在，请确认是否覆盖", ErrFileExists)
		return
	}

	// 上传文件
	if err := h.resourceSvc.UploadTemplate(filename, file, header.Size); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不支持") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidFileType)
		} else if strings.Contains(errMsg, "超过限制") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrFileTooLarge)
		} else if strings.Contains(errMsg, "非法字符") || strings.Contains(errMsg, "不能为空") {
			h.errorResponse(w, http.StatusBadRequest, errMsg, ErrInvalidFilename)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, ErrUploadFailed)
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"message":  "上传成功",
		"filename": filename,
	})
}

// handleResourceTemplateDetail 处理单个模板文件请求（删除、下载、使用检测）
func (h *APIHandler) handleResourceTemplateDetail(w http.ResponseWriter, r *http.Request) {
	// 解析路径: /api/resources/templates/{filename} 或 /api/resources/templates/{filename}/download 或 /api/resources/templates/{filename}/usage
	path := strings.TrimPrefix(r.URL.Path, "/api/resources/templates/")

	// 检查是否是下载请求
	if strings.HasSuffix(path, "/download") {
		filename := strings.TrimSuffix(path, "/download")
		filename, _ = url.PathUnescape(filename)
		h.downloadTemplate(w, r, filename)
		return
	}

	// 检查是否是使用检测请求
	if strings.HasSuffix(path, "/usage") {
		filename := strings.TrimSuffix(path, "/usage")
		filename, _ = url.PathUnescape(filename)
		h.getTemplateUsage(w, filename)
		return
	}

	// 普通文件操作
	filename, err := url.PathUnescape(path)
	if err != nil || filename == "" {
		h.errorResponse(w, http.StatusBadRequest, "无效的文件名", ErrInvalidInput)
		return
	}

	switch r.Method {
	case http.MethodDelete:
		h.deleteTemplate(w, filename)
	default:
		h.methodNotAllowed(w)
	}
}

// deleteTemplate 删除模板文件
func (h *APIHandler) deleteTemplate(w http.ResponseWriter, filename string) {
	// 先检查使用情况
	usedBy, err := h.resourceSvc.GetTemplateUsage(filename)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	if err := h.resourceSvc.DeleteTemplate(filename); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrFileNotFound)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, ErrDeleteFailed)
		}
		return
	}

	response := map[string]interface{}{
		"message": "删除成功",
	}
	if len(usedBy) > 0 {
		response["warning"] = "该模板被以下配置使用"
		response["usedBy"] = usedBy
	}

	h.successResponse(w, response)
}

// downloadTemplate 下载模板文件
func (h *APIHandler) downloadTemplate(w http.ResponseWriter, r *http.Request, filename string) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	filePath, err := h.resourceSvc.DownloadTemplate(filename)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrFileNotFound)
		} else {
			h.errorResponse(w, http.StatusInternalServerError, errMsg, "")
		}
		return
	}

	// 设置响应头
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(filename))
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	http.ServeFile(w, r, filePath)
}

// getTemplateUsage 获取模板使用情况
func (h *APIHandler) getTemplateUsage(w http.ResponseWriter, filename string) {
	usedBy, err := h.resourceSvc.GetTemplateUsage(filename)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"usedBy": usedBy,
	})
}

// handleEditorAttachments 处理附件列表请求
func (h *APIHandler) handleEditorAttachments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 参数不能为空", ErrInvalidInput)
		return
	}

	attachments, err := h.editorSvc.GetAttachments(path)
	if err != nil {
		switch err {
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"attachments": attachments,
	})
}

// handleEditorAttachmentRename 处理附件重命名请求
func (h *APIHandler) handleEditorAttachmentRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.methodNotAllowed(w)
		return
	}

	var req struct {
		ModulePath string `json:"modulePath"`
		OldName    string `json:"oldName"`
		NewName    string `json:"newName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.errorResponse(w, http.StatusBadRequest, "无效的请求体", ErrInvalidInput)
		return
	}

	if req.ModulePath == "" || req.OldName == "" || req.NewName == "" {
		h.errorResponse(w, http.StatusBadRequest, "modulePath, oldName, newName 参数不能为空", ErrInvalidInput)
		return
	}

	newPath, err := h.editorSvc.RenameAttachment(req.ModulePath, req.OldName, req.NewName)
	if err != nil {
		switch err {
		case service.ErrPathForbidden:
			h.errorResponse(w, http.StatusForbidden, err.Error(), "PATH_FORBIDDEN")
		case service.ErrFileNotFound:
			h.errorResponse(w, http.StatusNotFound, "附件不存在", "FILE_NOT_FOUND")
		case service.ErrFileExists:
			h.errorResponse(w, http.StatusConflict, "目标文件名已存在", "FILE_EXISTS")
		case service.ErrInvalidFilename:
			h.errorResponse(w, http.StatusBadRequest, "无效的文件名", "INVALID_FILENAME")
		default:
			h.errorResponse(w, http.StatusInternalServerError, err.Error(), "")
		}
		return
	}

	h.successResponse(w, map[string]interface{}{
		"newPath": newPath,
	})
}

// handleGitFileHistory 获取文件的 Git 提交历史
func (h *APIHandler) handleGitFileHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 参数不能为空", ErrInvalidInput)
		return
	}

	// 解析 limit 参数
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := parseInt(l); err == nil && n > 0 {
			limit = n
		}
	}

	commits, err := h.gitSvc.GetFileHistory(path, limit)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"commits": commits,
	})
}

// handleGitFileShow 获取特定版本的文件内容
func (h *APIHandler) handleGitFileShow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.methodNotAllowed(w)
		return
	}

	path := r.URL.Query().Get("path")
	commit := r.URL.Query().Get("commit")

	if path == "" {
		h.errorResponse(w, http.StatusBadRequest, "path 参数不能为空", ErrInvalidInput)
		return
	}
	if commit == "" {
		h.errorResponse(w, http.StatusBadRequest, "commit 参数不能为空", ErrInvalidInput)
		return
	}

	content, err := h.gitSvc.GetFileAtCommit(path, commit)
	if err != nil {
		h.errorResponse(w, http.StatusInternalServerError, err.Error(), "GIT_ERROR")
		return
	}

	h.successResponse(w, map[string]interface{}{
		"content": content,
	})
}
