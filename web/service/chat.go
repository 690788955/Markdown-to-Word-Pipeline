package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"doc-generator-web/config"
)

// ChatService 处理 AI 聊天相关的业务逻辑
type ChatService struct {
	config *config.Config
	RAGSvc *RAGService // 导出字段以便在 handler 中访问
}

// NewChatService 创建新的 ChatService 实例
func NewChatService(cfg *config.Config) *ChatService {
	return &ChatService{
		config: cfg,
		RAGSvc: NewRAGService(cfg),
	}
}

// ChatRequest 聊天请求结构
type ChatRequest struct {
	Message string        `json:"message"`
	Context *ChatContext  `json:"context,omitempty"`
	History []ChatMessage `json:"history,omitempty"`
	Options *ChatOptions  `json:"options,omitempty"`
}

// ChatContext 上下文信息
type ChatContext struct {
	Type    string `json:"type"`    // current_document, selection, knowledge_base
	Content string `json:"content"` // 上下文内容
	Path    string `json:"path,omitempty"`
}

// ChatMessage 聊天消息
type ChatMessage struct {
	Role    string `json:"role"`    // user, assistant, system
	Content string `json:"content"` // 消息内容
}

// ChatOptions 聊天选项
type ChatOptions struct {
	Temperature  float64 `json:"temperature,omitempty"`  // 温度参数 (0-2)
	MaxTokens    int     `json:"maxTokens,omitempty"`    // 最大 token 数
	SystemPrompt string  `json:"systemPrompt,omitempty"` // 自定义系统提示词
}

// ChatResponse 聊天响应结构
type ChatResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message,omitempty"`
	Usage   *TokenUsage       `json:"usage,omitempty"`
	Error   string            `json:"error,omitempty"`
	Code    string            `json:"code,omitempty"`
}

// TokenUsage token 使用统计
type TokenUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// StreamEvent SSE 流式事件
type StreamEvent struct {
	Type  string      `json:"type"`  // start, content, done, error
	Delta string      `json:"delta,omitempty"`
	Usage *TokenUsage `json:"usage,omitempty"`
	Error string      `json:"error,omitempty"`
	ID    string      `json:"id,omitempty"`
}

// OpenAIRequest OpenAI API 请求结构
type OpenAIRequest struct {
	Model       string          `json:"model"`
	Messages    []ChatMessage   `json:"messages"`
	Temperature float64         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Stream      bool            `json:"stream,omitempty"`
}

// OpenAIResponse OpenAI API 响应结构
type OpenAIResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int         `json:"index"`
		Message ChatMessage `json:"message"`
		Delta   struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// Selection 文本选择范围
type Selection struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// ContextExtractionRequest 上下文提取请求
type ContextExtractionRequest struct {
	Type      string     `json:"type"` // current_document, selection, knowledge_base
	Path      string     `json:"path,omitempty"`
	Selection *Selection `json:"selection,omitempty"`
}

// ContextExtractionResponse 上下文提取响应
type ContextExtractionResponse struct {
	Success bool   `json:"success"`
	Context string `json:"context"`
	Metadata struct {
		FileCount  int `json:"fileCount"`
		TotalChars int `json:"totalChars"`
	} `json:"metadata"`
	Error string `json:"error,omitempty"`
	Code  string `json:"code,omitempty"`
}

// 错误代码常量
const (
	ErrChatConfigMissing    = "CHAT_CONFIG_MISSING"
	ErrChatAPIError         = "CHAT_API_ERROR"
	ErrChatNetworkError     = "CHAT_NETWORK_ERROR"
	ErrChatTimeout          = "CHAT_TIMEOUT"
	ErrChatContextTooLarge  = "CHAT_CONTEXT_TOO_LARGE"
	ErrChatInvalidEndpoint  = "CHAT_INVALID_ENDPOINT"
	ErrChatRateLimit        = "CHAT_RATE_LIMIT"
)

// callOpenAI 调用 OpenAI API
func (s *ChatService) callOpenAI(ctx context.Context, apiEndpoint, apiKey, model string, messages []ChatMessage, options *ChatOptions, stream bool) (*http.Response, error) {
	// 验证端点
	if !strings.HasPrefix(apiEndpoint, "https://") && !strings.HasPrefix(apiEndpoint, "http://localhost") && !strings.HasPrefix(apiEndpoint, "http://127.0.0.1") {
		return nil, fmt.Errorf("invalid API endpoint: must use HTTPS or localhost")
	}

	// 构建请求
	reqBody := OpenAIRequest{
		Model:    model,
		Messages: messages,
		Stream:   stream,
	}

	if options != nil {
		if options.Temperature >= 0 && options.Temperature <= 2 {
			reqBody.Temperature = options.Temperature
		}
		if options.MaxTokens > 0 && options.MaxTokens <= 8000 {
			reqBody.MaxTokens = options.MaxTokens
		}
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequestWithContext(ctx, "POST", apiEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 发送请求
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	return resp, nil
}

// buildMessages 构建消息列表
func (s *ChatService) buildMessages(req *ChatRequest) []ChatMessage {
	messages := make([]ChatMessage, 0)

	// 构建系统提示词
	var systemParts []string

	// 自定义系统提示词优先
	if req.Options != nil && req.Options.SystemPrompt != "" {
		prompt := req.Options.SystemPrompt
		if len(prompt) > 10000 {
			prompt = prompt[:10000]
		}
		systemParts = append(systemParts, prompt)
	} else {
		systemParts = append(systemParts, "You are a helpful AI assistant for documentation editing.")
	}

	// 添加上下文
	if req.Context != nil && req.Context.Content != "" {
		systemParts = append(systemParts, fmt.Sprintf("Here is the context:\n\n%s\n\nPlease answer questions based on this context.", req.Context.Content))
	}

	messages = append(messages, ChatMessage{
		Role:    "system",
		Content: strings.Join(systemParts, "\n\n"),
	})

	// 添加历史消息（仅允许 user 和 assistant 角色）
	if len(req.History) > 0 {
		for _, msg := range req.History {
			if msg.Role == "user" || msg.Role == "assistant" {
				messages = append(messages, msg)
			}
		}
	}

	// 添加当前消息
	messages = append(messages, ChatMessage{
		Role:    "user",
		Content: req.Message,
	})

	return messages
}

// processRAGContext 处理 RAG 上下文检索
func (s *ChatService) processRAGContext(ctx context.Context, apiEndpoint, apiKey, embeddingEndpoint, embeddingKey, embeddingModel string, req *ChatRequest) error {
	// 检查是否需要 RAG 检索
	if req.Context == nil || req.Context.Type != "knowledge_base" {
		return nil
	}

	// 使用用户消息作为查询
	query := req.Message

	// 如果没有单独的 embedding 配置，回退到聊天 API 配置
	// 并将聊天端点转换为 embedding 端点
	if embeddingEndpoint == "" {
		embeddingEndpoint = ChatEndpointToEmbeddingEndpoint(apiEndpoint)
	}
	if embeddingKey == "" {
		embeddingKey = apiKey
	}

	// 调用 RAG 服务获取相关文档
	ragContext, err := s.RAGSvc.BuildRAGContext(ctx, embeddingEndpoint, embeddingKey, embeddingModel, query, 3)
	if err != nil || ragContext == "" {
		// RAG 失败或无结果，回退到简单的知识库读取
		srcDir := filepath.Join(s.config.WorkDir, "src")
		content, fileCount, readErr := s.readDirectory(srcDir)
		if readErr != nil {
			if err != nil {
				return fmt.Errorf("RAG failed and fallback also failed: %w", err)
			}
			return fmt.Errorf("fallback read failed: %w", readErr)
		}

		// 检查上下文大小
		const maxContextSize = 100000
		if len(content) > maxContextSize {
			return fmt.Errorf("context too large (%d chars), please index documents first", len(content))
		}

		req.Context.Content = fmt.Sprintf("整个知识库内容 (%d 个文件):\n\n%s", fileCount, content)
		return nil
	}

	// 将 RAG 检索到的内容设置到上下文中
	req.Context.Content = ragContext

	return nil
}

// SendMessage 发送消息并获取 AI 回复（非流式）
func (s *ChatService) SendMessage(ctx context.Context, apiEndpoint, apiKey, model string, embeddingEndpoint, embeddingKey, embeddingModel string, req *ChatRequest) (*ChatResponse, error) {
	// 处理 RAG 上下文
	if err := s.processRAGContext(ctx, apiEndpoint, apiKey, embeddingEndpoint, embeddingKey, embeddingModel, req); err != nil {
		return &ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to process RAG context: %v", err),
			Code:    ErrChatAPIError,
		}, nil
	}

	// 构建消息列表
	messages := s.buildMessages(req)

	// 调用 OpenAI API
	resp, err := s.callOpenAI(ctx, apiEndpoint, apiKey, model, messages, req.Options, false)
	if err != nil {
		return &ChatResponse{
			Success: false,
			Error:   err.Error(),
			Code:    ErrChatNetworkError,
		}, nil
	}
	defer resp.Body.Close()

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return &ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("API returned status %d: %s", resp.StatusCode, string(body)),
			Code:    ErrChatAPIError,
		}, nil
	}

	// 解析响应
	var openAIResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return &ChatResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to decode response: %v", err),
			Code:    ErrChatAPIError,
		}, nil
	}

	// 检查 API 错误
	if openAIResp.Error != nil {
		code := ErrChatAPIError
		if strings.Contains(openAIResp.Error.Type, "rate_limit") {
			code = ErrChatRateLimit
		}
		return &ChatResponse{
			Success: false,
			Error:   openAIResp.Error.Message,
			Code:    code,
		}, nil
	}

	// 提取回复内容
	if len(openAIResp.Choices) == 0 {
		return &ChatResponse{
			Success: false,
			Error:   "no response from API",
			Code:    ErrChatAPIError,
		}, nil
	}

	message := openAIResp.Choices[0].Message.Content

	// 构建响应
	return &ChatResponse{
		Success: true,
		Message: message,
		Usage: &TokenUsage{
			PromptTokens:     openAIResp.Usage.PromptTokens,
			CompletionTokens: openAIResp.Usage.CompletionTokens,
			TotalTokens:      openAIResp.Usage.TotalTokens,
		},
	}, nil
}

// StreamMessage 发送消息并流式获取 AI 回复（SSE）
func (s *ChatService) StreamMessage(w http.ResponseWriter, ctx context.Context, apiEndpoint, apiKey, model string, embeddingEndpoint, embeddingKey, embeddingModel string, req *ChatRequest) error {
	// 设置 SSE 响应头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	// 处理 RAG 上下文
	if err := s.processRAGContext(ctx, apiEndpoint, apiKey, embeddingEndpoint, embeddingKey, embeddingModel, req); err != nil {
		s.sendSSEEvent(w, flusher, StreamEvent{
			Type:  "error",
			Error: fmt.Sprintf("failed to process RAG context: %v", err),
		})
		return err
	}

	// 构建消息列表
	messages := s.buildMessages(req)

	// 调用 OpenAI API（流式）
	resp, err := s.callOpenAI(ctx, apiEndpoint, apiKey, model, messages, req.Options, true)
	if err != nil {
		s.sendSSEEvent(w, flusher, StreamEvent{
			Type:  "error",
			Error: err.Error(),
		})
		return err
	}
	defer resp.Body.Close()

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		s.sendSSEEvent(w, flusher, StreamEvent{
			Type:  "error",
			Error: fmt.Sprintf("API returned status %d: %s", resp.StatusCode, string(body)),
		})
		return fmt.Errorf("API error: %d", resp.StatusCode)
	}

	// 发送开始事件
	s.sendSSEEvent(w, flusher, StreamEvent{
		Type: "start",
		ID:   fmt.Sprintf("msg_%d", time.Now().Unix()),
	})

	// 读取流式响应
	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			s.sendSSEEvent(w, flusher, StreamEvent{
				Type:  "error",
				Error: fmt.Sprintf("failed to read stream: %v", err),
			})
			return err
		}

		// 跳过空行
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		// 解析 SSE 数据
		if bytes.HasPrefix(line, []byte("data: ")) {
			data := bytes.TrimPrefix(line, []byte("data: "))

			// 检查是否是结束标记
			if bytes.Equal(data, []byte("[DONE]")) {
				s.sendSSEEvent(w, flusher, StreamEvent{
					Type: "done",
				})
				break
			}

			// 解析 JSON
			var openAIResp OpenAIResponse
			if err := json.Unmarshal(data, &openAIResp); err != nil {
				continue // 跳过无法解析的行
			}

			// 检查错误
			if openAIResp.Error != nil {
				s.sendSSEEvent(w, flusher, StreamEvent{
					Type:  "error",
					Error: openAIResp.Error.Message,
				})
				return fmt.Errorf("API error: %s", openAIResp.Error.Message)
			}

			// 提取内容增量
			if len(openAIResp.Choices) > 0 {
				delta := openAIResp.Choices[0].Delta.Content
				if delta != "" {
					s.sendSSEEvent(w, flusher, StreamEvent{
						Type:  "content",
						Delta: delta,
					})
				}

				// 检查是否完成
				if openAIResp.Choices[0].FinishReason != "" {
					usage := &TokenUsage{
						PromptTokens:     openAIResp.Usage.PromptTokens,
						CompletionTokens: openAIResp.Usage.CompletionTokens,
						TotalTokens:      openAIResp.Usage.TotalTokens,
					}
					s.sendSSEEvent(w, flusher, StreamEvent{
						Type:  "done",
						Usage: usage,
					})
					break
				}
			}
		}
	}

	return nil
}

// sendSSEEvent 发送 SSE 事件
func (s *ChatService) sendSSEEvent(w http.ResponseWriter, flusher http.Flusher, event StreamEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}

// ExtractContext 提取文档上下文
func (s *ChatService) ExtractContext(contextType, path string, selection *Selection) (*ContextExtractionResponse, error) {
	resp := &ContextExtractionResponse{
		Success: true,
	}

	switch contextType {
	case "current_document":
		// 读取当前文档
		content, err := s.readFile(path)
		if err != nil {
			return &ContextExtractionResponse{
				Success: false,
				Error:   fmt.Sprintf("failed to read file: %v", err),
				Code:    ErrChatAPIError,
			}, nil
		}
		resp.Context = content
		resp.Metadata.FileCount = 1
		resp.Metadata.TotalChars = len(content)

	case "selection":
		// 读取选中内容
		if selection == nil {
			return &ContextExtractionResponse{
				Success: false,
				Error:   "selection is required for selection context type",
				Code:    ErrChatAPIError,
			}, nil
		}
		content, err := s.readFile(path)
		if err != nil {
			return &ContextExtractionResponse{
				Success: false,
				Error:   fmt.Sprintf("failed to read file: %v", err),
				Code:    ErrChatAPIError,
			}, nil
		}
		// 提取选中部分
		if selection.Start < 0 || selection.End > len(content) || selection.Start > selection.End {
			return &ContextExtractionResponse{
				Success: false,
				Error:   "invalid selection range",
				Code:    ErrChatAPIError,
			}, nil
		}
		resp.Context = content[selection.Start:selection.End]
		resp.Metadata.FileCount = 1
		resp.Metadata.TotalChars = len(resp.Context)

	case "knowledge_base":
		// 读取整个知识库
		srcDir := filepath.Join(s.config.WorkDir, "src")
		content, fileCount, err := s.readDirectory(srcDir)
		if err != nil {
			return &ContextExtractionResponse{
				Success: false,
				Error:   fmt.Sprintf("failed to read knowledge base: %v", err),
				Code:    ErrChatAPIError,
			}, nil
		}
		resp.Context = content
		resp.Metadata.FileCount = fileCount
		resp.Metadata.TotalChars = len(content)

		// 检查上下文大小
		const maxContextSize = 100000 // 约 100KB
		if len(content) > maxContextSize {
			return &ContextExtractionResponse{
				Success: false,
				Error:   fmt.Sprintf("context too large (%d chars), please use a smaller scope", len(content)),
				Code:    ErrChatContextTooLarge,
			}, nil
		}

	default:
		return &ContextExtractionResponse{
			Success: false,
			Error:   fmt.Sprintf("unknown context type: %s", contextType),
			Code:    ErrChatAPIError,
		}, nil
	}

	return resp, nil
}

// readFile 读取文件内容
func (s *ChatService) readFile(path string) (string, error) {
	// 确保路径在工作目录内（安全检查）
	absPath := filepath.Join(s.config.WorkDir, path)
	if !strings.HasPrefix(absPath, s.config.WorkDir) {
		return "", fmt.Errorf("invalid path: outside work directory")
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// readDirectory 递归读取目录中的所有 Markdown 文件
func (s *ChatService) readDirectory(dir string) (string, int, error) {
	var content strings.Builder
	fileCount := 0

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录和非 Markdown 文件
		if info.IsDir() || !strings.HasSuffix(strings.ToLower(info.Name()), ".md") {
			return nil
		}

		// 读取文件
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		// 添加文件分隔符
		relPath, _ := filepath.Rel(s.config.WorkDir, path)
		content.WriteString(fmt.Sprintf("\n\n--- File: %s ---\n\n", relPath))
		content.Write(data)
		fileCount++

		return nil
	})

	if err != nil {
		return "", 0, err
	}

	return content.String(), fileCount, nil
}

// OpenAIModel OpenAI 模型信息
type OpenAIModel struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

// OpenAIModelsResponse OpenAI 模型列表响应
type OpenAIModelsResponse struct {
	Object string         `json:"object"`
	Data   []OpenAIModel  `json:"data"`
	Error  *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// ModelInfo 模型信息（简化版）
type ModelInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// ModelsResponse 模型列表响应
type ModelsResponse struct {
	Success bool        `json:"success"`
	Models  []ModelInfo `json:"models,omitempty"`
	Error   string      `json:"error,omitempty"`
	Code    string      `json:"code,omitempty"`
}

// GetModels 获取可用的模型列表
func (s *ChatService) GetModels(ctx context.Context, apiEndpoint, apiKey string) (*ModelsResponse, error) {
	// 构建模型列表 API 端点
	// OpenAI 的模型列表端点是 /v1/models
	modelsEndpoint := strings.TrimSuffix(apiEndpoint, "/chat/completions")
	modelsEndpoint = strings.TrimSuffix(modelsEndpoint, "/v1/chat/completions")
	if !strings.HasSuffix(modelsEndpoint, "/v1") {
		modelsEndpoint = modelsEndpoint + "/v1"
	}
	modelsEndpoint = modelsEndpoint + "/models"

	// 创建 HTTP 请求
	req, err := http.NewRequestWithContext(ctx, "GET", modelsEndpoint, nil)
	if err != nil {
		return &ModelsResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
			Code:    ErrChatNetworkError,
		}, nil
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 发送请求
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return &ModelsResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to send request: %v", err),
			Code:    ErrChatNetworkError,
		}, nil
	}
	defer resp.Body.Close()

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return &ModelsResponse{
			Success: false,
			Error:   fmt.Sprintf("API returned status %d: %s", resp.StatusCode, string(body)),
			Code:    ErrChatAPIError,
		}, nil
	}

	// 解析响应
	var modelsResp OpenAIModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err != nil {
		return &ModelsResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to decode response: %v", err),
			Code:    ErrChatAPIError,
		}, nil
	}

	// 检查 API 错误
	if modelsResp.Error != nil {
		return &ModelsResponse{
			Success: false,
			Error:   modelsResp.Error.Message,
			Code:    ErrChatAPIError,
		}, nil
	}

	// 返回所有聊天相关模型，过滤掉 embedding/tts/whisper/dall-e 等非聊天模型
	var models []ModelInfo
	excludePrefixes := []string{"text-embedding", "tts-", "whisper-", "dall-e", "davinci", "babbage", "ada", "curie"}
	for _, model := range modelsResp.Data {
		excluded := false
		modelLower := strings.ToLower(model.ID)
		for _, prefix := range excludePrefixes {
			if strings.HasPrefix(modelLower, prefix) {
				excluded = true
				break
			}
		}
		if !excluded {
			modelInfo := ModelInfo{
				ID:   model.ID,
				Name: s.formatModelName(model.ID),
			}
			models = append(models, modelInfo)
		}
	}

	return &ModelsResponse{
		Success: true,
		Models:  models,
	}, nil
}

// ChatEndpointToEmbeddingEndpoint 将聊天 API 端点转换为 embedding 端点
// 例如: https://api.openai.com/v1/chat/completions -> https://api.openai.com/v1/embeddings
func ChatEndpointToEmbeddingEndpoint(chatEndpoint string) string {
	endpoint := chatEndpoint

	// 移除 /chat/completions 后缀
	endpoint = strings.TrimSuffix(endpoint, "/chat/completions")

	// 确保以 /v1 结尾
	if !strings.HasSuffix(endpoint, "/v1") {
		if idx := strings.LastIndex(endpoint, "/v1/"); idx >= 0 {
			endpoint = endpoint[:idx+3]
		} else {
			endpoint = strings.TrimSuffix(endpoint, "/") + "/v1"
		}
	}

	return endpoint + "/embeddings"
}

// formatModelName 格式化模型名称为更友好的显示名称
func (s *ChatService) formatModelName(modelID string) string {
	// 简单的名称映射
	nameMap := map[string]string{
		"gpt-4":                "GPT-4",
		"gpt-4-turbo":         "GPT-4 Turbo",
		"gpt-4-turbo-preview": "GPT-4 Turbo Preview",
		"gpt-4o":              "GPT-4o",
		"gpt-4o-mini":         "GPT-4o Mini",
		"gpt-3.5-turbo":       "GPT-3.5 Turbo",
		"gpt-3.5-turbo-16k":   "GPT-3.5 Turbo 16K",
		"claude-3-opus":       "Claude 3 Opus",
		"claude-3-sonnet":     "Claude 3 Sonnet",
		"claude-3-haiku":      "Claude 3 Haiku",
		"claude-3.5-sonnet":   "Claude 3.5 Sonnet",
		"deepseek-chat":       "DeepSeek Chat",
		"deepseek-coder":      "DeepSeek Coder",
		"qwen-turbo":          "Qwen Turbo",
		"qwen-plus":           "Qwen Plus",
		"qwen-max":            "Qwen Max",
	}

	if name, ok := nameMap[modelID]; ok {
		return name
	}

	// 如果没有映射，返回原始 ID
	return modelID
}
