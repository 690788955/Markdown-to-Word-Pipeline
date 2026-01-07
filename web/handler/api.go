// Package handler 提供 HTTP 请求处理器
package handler

import (
	"archive/zip"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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
	ClientConfig  string   `json:"clientConfig"`  // 客户配置目录名
	DocumentTypes []string `json:"documentTypes"` // 文档类型列表
	ClientName    string   `json:"clientName"`    // 自定义客户名称（可选）
	Format        string   `json:"format"`        // 输出格式：word 或 pdf（默认: word）
}

// GeneratedFile 生成的文件信息
type GeneratedFile struct {
	FileName    string `json:"fileName"`
	DownloadURL string `json:"downloadUrl"`
}

// APIHandler API 处理器
type APIHandler struct {
	clientSvc   *service.ClientService
	docSvc      *service.DocumentService
	buildSvc    *service.BuildService
	moduleSvc   *service.ModuleService
	templateSvc *service.TemplateService
	configMgr   *service.ConfigManager
}

// NewAPIHandler 创建 API 处理器实例
func NewAPIHandler(clientSvc *service.ClientService, docSvc *service.DocumentService, buildSvc *service.BuildService, moduleSvc *service.ModuleService, templateSvc *service.TemplateService, configMgr *service.ConfigManager) *APIHandler {
	return &APIHandler{
		clientSvc:   clientSvc,
		docSvc:      docSvc,
		buildSvc:    buildSvc,
		moduleSvc:   moduleSvc,
		templateSvc: templateSvc,
		configMgr:   configMgr,
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

			buildReq := service.BuildRequest{
				ClientName:   req.ClientConfig,
				DocumentType: dt,
				CustomName:   req.ClientName,
				Format:       format,
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
	ClientName    string   `json:"clientName"`
	DocTypeName   string   `json:"docTypeName"`
	DisplayName   string   `json:"displayName"`
	Template      string   `json:"template"`
	Modules       []string `json:"modules"`
	PandocArgs    []string `json:"pandocArgs"`
	OutputPattern string   `json:"outputPattern"`
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
	}

	if err := h.configMgr.UpdateConfig(clientName, docTypeName, config); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "不存在") {
			h.errorResponse(w, http.StatusNotFound, errMsg, ErrConfigNotFound)
		} else if strings.Contains(errMsg, "预置") {
			h.errorResponse(w, http.StatusForbidden, errMsg, ErrPresetConfigReadonly)
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
