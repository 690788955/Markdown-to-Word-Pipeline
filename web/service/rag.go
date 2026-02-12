package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"doc-generator-web/config"
)

// RAGService RAG (Retrieval-Augmented Generation) 服务
type RAGService struct {
	config      *config.Config
	vectorStore *VectorStore
	embSvc      *EmbeddingService
}

// NewRAGService 创建新的 RAG 服务实例
func NewRAGService(cfg *config.Config) *RAGService {
	return &RAGService{
		config:      cfg,
		vectorStore: NewVectorStore(cfg.WorkDir),
		embSvc:      NewEmbeddingService(),
	}
}

// IndexDocuments 索引文档目录
func (r *RAGService) IndexDocuments(ctx context.Context, apiEndpoint, apiKey, model string) error {
	srcDir := filepath.Join(r.config.WorkDir, "src")

	// 加载现有索引
	if err := r.vectorStore.Load(); err != nil {
		return fmt.Errorf("failed to load vector store: %w", err)
	}

	// 清空现有索引
	r.vectorStore.Clear()

	// 读取所有 Markdown 文件
	var allDocs []Document
	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录和非 Markdown 文件
		if info.IsDir() || !strings.HasSuffix(strings.ToLower(info.Name()), ".md") {
			return nil
		}

		// 读取文件内容
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", path, err)
		}

		// 分块
		text := string(content)
		chunks := ChunkText(text, 1000, 200)

		// 获取相对路径
		relPath, _ := filepath.Rel(r.config.WorkDir, path)

		// 提取标题
		title := extractTitle(text)

		// 为每个块创建文档
		for i, chunk := range chunks {
			doc := Document{
				ID:      fmt.Sprintf("%s#%d", relPath, i),
				Content: chunk,
				Metadata: Metadata{
					FilePath: relPath,
					ChunkID:  i,
					Title:    title,
				},
			}
			allDocs = append(allDocs, doc)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to walk directory: %w", err)
	}

	if len(allDocs) == 0 {
		return fmt.Errorf("no documents found in %s", srcDir)
	}

	// 批量生成 embeddings（分批处理，避免超出 API 批量大小限制）
	const batchSize = 20
	texts := make([]string, len(allDocs))
	for i, doc := range allDocs {
		texts[i] = doc.Content
	}

	allEmbeddings := make([][]float64, 0, len(texts))
	for i := 0; i < len(texts); i += batchSize {
		end := i + batchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch, err := r.embSvc.GenerateEmbeddings(ctx, apiEndpoint, apiKey, model, texts[i:end])
		if err != nil {
			return fmt.Errorf("failed to generate embeddings (batch %d-%d): %w", i, end-1, err)
		}
		allEmbeddings = append(allEmbeddings, batch...)
	}

	// 将 embeddings 添加到文档
	for i := range allDocs {
		allDocs[i].Embedding = allEmbeddings[i]
	}

	// 添加到向量存储
	r.vectorStore.AddDocuments(allDocs)

	// 保存索引
	if err := r.vectorStore.Save(); err != nil {
		return fmt.Errorf("failed to save vector store: %w", err)
	}

	return nil
}

// Search 搜索相关文档
func (r *RAGService) Search(ctx context.Context, apiEndpoint, apiKey, model, query string, topK int) ([]SearchResult, error) {
	// 加载索引
	if err := r.vectorStore.Load(); err != nil {
		return nil, fmt.Errorf("failed to load vector store: %w", err)
	}

	// 检查索引是否为空
	if r.vectorStore.GetDocumentCount() == 0 {
		return nil, fmt.Errorf("vector store is empty, please index documents first")
	}

	// 生成查询的 embedding
	queryEmbedding, err := r.embSvc.GenerateEmbedding(ctx, apiEndpoint, apiKey, model, query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// 搜索相似文档
	results := r.vectorStore.Search(queryEmbedding, topK)

	return results, nil
}

// GetIndexStatus 获取索引状态
func (r *RAGService) GetIndexStatus() (map[string]interface{}, error) {
	// 加载索引
	if err := r.vectorStore.Load(); err != nil {
		return nil, fmt.Errorf("failed to load vector store: %w", err)
	}

	status := map[string]interface{}{
		"document_count": r.vectorStore.GetDocumentCount(),
		"indexed":        r.vectorStore.GetDocumentCount() > 0,
		"model":          r.vectorStore.index.Model,
		"version":        r.vectorStore.index.Version,
	}

	return status, nil
}

// BuildRAGContext 构建 RAG 上下文
func (r *RAGService) BuildRAGContext(ctx context.Context, apiEndpoint, apiKey, model, query string, topK int) (string, error) {
	// 搜索相关文档
	results, err := r.Search(ctx, apiEndpoint, apiKey, model, query, topK)
	if err != nil {
		return "", err
	}

	if len(results) == 0 {
		return "", nil
	}

	// 构建上下文
	var contextBuilder strings.Builder
	contextBuilder.WriteString("以下是相关的运维文档内容：\n\n")

	for i, result := range results {
		contextBuilder.WriteString(fmt.Sprintf("## 文档片段 %d (相似度: %.2f)\n", i+1, result.Similarity))
		contextBuilder.WriteString(fmt.Sprintf("来源: %s\n", result.Document.Metadata.FilePath))
		if result.Document.Metadata.Title != "" {
			contextBuilder.WriteString(fmt.Sprintf("标题: %s\n", result.Document.Metadata.Title))
		}
		contextBuilder.WriteString(fmt.Sprintf("\n%s\n\n", result.Document.Content))
		contextBuilder.WriteString("---\n\n")
	}

	return contextBuilder.String(), nil
}

// extractTitle 从文档内容中提取标题
func extractTitle(content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimPrefix(line, "# ")
		}
	}
	return ""
}
