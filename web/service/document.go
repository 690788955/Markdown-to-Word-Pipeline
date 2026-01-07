package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DocumentType 文档类型信息
type DocumentType struct {
	Name        string    `json:"name"`        // 文件名（不含扩展名）
	DisplayName string    `json:"displayName"` // 显示名称
	IsDefault   bool      `json:"isDefault"`   // 是否为默认配置
	ModifiedAt  time.Time `json:"modifiedAt"`  // 最后修改时间
}

// DocumentService 文档服务
type DocumentService struct {
	clientsDir string
}

// NewDocumentService 创建文档服务实例
func NewDocumentService(clientsDir string) *DocumentService {
	return &DocumentService{
		clientsDir: clientsDir,
	}
}

// ListDocumentTypes 获取客户的文档类型列表
func (s *DocumentService) ListDocumentTypes(clientName string) ([]DocumentType, error) {
	clientDir := filepath.Join(s.clientsDir, clientName)
	
	// 检查客户目录是否存在
	if _, err := os.Stat(clientDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("客户不存在: %s", clientName)
	}

	entries, err := os.ReadDir(clientDir)
	if err != nil {
		return nil, fmt.Errorf("读取客户目录失败: %w", err)
	}

	var docTypes []DocumentType
	hasDefault := false

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		ext := filepath.Ext(name)
		
		// 只处理 YAML 文件
		if ext != ".yaml" && ext != ".yml" {
			continue
		}

		// 跳过 metadata.yaml
		baseName := strings.TrimSuffix(name, ext)
		if baseName == "metadata" {
			continue
		}

		// 获取文件信息
		filePath := filepath.Join(clientDir, name)
		info, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		docType := DocumentType{
			Name:        baseName,
			DisplayName: baseName,
			IsDefault:   false,
			ModifiedAt:  info.ModTime(),
		}

		docTypes = append(docTypes, docType)
	}

	return docTypes, nil
}

// GetDocumentType 获取文档类型详情
func (s *DocumentService) GetDocumentType(clientName, docType string) (*DocumentType, error) {
	clientDir := filepath.Join(s.clientsDir, clientName)
	
	// 尝试 .yaml 扩展名
	filePath := filepath.Join(clientDir, docType+".yaml")
	info, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		// 尝试 .yml 扩展名
		filePath = filepath.Join(clientDir, docType+".yml")
		info, err = os.Stat(filePath)
	}

	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("文档类型不存在: %s", docType)
		}
		return nil, fmt.Errorf("读取文档类型失败: %w", err)
	}

	return &DocumentType{
		Name:        docType,
		DisplayName: s.getDisplayName(docType),
		IsDefault:   docType == "config",
		ModifiedAt:  info.ModTime(),
	}, nil
}

// RemoveYAMLExtension 移除 YAML 文件扩展名
func RemoveYAMLExtension(filename string) string {
	ext := filepath.Ext(filename)
	if ext == ".yaml" || ext == ".yml" {
		return strings.TrimSuffix(filename, ext)
	}
	return filename
}

// getDisplayName 获取显示名称
func (s *DocumentService) getDisplayName(name string) string {
	if name == "config" {
		return "默认文档"
	}
	return name
}

// sortDocTypes 排序文档类型，默认配置放在最前面
func (s *DocumentService) sortDocTypes(docTypes []DocumentType) []DocumentType {
	var defaultDoc *DocumentType
	var others []DocumentType

	for i := range docTypes {
		if docTypes[i].IsDefault {
			defaultDoc = &docTypes[i]
		} else {
			others = append(others, docTypes[i])
		}
	}

	if defaultDoc != nil {
		return append([]DocumentType{*defaultDoc}, others...)
	}
	return others
}
