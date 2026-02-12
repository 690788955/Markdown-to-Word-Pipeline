package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"
)

// EmbeddingService 处理文本 embedding 相关的业务逻辑
type EmbeddingService struct{}

// NewEmbeddingService 创建新的 EmbeddingService 实例
func NewEmbeddingService() *EmbeddingService {
	return &EmbeddingService{}
}

// EmbeddingRequest OpenAI Embedding API 请求结构
type EmbeddingRequest struct {
	Input          interface{} `json:"input"` // string or []string
	Model          string      `json:"model"`
	EncodingFormat string      `json:"encoding_format,omitempty"`
}

// EmbeddingResponse OpenAI Embedding API 响应结构
type EmbeddingResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Model string `json:"model"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// GenerateEmbedding 生成单个文本的 embedding
func (s *EmbeddingService) GenerateEmbedding(ctx context.Context, apiEndpoint, apiKey, model, text string) ([]float64, error) {
	embeddings, err := s.GenerateEmbeddings(ctx, apiEndpoint, apiKey, model, []string{text})
	if err != nil {
		return nil, err
	}
	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return embeddings[0], nil
}

// GenerateEmbeddings 批量生成文本的 embeddings
func (s *EmbeddingService) GenerateEmbeddings(ctx context.Context, apiEndpoint, apiKey, model string, texts []string) ([][]float64, error) {
	if len(texts) == 0 {
		return [][]float64{}, nil
	}

	embeddingEndpoint := apiEndpoint
	if embeddingEndpoint == "" {
		embeddingEndpoint = "https://api.openai.com/v1/embeddings"
	}

	embeddingModel := model
	if embeddingModel == "" {
		embeddingModel = "text-embedding-3-small"
	}

	if !strings.HasPrefix(embeddingEndpoint, "https://") &&
		!strings.HasPrefix(embeddingEndpoint, "http://localhost") &&
		!strings.HasPrefix(embeddingEndpoint, "http://127.0.0.1") {
		return nil, fmt.Errorf("invalid embedding API endpoint: must use HTTPS or localhost")
	}

	const maxBatchSize = 32
	allEmbeddings := make([][]float64, 0, len(texts))

	for start := 0; start < len(texts); start += maxBatchSize {
		end := start + maxBatchSize
		if end > len(texts) {
			end = len(texts)
		}

		batchEmbeddings, err := s.generateEmbeddingsBatch(ctx, embeddingEndpoint, apiKey, embeddingModel, texts[start:end])
		if err != nil {
			return nil, fmt.Errorf("batch %d-%d failed: %w", start, end-1, err)
		}

		allEmbeddings = append(allEmbeddings, batchEmbeddings...)
	}

	return allEmbeddings, nil
}

func (s *EmbeddingService) generateEmbeddingsBatch(ctx context.Context, embeddingEndpoint, apiKey, embeddingModel string, texts []string) ([][]float64, error) {
	reqBody := EmbeddingRequest{
		Input: texts,
		Model: embeddingModel,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", embeddingEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var embResp EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if embResp.Error != nil {
		return nil, fmt.Errorf("API error: %s", embResp.Error.Message)
	}

	embeddings := make([][]float64, len(texts))
	for _, data := range embResp.Data {
		if data.Index < 0 || data.Index >= len(texts) {
			return nil, fmt.Errorf("invalid embedding index: %d", data.Index)
		}
		embeddings[data.Index] = data.Embedding
	}

	for i, emb := range embeddings {
		if emb == nil {
			return nil, fmt.Errorf("missing embedding for index %d", i)
		}
	}

	return embeddings, nil
}

// CosineSimilarity 计算两个向量的余弦相似度
func (s *EmbeddingService) CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}
