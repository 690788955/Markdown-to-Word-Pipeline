// Package service 提供业务逻辑服务
package service

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// PdfOptions PDF 输出选项
type PdfOptions struct {
	Mainfont            string  `json:"mainfont,omitempty" yaml:"mainfont,omitempty"`
	Monofont            string  `json:"monofont,omitempty" yaml:"monofont,omitempty"`
	Fontsize            string  `json:"fontsize,omitempty" yaml:"fontsize,omitempty"`
	Linestretch         float64 `json:"linestretch,omitempty" yaml:"linestretch,omitempty"`
	Titlepage           bool    `json:"titlepage" yaml:"titlepage"`
	TitlepageColor      string  `json:"titlepage-color,omitempty" yaml:"titlepage-color,omitempty"`
	TitlepageTextColor  string  `json:"titlepage-text-color,omitempty" yaml:"titlepage-text-color,omitempty"`
	TitlepageRuleColor  string  `json:"titlepage-rule-color,omitempty" yaml:"titlepage-rule-color,omitempty"`
	Geometry            string  `json:"geometry,omitempty" yaml:"geometry,omitempty"`
	Papersize           string  `json:"papersize,omitempty" yaml:"papersize,omitempty"`
	TocOwnPage          bool    `json:"toc-own-page" yaml:"toc-own-page"`
	Colorlinks          bool    `json:"colorlinks" yaml:"colorlinks"`
	Linkcolor           string  `json:"linkcolor,omitempty" yaml:"linkcolor,omitempty"`
	Urlcolor            string  `json:"urlcolor,omitempty" yaml:"urlcolor,omitempty"`
	Listings            bool    `json:"listings" yaml:"listings"`
	ListingsNoPageBreak bool    `json:"listings-no-page-break" yaml:"listings-no-page-break"`
	CodeBlockFontSize   string  `json:"code-block-font-size,omitempty" yaml:"code-block-font-size,omitempty"`
	HeaderLeft          string  `json:"header-left,omitempty" yaml:"header-left,omitempty"`
	HeaderRight         string  `json:"header-right,omitempty" yaml:"header-right,omitempty"`
}

// CustomConfig 自定义配置
type CustomConfig struct {
	ClientName    string                 `json:"clientName"`              // 客户名称（目录名）
	DocTypeName   string                 `json:"docTypeName"`             // 文档类型名称（配置文件名）
	DisplayName   string                 `json:"displayName"`             // 显示名称
	Template      string                 `json:"template"`                // 模板文件名
	Modules       []string               `json:"modules"`                 // 模块列表（有序）
	PandocArgs    []string               `json:"pandocArgs"`              // Pandoc 参数
	OutputPattern string                 `json:"outputPattern"`           // 输出文件名模式
	PdfOptions    *PdfOptions            `json:"pdfOptions,omitempty"`    // PDF 输出选项
	Variables     map[string]interface{} `json:"variables,omitempty"`     // 变量值
}

// ConfigYAML 配置文件的 YAML 结构
type ConfigYAML struct {
	ClientName    string                 `yaml:"client_name"`
	Template      string                 `yaml:"template"`
	Modules       []string               `yaml:"modules"`
	PandocArgs    []string               `yaml:"pandoc_args"`
	OutputPattern string                 `yaml:"output_pattern"`
	PdfOptions    *PdfOptions            `yaml:"pdf_options,omitempty"`
	Variables     map[string]interface{} `yaml:"variables,omitempty"`
}

// ConfigManager 配置管理器
type ConfigManager struct {
	clientsDir string
}

// 自定义配置标记文件名
const customMarkerFile = ".custom"

// 非法字符正则表达式
var invalidNameChars = regexp.MustCompile(`[/\\:*?"<>|]`)

// NewConfigManager 创建配置管理器实例
func NewConfigManager(clientsDir string) *ConfigManager {
	return &ConfigManager{
		clientsDir: clientsDir,
	}
}

// IsCustomConfig 检查是否为自定义配置
func (m *ConfigManager) IsCustomConfig(clientName string) bool {
	markerPath := filepath.Join(m.clientsDir, clientName, customMarkerFile)
	_, err := os.Stat(markerPath)
	return err == nil
}

// validateClientName 验证客户名称
func (m *ConfigManager) validateClientName(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("客户名称不能为空")
	}
	if invalidNameChars.MatchString(name) {
		return fmt.Errorf("客户名称包含非法字符")
	}
	return nil
}

// validateDocTypeName 验证文档类型名称
func (m *ConfigManager) validateDocTypeName(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("文档类型名称不能为空")
	}
	if invalidNameChars.MatchString(name) {
		return fmt.Errorf("文档类型名称包含非法字符")
	}
	return nil
}

// validateModules 验证模块列表
func (m *ConfigManager) validateModules(modules []string) error {
	if len(modules) == 0 {
		return fmt.Errorf("请至少选择一个文档模块")
	}
	return nil
}

// CreateConfig 创建自定义配置
func (m *ConfigManager) CreateConfig(config CustomConfig) error {
	// 验证输入
	if err := m.validateClientName(config.ClientName); err != nil {
		return err
	}
	if err := m.validateDocTypeName(config.DocTypeName); err != nil {
		return err
	}
	if err := m.validateModules(config.Modules); err != nil {
		return err
	}

	clientDir := filepath.Join(m.clientsDir, config.ClientName)
	configPath := filepath.Join(clientDir, config.DocTypeName+".yaml")

	// 检查客户目录是否存在
	clientExists := false
	if info, err := os.Stat(clientDir); err == nil && info.IsDir() {
		clientExists = true
		// 如果客户存在但不是自定义配置，不允许在其下创建新配置
		if !m.IsCustomConfig(config.ClientName) {
			return fmt.Errorf("不能在预置客户下创建自定义配置")
		}
	}

	// 检查配置文件是否已存在
	if _, err := os.Stat(configPath); err == nil {
		return fmt.Errorf("文档类型已存在: %s", config.DocTypeName)
	}

	// 创建客户目录（如果不存在）
	if !clientExists {
		if err := os.MkdirAll(clientDir, 0755); err != nil {
			return fmt.Errorf("创建客户目录失败: %w", err)
		}

		// 创建自定义标记文件
		markerPath := filepath.Join(clientDir, customMarkerFile)
		if err := os.WriteFile(markerPath, []byte(""), 0644); err != nil {
			os.RemoveAll(clientDir)
			return fmt.Errorf("创建标记文件失败: %w", err)
		}

		// 创建 metadata.yaml
		if err := m.createMetadata(clientDir, config.DisplayName); err != nil {
			os.RemoveAll(clientDir)
			return fmt.Errorf("创建元数据文件失败: %w", err)
		}
	}

	// 设置默认值
	if config.Template == "" {
		config.Template = "default.docx"
	}
	if config.OutputPattern == "" {
		config.OutputPattern = "{client}_" + config.DocTypeName + "_{date}.docx"
	}

	// 生成配置文件
	if err := m.writeConfigFile(configPath, config); err != nil {
		// 如果是新创建的客户目录，清理
		if !clientExists {
			os.RemoveAll(clientDir)
		}
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	return nil
}

// createMetadata 创建 metadata.yaml 文件
func (m *ConfigManager) createMetadata(clientDir, displayName string) error {
	content := fmt.Sprintf(`---
title: "%s文档"
subtitle: "自定义配置"
author: "运维团队"
date: "%s"
version: "v1.0"

client:
  name: "%s"
  contact: ""
  system: ""
---
`, displayName, time.Now().Format("2006年1月"), displayName)

	metadataPath := filepath.Join(clientDir, "metadata.yaml")
	return os.WriteFile(metadataPath, []byte(content), 0644)
}

// writeConfigFile 写入配置文件
func (m *ConfigManager) writeConfigFile(path string, config CustomConfig) error {
	yamlConfig := ConfigYAML{
		ClientName:    config.DisplayName,
		Template:      config.Template,
		Modules:       config.Modules,
		PandocArgs:    config.PandocArgs,
		OutputPattern: config.OutputPattern,
		PdfOptions:    config.PdfOptions,
		Variables:     config.Variables,
	}

	// 如果 PandocArgs 为空，设置默认值
	if len(yamlConfig.PandocArgs) == 0 {
		yamlConfig.PandocArgs = []string{
			"--toc",
			"--toc-depth=3",
			"--number-sections",
			"--standalone",
			"--highlight-style=tango",
		}
	}

	data, err := yaml.Marshal(yamlConfig)
	if err != nil {
		return err
	}

	// 添加注释头
	content := fmt.Sprintf("# %s 配置\n# 自定义生成\n\n%s", config.DocTypeName, string(data))
	return os.WriteFile(path, []byte(content), 0644)
}

// GetConfig 获取配置详情
func (m *ConfigManager) GetConfig(clientName, docTypeName string) (*CustomConfig, error) {
	configPath := filepath.Join(m.clientsDir, clientName, docTypeName+".yaml")

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("配置不存在: %s/%s", clientName, docTypeName)
		}
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	var yamlConfig ConfigYAML
	if err := yaml.Unmarshal(data, &yamlConfig); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	return &CustomConfig{
		ClientName:    clientName,
		DocTypeName:   docTypeName,
		DisplayName:   yamlConfig.ClientName,
		Template:      yamlConfig.Template,
		Modules:       yamlConfig.Modules,
		PandocArgs:    yamlConfig.PandocArgs,
		OutputPattern: yamlConfig.OutputPattern,
		PdfOptions:    yamlConfig.PdfOptions,
		Variables:     yamlConfig.Variables,
	}, nil
}

// UpdateConfig 更新自定义配置
func (m *ConfigManager) UpdateConfig(clientName, docTypeName string, config CustomConfig) error {
	// 检查是否为自定义配置
	if !m.IsCustomConfig(clientName) {
		return fmt.Errorf("不能修改预置配置")
	}

	configPath := filepath.Join(m.clientsDir, clientName, docTypeName+".yaml")

	// 检查配置是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("配置不存在: %s/%s", clientName, docTypeName)
	}

	// 验证输入
	if err := m.validateModules(config.Modules); err != nil {
		return err
	}

	// 更新配置
	config.ClientName = clientName
	config.DocTypeName = docTypeName

	return m.writeConfigFile(configPath, config)
}

// DeleteConfig 删除自定义配置
func (m *ConfigManager) DeleteConfig(clientName, docTypeName string) error {
	// 检查是否为自定义配置
	if !m.IsCustomConfig(clientName) {
		return fmt.Errorf("不能删除预置配置")
	}

	configPath := filepath.Join(m.clientsDir, clientName, docTypeName+".yaml")

	// 检查配置是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("配置不存在: %s/%s", clientName, docTypeName)
	}

	// 删除配置文件
	if err := os.Remove(configPath); err != nil {
		return fmt.Errorf("删除配置文件失败: %w", err)
	}

	// 检查是否还有其他配置文件
	clientDir := filepath.Join(m.clientsDir, clientName)
	hasOtherConfigs := false

	entries, err := os.ReadDir(clientDir)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			ext := filepath.Ext(name)
			baseName := strings.TrimSuffix(name, ext)
			// 检查是否有其他 yaml 配置文件（排除 metadata.yaml 和 .custom）
			if (ext == ".yaml" || ext == ".yml") && baseName != "metadata" {
				hasOtherConfigs = true
				break
			}
		}
	}

	// 如果没有其他配置，删除整个客户目录
	if !hasOtherConfigs {
		if err := os.RemoveAll(clientDir); err != nil {
			return fmt.Errorf("删除客户目录失败: %w", err)
		}
	}

	return nil
}

// ListCustomConfigs 列出客户的所有自定义配置
func (m *ConfigManager) ListCustomConfigs(clientName string) ([]string, error) {
	clientDir := filepath.Join(m.clientsDir, clientName)

	entries, err := os.ReadDir(clientDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var configs []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := filepath.Ext(name)
		baseName := strings.TrimSuffix(name, ext)
		if (ext == ".yaml" || ext == ".yml") && baseName != "metadata" {
			configs = append(configs, baseName)
		}
	}

	return configs, nil
}
