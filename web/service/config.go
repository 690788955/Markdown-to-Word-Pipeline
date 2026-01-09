// Package service 提供业务逻辑服务
package service

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// PdfOptions PDF 输出选项
type PdfOptions struct {
	// 字体设置
	Mainfont    string `json:"mainfont,omitempty" yaml:"mainfont,omitempty"`
	Sansfont    string `json:"sansfont,omitempty" yaml:"sansfont,omitempty"`
	Monofont    string `json:"monofont,omitempty" yaml:"monofont,omitempty"`
	CJKmainfont string `json:"CJKmainfont,omitempty" yaml:"CJKmainfont,omitempty"`
	Fontsize    string `json:"fontsize,omitempty" yaml:"fontsize,omitempty"`
	Linestretch float64 `json:"linestretch,omitempty" yaml:"linestretch,omitempty"`

	// 封面设置
	Titlepage           bool   `json:"titlepage" yaml:"titlepage"`
	TitlepageColor      string `json:"titlepage-color,omitempty" yaml:"titlepage-color,omitempty"`
	TitlepageTextColor  string `json:"titlepage-text-color,omitempty" yaml:"titlepage-text-color,omitempty"`
	TitlepageRuleColor  string `json:"titlepage-rule-color,omitempty" yaml:"titlepage-rule-color,omitempty"`
	TitlepageRuleHeight int    `json:"titlepage-rule-height,omitempty" yaml:"titlepage-rule-height,omitempty"`

	// 页面设置
	Geometry    string `json:"geometry,omitempty" yaml:"geometry,omitempty"`
	Papersize   string `json:"papersize,omitempty" yaml:"papersize,omitempty"`
	Book        bool   `json:"book,omitempty" yaml:"book,omitempty"`
	Classoption string `json:"classoption,omitempty" yaml:"classoption,omitempty"`

	// 目录设置
	Toc        bool `json:"toc,omitempty" yaml:"toc,omitempty"`
	TocDepth   int  `json:"toc-depth,omitempty" yaml:"toc-depth,omitempty"`
	TocOwnPage bool `json:"toc-own-page" yaml:"toc-own-page"`

	// 链接设置
	Colorlinks bool   `json:"colorlinks" yaml:"colorlinks"`
	Linkcolor  string `json:"linkcolor,omitempty" yaml:"linkcolor,omitempty"`
	Urlcolor   string `json:"urlcolor,omitempty" yaml:"urlcolor,omitempty"`

	// 代码块设置
	Listings            bool   `json:"listings" yaml:"listings"`
	ListingsNoPageBreak bool   `json:"listings-no-page-break" yaml:"listings-no-page-break"`
	CodeBlockFontSize   string `json:"code-block-font-size,omitempty" yaml:"code-block-font-size,omitempty"`

	// 页眉页脚
	HeaderLeft   string `json:"header-left,omitempty" yaml:"header-left,omitempty"`
	HeaderRight  string `json:"header-right,omitempty" yaml:"header-right,omitempty"`
	FooterCenter string `json:"footer-center,omitempty" yaml:"footer-center,omitempty"`
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
	Metadata      *MetadataConfig        `json:"metadata,omitempty"`      // 元数据配置
}

// MetadataConfig 元数据配置
type MetadataConfig struct {
	Title         string        `json:"title,omitempty" yaml:"title,omitempty"`
	Subtitle      string        `json:"subtitle,omitempty" yaml:"subtitle,omitempty"`
	Author        string        `json:"author,omitempty" yaml:"author,omitempty"`
	Version       string        `json:"version,omitempty" yaml:"version,omitempty"`
	Date          string        `json:"date,omitempty" yaml:"date,omitempty"`
	TocTitle      string        `json:"tocTitle,omitempty" yaml:"toc-title,omitempty"`
	Client        *ClientInfo   `json:"client,omitempty" yaml:"client,omitempty"`
}

// ClientInfo 客户信息
type ClientInfo struct {
	Name    string `json:"name,omitempty" yaml:"name,omitempty"`
	Contact string `json:"contact,omitempty" yaml:"contact,omitempty"`
	System  string `json:"system,omitempty" yaml:"system,omitempty"`
}

// ConfigYAML 配置文件的 YAML 结构
type ConfigYAML struct {
	// 元数据字段（顶层，与构建脚本兼容）
	Title    string `yaml:"title,omitempty"`
	Subtitle string `yaml:"subtitle,omitempty"`
	Author   string `yaml:"author,omitempty"`
	Version  string `yaml:"version,omitempty"`
	Date     string `yaml:"date,omitempty"`
	TocTitle string `yaml:"toc-title,omitempty"`
	// 客户信息
	Client *ClientInfo `yaml:"client,omitempty"`
	// 配置字段
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

// 锁定标记文件名
const lockedMarkerFile = ".locked"

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

// IsClientLocked 检查客户配置是否已锁定
func (m *ConfigManager) IsClientLocked(clientName string) bool {
	lockedPath := filepath.Join(m.clientsDir, clientName, lockedMarkerFile)
	_, err := os.Stat(lockedPath)
	return err == nil
}

// LockClient 锁定客户配置
func (m *ConfigManager) LockClient(clientName string) error {
	clientDir := filepath.Join(m.clientsDir, clientName)
	if _, err := os.Stat(clientDir); os.IsNotExist(err) {
		return fmt.Errorf("客户不存在: %s", clientName)
	}
	
	lockedPath := filepath.Join(clientDir, lockedMarkerFile)
	return os.WriteFile(lockedPath, []byte(""), 0644)
}

// UnlockClient 解锁客户配置
func (m *ConfigManager) UnlockClient(clientName string) error {
	lockedPath := filepath.Join(m.clientsDir, clientName, lockedMarkerFile)
	if _, err := os.Stat(lockedPath); os.IsNotExist(err) {
		return nil // 本来就没锁定
	}
	return os.Remove(lockedPath)
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

	// 将元数据字段写入顶层（与构建脚本兼容）
	if config.Metadata != nil {
		yamlConfig.Title = config.Metadata.Title
		yamlConfig.Subtitle = config.Metadata.Subtitle
		yamlConfig.Author = config.Metadata.Author
		yamlConfig.Version = config.Metadata.Version
		yamlConfig.Date = config.Metadata.Date
		yamlConfig.TocTitle = config.Metadata.TocTitle
		yamlConfig.Client = config.Metadata.Client
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
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return err
	}

	return nil
}

// IsEmpty 检查元数据是否为空
func (m *MetadataConfig) IsEmpty() bool {
	if m == nil {
		return true
	}
	return m.Title == "" && m.Subtitle == "" && m.Author == "" && 
		m.Version == "" && m.Date == "" && m.TocTitle == "" && m.Client == nil
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

	// 从顶层字段构建元数据（文档级别元数据）
	var metadata *MetadataConfig
	if yamlConfig.Title != "" || yamlConfig.Subtitle != "" || yamlConfig.Author != "" ||
		yamlConfig.Version != "" || yamlConfig.Date != "" || yamlConfig.TocTitle != "" ||
		yamlConfig.Client != nil {
		metadata = &MetadataConfig{
			Title:    yamlConfig.Title,
			Subtitle: yamlConfig.Subtitle,
			Author:   yamlConfig.Author,
			Version:  yamlConfig.Version,
			Date:     yamlConfig.Date,
			TocTitle: yamlConfig.TocTitle,
			Client:   yamlConfig.Client,
		}
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
		Metadata:      metadata,
	}, nil
}

// UpdateConfig 更新配置
func (m *ConfigManager) UpdateConfig(clientName, docTypeName string, config CustomConfig) error {
	// 检查客户是否已锁定
	if m.IsClientLocked(clientName) {
		return fmt.Errorf("客户配置已锁定，请先解锁后再修改")
	}

	configPath := filepath.Join(m.clientsDir, clientName, docTypeName+".yaml")

	// 检查配置是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("配置不存在: %s/%s", clientName, docTypeName)
	}

	// 读取现有配置，以便保留前端未发送的字段
	existingConfig, err := m.GetConfig(clientName, docTypeName)
	if err != nil {
		return fmt.Errorf("读取现有配置失败: %w", err)
	}

	// 验证输入
	if err := m.validateModules(config.Modules); err != nil {
		return err
	}

	// 合并配置：前端发送的值优先，但保留前端未处理的字段
	mergedConfig := m.mergeConfigs(existingConfig, &config)
	mergedConfig.ClientName = clientName
	mergedConfig.DocTypeName = docTypeName

	return m.writeConfigFile(configPath, *mergedConfig)
}

// mergeConfigs 合并配置，newConfig 的非空值优先
func (m *ConfigManager) mergeConfigs(existing, newConfig *CustomConfig) *CustomConfig {
	result := &CustomConfig{
		ClientName:    newConfig.ClientName,
		DocTypeName:   newConfig.DocTypeName,
		DisplayName:   newConfig.DisplayName,
		Template:      newConfig.Template,
		Modules:       newConfig.Modules,
		PandocArgs:    newConfig.PandocArgs,
		OutputPattern: newConfig.OutputPattern,
		Variables:     newConfig.Variables,
		Metadata:      newConfig.Metadata,
	}

	// 如果 DisplayName 为空，使用现有的
	if result.DisplayName == "" && existing != nil {
		result.DisplayName = existing.DisplayName
	}

	// 如果 Template 为空，使用现有的
	if result.Template == "" && existing != nil {
		result.Template = existing.Template
	}

	// 如果 OutputPattern 为空，使用现有的
	if result.OutputPattern == "" && existing != nil {
		result.OutputPattern = existing.OutputPattern
	}

	// 合并 PDF 选项
	result.PdfOptions = m.mergePdfOptions(existing.PdfOptions, newConfig.PdfOptions)

	return result
}

// mergePdfOptions 合并 PDF 选项，保留前端未处理的字段
func (m *ConfigManager) mergePdfOptions(existing, newOpts *PdfOptions) *PdfOptions {
	if newOpts == nil && existing == nil {
		return nil
	}

	result := &PdfOptions{}

	// 如果有现有配置，先复制所有字段
	if existing != nil {
		*result = *existing
	}

	// 如果有新配置，用新值覆盖（但只覆盖前端实际设置的字段）
	if newOpts != nil {
		// 字体设置
		if newOpts.Mainfont != "" {
			result.Mainfont = newOpts.Mainfont
		}
		if newOpts.Sansfont != "" {
			result.Sansfont = newOpts.Sansfont
		}
		if newOpts.Monofont != "" {
			result.Monofont = newOpts.Monofont
		}
		if newOpts.CJKmainfont != "" {
			result.CJKmainfont = newOpts.CJKmainfont
		}
		if newOpts.Fontsize != "" {
			result.Fontsize = newOpts.Fontsize
		}
		if newOpts.Linestretch != 0 {
			result.Linestretch = newOpts.Linestretch
		}

		// 封面设置 - bool 类型直接覆盖
		result.Titlepage = newOpts.Titlepage
		if newOpts.TitlepageColor != "" {
			result.TitlepageColor = newOpts.TitlepageColor
		}
		if newOpts.TitlepageTextColor != "" {
			result.TitlepageTextColor = newOpts.TitlepageTextColor
		}
		if newOpts.TitlepageRuleColor != "" {
			result.TitlepageRuleColor = newOpts.TitlepageRuleColor
		}
		if newOpts.TitlepageRuleHeight != 0 {
			result.TitlepageRuleHeight = newOpts.TitlepageRuleHeight
		}

		// 页面设置
		if newOpts.Geometry != "" {
			result.Geometry = newOpts.Geometry
		}
		if newOpts.Papersize != "" {
			result.Papersize = newOpts.Papersize
		}
		// Book 和 Classoption 保留现有值（前端未处理）

		// 目录设置
		result.Toc = newOpts.Toc
		if newOpts.TocDepth != 0 {
			result.TocDepth = newOpts.TocDepth
		}
		result.TocOwnPage = newOpts.TocOwnPage

		// 链接设置
		result.Colorlinks = newOpts.Colorlinks
		if newOpts.Linkcolor != "" {
			result.Linkcolor = newOpts.Linkcolor
		}
		if newOpts.Urlcolor != "" {
			result.Urlcolor = newOpts.Urlcolor
		}

		// 代码块设置
		result.Listings = newOpts.Listings
		result.ListingsNoPageBreak = newOpts.ListingsNoPageBreak
		if newOpts.CodeBlockFontSize != "" {
			result.CodeBlockFontSize = newOpts.CodeBlockFontSize
		}

		// 页眉页脚
		if newOpts.HeaderLeft != "" {
			result.HeaderLeft = newOpts.HeaderLeft
		}
		if newOpts.HeaderRight != "" {
			result.HeaderRight = newOpts.HeaderRight
		}
		if newOpts.FooterCenter != "" {
			result.FooterCenter = newOpts.FooterCenter
		}
	}

	return result
}

// DeleteConfig 删除配置
func (m *ConfigManager) DeleteConfig(clientName, docTypeName string) error {
	// 检查是否为自定义配置（只有自定义配置可以删除）
	if !m.IsCustomConfig(clientName) {
		return fmt.Errorf("不能删除预置配置")
	}

	// 检查客户是否已锁定
	if m.IsClientLocked(clientName) {
		return fmt.Errorf("客户配置已锁定，请先解锁后再删除")
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


