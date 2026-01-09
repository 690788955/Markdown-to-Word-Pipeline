package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// DocumentType 文档类型信息
type DocumentType struct {
	Name        string    `json:"name"`        // 文件名（不含扩展名）
	DisplayName string    `json:"displayName"` // 显示名称
	IsDefault   bool      `json:"isDefault"`   // 是否为默认配置
	ModifiedAt  time.Time `json:"modifiedAt"`  // 最后修改时间
}

// DocumentPreview 文档预览信息
type DocumentPreview struct {
	Title       string   `json:"title"`       // 文档标题
	ModuleCount int      `json:"moduleCount"` // 模块总数
	Modules     []string `json:"modules"`     // 模块名称列表（最多5个）
	HasMore     bool     `json:"hasMore"`     // 是否有更多模块
	Author      string   `json:"author,omitempty"`   // 作者（可选）
	Version     string   `json:"version,omitempty"`  // 版本（可选）
	Date        string   `json:"date,omitempty"`     // 日期（可选）
	Template    string   `json:"template,omitempty"` // 使用的模板（可选）
}

// DocumentTypeWithPreview 带预览的文档类型
type DocumentTypeWithPreview struct {
	DocumentType
	Preview *DocumentPreview `json:"preview,omitempty"`
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

// GetDocumentPreview 获取文档预览信息
func (s *DocumentService) GetDocumentPreview(clientName, docTypeName string) (*DocumentPreview, error) {
	clientDir := filepath.Join(s.clientsDir, clientName)
	
	// 尝试读取配置文件
	configPath := filepath.Join(clientDir, docTypeName+".yaml")
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 尝试 .yml 扩展名
			configPath = filepath.Join(clientDir, docTypeName+".yml")
			data, err = os.ReadFile(configPath)
			if err != nil {
				return nil, fmt.Errorf("配置文件不存在: %s", docTypeName)
			}
		} else {
			return nil, fmt.Errorf("读取配置文件失败: %w", err)
		}
	}

	// 解析 YAML
	var config struct {
		Title      string   `yaml:"title"`
		Author     string   `yaml:"author"`
		Version    string   `yaml:"version"`
		Date       string   `yaml:"date"`
		ClientName string   `yaml:"client_name"`
		Template   string   `yaml:"template"`
		Modules    []string `yaml:"modules"`
	}
	
	if err := parseYAML(data, &config); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	// 构建预览信息
	preview := &DocumentPreview{
		Title:       config.Title,
		ModuleCount: len(config.Modules),
		Author:      config.Author,
		Version:     config.Version,
		Date:        config.Date,
		Template:    config.Template,
	}

	// 如果没有标题，使用文档类型名称
	if preview.Title == "" {
		preview.Title = docTypeName
	}

	// 提取模块显示名称（最多5个）
	maxModules := 5
	if len(config.Modules) <= maxModules {
		preview.Modules = make([]string, len(config.Modules))
		for i, mod := range config.Modules {
			preview.Modules[i] = extractModuleDisplayName(mod)
		}
		preview.HasMore = false
	} else {
		preview.Modules = make([]string, maxModules)
		for i := 0; i < maxModules; i++ {
			preview.Modules[i] = extractModuleDisplayName(config.Modules[i])
		}
		preview.HasMore = true
	}

	return preview, nil
}

// ListDocumentTypesWithPreview 获取带预览的文档类型列表
func (s *DocumentService) ListDocumentTypesWithPreview(clientName string) ([]DocumentTypeWithPreview, error) {
	// 先获取基本文档类型列表
	docTypes, err := s.ListDocumentTypes(clientName)
	if err != nil {
		return nil, err
	}

	// 为每个文档类型添加预览信息
	result := make([]DocumentTypeWithPreview, len(docTypes))
	for i, dt := range docTypes {
		result[i] = DocumentTypeWithPreview{
			DocumentType: dt,
		}
		
		// 尝试获取预览信息（失败不影响整体）
		preview, err := s.GetDocumentPreview(clientName, dt.Name)
		if err == nil {
			result[i].Preview = preview
		}
	}

	return result, nil
}

// extractModuleDisplayName 从模块路径提取显示名称
func extractModuleDisplayName(modulePath string) string {
	// 获取文件名
	fileName := filepath.Base(modulePath)
	
	// 移除扩展名
	ext := filepath.Ext(fileName)
	name := strings.TrimSuffix(fileName, ext)
	
	// 移除数字前缀（如 "01-"）
	if len(name) > 3 && name[2] == '-' {
		// 检查前两个字符是否为数字
		if name[0] >= '0' && name[0] <= '9' && name[1] >= '0' && name[1] <= '9' {
			name = name[3:]
		}
	}
	
	return name
}

// parseYAML 解析 YAML 数据
func parseYAML(data []byte, v interface{}) error {
	// 使用 gopkg.in/yaml.v3
	return yaml.Unmarshal(data, v)
}
