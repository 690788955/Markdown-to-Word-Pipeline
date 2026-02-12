package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// VectorStore 向量存储服务
type VectorStore struct {
	storePath string
	mu        sync.RWMutex
	index     *VectorIndex
}

// VectorIndex 向量索引
type VectorIndex struct {
	Documents []Document `json:"documents"`
	Version   string     `json:"version"`
	Model     string     `json:"model"`
}

// Document 文档块
type Document struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Embedding []float64 `json:"embedding"`
	Metadata  Metadata  `json:"metadata"`
}

// Metadata 文档元数据
type Metadata struct {
	FilePath string `json:"file_path"`
	ChunkID  int    `json:"chunk_id"`
	Title    string `json:"title,omitempty"`
}

// NewVectorStore 创建新的向量存储实例
func NewVectorStore(workDir string) *VectorStore {
	storePath := filepath.Join(workDir, ".vector_store.json")
	return &VectorStore{
		storePath: storePath,
		index: &VectorIndex{
			Documents: []Document{},
			Version:   "1.0",
			Model:     "text-embedding-3-small",
		},
	}
}

// Load 加载向量索引
func (vs *VectorStore) Load() error {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	// 检查文件是否存在
	if _, err := os.Stat(vs.storePath); os.IsNotExist(err) {
		// 文件不存在,使用空索引
		return nil
	}

	// 读取文件
	data, err := os.ReadFile(vs.storePath)
	if err != nil {
		return fmt.Errorf("failed to read vector store: %w", err)
	}

	// 解析 JSON
	if err := json.Unmarshal(data, vs.index); err != nil {
		return fmt.Errorf("failed to parse vector store: %w", err)
	}

	return nil
}

// Save 保存向量索引
func (vs *VectorStore) Save() error {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	// 序列化为 JSON
	data, err := json.MarshalIndent(vs.index, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal vector store: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(vs.storePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write vector store: %w", err)
	}

	return nil
}

// AddDocument 添加文档
func (vs *VectorStore) AddDocument(doc Document) {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	vs.index.Documents = append(vs.index.Documents, doc)
}

// AddDocuments 批量添加文档
func (vs *VectorStore) AddDocuments(docs []Document) {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	vs.index.Documents = append(vs.index.Documents, docs...)
}

// Clear 清空索引
func (vs *VectorStore) Clear() {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	vs.index.Documents = []Document{}
}

// Search 搜索相似文档
func (vs *VectorStore) Search(queryEmbedding []float64, topK int) []SearchResult {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	// 计算所有文档的相似度
	results := make([]SearchResult, 0, len(vs.index.Documents))
	embSvc := NewEmbeddingService()

	for _, doc := range vs.index.Documents {
		similarity := embSvc.CosineSimilarity(queryEmbedding, doc.Embedding)
		results = append(results, SearchResult{
			Document:   doc,
			Similarity: similarity,
		})
	}

	// 按相似度排序
	sortSearchResults(results)

	// 返回 top-k 结果
	if topK > len(results) {
		topK = len(results)
	}

	return results[:topK]
}

// GetDocumentCount 获取文档数量
func (vs *VectorStore) GetDocumentCount() int {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	return len(vs.index.Documents)
}

// SearchResult 搜索结果
type SearchResult struct {
	Document   Document
	Similarity float64
}

// sortSearchResults 按相似度降序排序
func sortSearchResults(results []SearchResult) {
	// 简单的冒泡排序
	n := len(results)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if results[j].Similarity < results[j+1].Similarity {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}
}

// ChunkText 将文本分块
func ChunkText(text string, chunkSize int, overlap int) []string {
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if overlap < 0 {
		overlap = 200
	}

	// 按段落分割
	paragraphs := strings.Split(text, "\n\n")
	chunks := []string{}
	currentChunk := ""

	for _, para := range paragraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}

		// 如果当前块加上新段落不超过限制,直接添加
		if len(currentChunk)+len(para)+2 <= chunkSize {
			if currentChunk != "" {
				currentChunk += "\n\n"
			}
			currentChunk += para
		} else {
			// 保存当前块
			if currentChunk != "" {
				chunks = append(chunks, currentChunk)
			}

			// 如果段落本身超过限制,需要进一步分割
			if len(para) > chunkSize {
				sentences := splitIntoSentences(para)
				currentChunk = ""
				for _, sent := range sentences {
					if len(currentChunk)+len(sent)+1 <= chunkSize {
						if currentChunk != "" {
							currentChunk += " "
						}
						currentChunk += sent
					} else {
						if currentChunk != "" {
							chunks = append(chunks, currentChunk)
						}
						currentChunk = sent
					}
				}
			} else {
				currentChunk = para
			}
		}
	}

	// 添加最后一块
	if currentChunk != "" {
		chunks = append(chunks, currentChunk)
	}

	return chunks
}

// splitIntoSentences 将文本分割为句子
func splitIntoSentences(text string) []string {
	sentences := []string{}
	current := ""

	// 将字符串转换为 rune 切片以正确处理 Unicode 字符
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		current += string(runes[i])

		// 检查是否是句子结束
		if runes[i] == '。' || runes[i] == '!' || runes[i] == '?' ||
			runes[i] == '.' || runes[i] == '\n' {
			sentences = append(sentences, strings.TrimSpace(current))
			current = ""
		}
	}

	if current != "" {
		sentences = append(sentences, strings.TrimSpace(current))
	}

	return sentences
}
