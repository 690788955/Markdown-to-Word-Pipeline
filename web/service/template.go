// Package service 提供业务逻辑服务
package service

import (
	"os"
	"path/filepath"
	"strings"
)

// TemplateInfo 模板信息
type TemplateInfo struct {
	FileName    string `json:"fileName"`    // 文件名，如 "default.docx"
	DisplayName string `json:"displayName"` // 显示名称，如 "default"
}

// TemplateService 模板服务
type TemplateService struct {
	templatesDir string
}

// NewTemplateService 创建模板服务实例
func NewTemplateService(templatesDir string) *TemplateService {
	return &TemplateService{
		templatesDir: templatesDir,
	}
}

// ListTemplates 获取所有可用模板
func (s *TemplateService) ListTemplates() ([]TemplateInfo, error) {
	entries, err := os.ReadDir(s.templatesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []TemplateInfo{}, nil
		}
		return nil, err
	}

	var templates []TemplateInfo

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))

		// 只处理 .docx 文件
		if ext != ".docx" {
			continue
		}

		templates = append(templates, TemplateInfo{
			FileName:    name,
			DisplayName: strings.TrimSuffix(name, filepath.Ext(name)),
		})
	}

	return templates, nil
}

// TemplateExists 检查模板是否存在
func (s *TemplateService) TemplateExists(fileName string) bool {
	templatePath := filepath.Join(s.templatesDir, fileName)
	info, err := os.Stat(templatePath)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

// GetDefaultTemplate 获取默认模板名称
func (s *TemplateService) GetDefaultTemplate() string {
	return "default.docx"
}
