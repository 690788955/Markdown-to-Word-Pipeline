// Package service 提供业务逻辑服务
package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// 资源文件相关常量
const (
	// 字体文件最大大小 (50MB)
	MaxFontFileSize = 50 * 1024 * 1024
	// 模板文件最大大小 (20MB)
	MaxTemplateFileSize = 20 * 1024 * 1024
)

// 支持的文件扩展名
var (
	// 支持的字体扩展名
	SupportedFontExtensions = []string{".ttf", ".otf", ".woff", ".woff2"}
	// 支持的模板扩展名
	SupportedTemplateExtensions = []string{".docx"}
)

// 文件名验证正则表达式
// 允许：字母、数字、中文、下划线、连字符、点
var validFilenameRegex = regexp.MustCompile(`^[\w\p{Han}\-\.]+$`)

// 非法字符正则表达式
var invalidFilenameChars = regexp.MustCompile(`[/\\:*?"<>|]`)

// ResourceInfo 资源文件信息
type ResourceInfo struct {
	Name        string `json:"name"`        // 文件名
	Size        int64  `json:"size"`        // 文件大小（字节）
	ModTime     string `json:"modTime"`     // ISO 8601 格式修改时间
	SizeDisplay string `json:"sizeDisplay"` // 人类可读的文件大小
}

// ResourceService 资源管理服务
type ResourceService struct {
	fontsDir     string
	templatesDir string
	clientsDir   string // 用于检查模板使用情况
}

// NewResourceService 创建资源服务
func NewResourceService(fontsDir, templatesDir, clientsDir string) *ResourceService {
	return &ResourceService{
		fontsDir:     fontsDir,
		templatesDir: templatesDir,
		clientsDir:   clientsDir,
	}
}


// ValidateFilename 验证文件名
func (s *ResourceService) ValidateFilename(filename string) error {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return fmt.Errorf("文件名不能为空")
	}

	// 检查非法字符
	if invalidFilenameChars.MatchString(filename) {
		return fmt.Errorf("文件名包含非法字符")
	}

	// 检查是否只包含允许的字符
	// 移除扩展名后检查基本名称
	baseName := strings.TrimSuffix(filename, filepath.Ext(filename))
	if baseName == "" {
		return fmt.Errorf("文件名不能为空")
	}

	// 检查路径遍历
	if strings.Contains(filename, "..") {
		return fmt.Errorf("文件名不能包含路径遍历字符")
	}

	return nil
}

// ValidateFontExtension 验证字体文件扩展名
func (s *ResourceService) ValidateFontExtension(filename string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, supported := range SupportedFontExtensions {
		if ext == supported {
			return nil
		}
	}
	return fmt.Errorf("不支持的字体格式，仅支持 %s", strings.Join(SupportedFontExtensions, ", "))
}

// ValidateTemplateExtension 验证模板文件扩展名
func (s *ResourceService) ValidateTemplateExtension(filename string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, supported := range SupportedTemplateExtensions {
		if ext == supported {
			return nil
		}
	}
	return fmt.Errorf("不支持的模板格式，仅支持 %s", strings.Join(SupportedTemplateExtensions, ", "))
}

// formatFileSize 格式化文件大小
func formatFileSize(size int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case size >= GB:
		return fmt.Sprintf("%.1f GB", float64(size)/float64(GB))
	case size >= MB:
		return fmt.Sprintf("%.1f MB", float64(size)/float64(MB))
	case size >= KB:
		return fmt.Sprintf("%.1f KB", float64(size)/float64(KB))
	default:
		return fmt.Sprintf("%d B", size)
	}
}

// isFontFile 检查是否为字体文件
func isFontFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, supported := range SupportedFontExtensions {
		if ext == supported {
			return true
		}
	}
	return false
}

// isTemplateFile 检查是否为模板文件
func isTemplateFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, supported := range SupportedTemplateExtensions {
		if ext == supported {
			return true
		}
	}
	return false
}


// ListFonts 获取字体文件列表
func (s *ResourceService) ListFonts() ([]ResourceInfo, error) {
	entries, err := os.ReadDir(s.fontsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ResourceInfo{}, nil
		}
		return nil, fmt.Errorf("读取字体目录失败: %w", err)
	}

	var fonts []ResourceInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		// 只返回支持的字体格式
		if !isFontFile(name) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		fonts = append(fonts, ResourceInfo{
			Name:        name,
			Size:        info.Size(),
			ModTime:     info.ModTime().Format(time.RFC3339),
			SizeDisplay: formatFileSize(info.Size()),
		})
	}

	// 确保返回空数组而不是nil
	if fonts == nil {
		fonts = []ResourceInfo{}
	}

	return fonts, nil
}

// ListTemplates 获取模板文件列表
func (s *ResourceService) ListTemplates() ([]ResourceInfo, error) {
	entries, err := os.ReadDir(s.templatesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ResourceInfo{}, nil
		}
		return nil, fmt.Errorf("读取模板目录失败: %w", err)
	}

	var templates []ResourceInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		// 只返回支持的模板格式
		if !isTemplateFile(name) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		templates = append(templates, ResourceInfo{
			Name:        name,
			Size:        info.Size(),
			ModTime:     info.ModTime().Format(time.RFC3339),
			SizeDisplay: formatFileSize(info.Size()),
		})
	}

	// 确保返回空数组而不是nil
	if templates == nil {
		templates = []ResourceInfo{}
	}

	return templates, nil
}


// UploadFont 上传字体文件
func (s *ResourceService) UploadFont(filename string, data io.Reader, size int64) error {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return err
	}

	// 验证扩展名
	if err := s.ValidateFontExtension(filename); err != nil {
		return err
	}

	// 验证文件大小
	if size > MaxFontFileSize {
		return fmt.Errorf("文件大小超过限制（最大 %s）", formatFileSize(MaxFontFileSize))
	}

	// 确保目录存在
	if err := os.MkdirAll(s.fontsDir, 0755); err != nil {
		return fmt.Errorf("创建字体目录失败: %w", err)
	}

	// 写入文件
	filePath := filepath.Join(s.fontsDir, filename)
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	_, err = io.Copy(file, data)
	if err != nil {
		os.Remove(filePath) // 清理失败的文件
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

// UploadTemplate 上传模板文件
func (s *ResourceService) UploadTemplate(filename string, data io.Reader, size int64) error {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return err
	}

	// 验证扩展名
	if err := s.ValidateTemplateExtension(filename); err != nil {
		return err
	}

	// 验证文件大小
	if size > MaxTemplateFileSize {
		return fmt.Errorf("文件大小超过限制（最大 %s）", formatFileSize(MaxTemplateFileSize))
	}

	// 确保目录存在
	if err := os.MkdirAll(s.templatesDir, 0755); err != nil {
		return fmt.Errorf("创建模板目录失败: %w", err)
	}

	// 写入文件
	filePath := filepath.Join(s.templatesDir, filename)
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	_, err = io.Copy(file, data)
	if err != nil {
		os.Remove(filePath) // 清理失败的文件
		return fmt.Errorf("写入文件失败: %w", err)
	}

	return nil
}

// FontExists 检查字体文件是否存在
func (s *ResourceService) FontExists(filename string) bool {
	filePath := filepath.Join(s.fontsDir, filename)
	_, err := os.Stat(filePath)
	return err == nil
}

// TemplateExists 检查模板文件是否存在
func (s *ResourceService) TemplateExists(filename string) bool {
	filePath := filepath.Join(s.templatesDir, filename)
	_, err := os.Stat(filePath)
	return err == nil
}

// DeleteFont 删除字体文件
func (s *ResourceService) DeleteFont(filename string) error {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return err
	}

	filePath := filepath.Join(s.fontsDir, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("字体文件不存在: %s", filename)
	}

	// 删除文件
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("删除字体文件失败: %w", err)
	}

	return nil
}

// DeleteTemplate 删除模板文件
func (s *ResourceService) DeleteTemplate(filename string) error {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return err
	}

	filePath := filepath.Join(s.templatesDir, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("模板文件不存在: %s", filename)
	}

	// 删除文件
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("删除模板文件失败: %w", err)
	}

	return nil
}

// DownloadTemplate 获取模板文件路径用于下载
func (s *ResourceService) DownloadTemplate(filename string) (string, error) {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return "", err
	}

	filePath := filepath.Join(s.templatesDir, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", fmt.Errorf("模板文件不存在: %s", filename)
	}

	return filePath, nil
}

// GetTemplateUsage 检查模板被哪些配置使用
func (s *ResourceService) GetTemplateUsage(filename string) ([]string, error) {
	var usedBy []string

	// 遍历客户目录
	clientEntries, err := os.ReadDir(s.clientsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return usedBy, nil
		}
		return nil, fmt.Errorf("读取客户目录失败: %w", err)
	}

	for _, clientEntry := range clientEntries {
		if !clientEntry.IsDir() {
			continue
		}

		clientName := clientEntry.Name()
		clientDir := filepath.Join(s.clientsDir, clientName)

		// 遍历客户目录下的配置文件
		configEntries, err := os.ReadDir(clientDir)
		if err != nil {
			continue
		}

		for _, configEntry := range configEntries {
			if configEntry.IsDir() {
				continue
			}

			configName := configEntry.Name()
			ext := filepath.Ext(configName)
			if ext != ".yaml" && ext != ".yml" {
				continue
			}

			// 跳过 metadata.yaml
			if configName == "metadata.yaml" {
				continue
			}

			// 读取配置文件检查 template 字段
			configPath := filepath.Join(clientDir, configName)
			content, err := os.ReadFile(configPath)
			if err != nil {
				continue
			}

			// 简单检查是否包含模板引用
			contentStr := string(content)
			if strings.Contains(contentStr, "template:") {
				// 检查是否引用了指定的模板
				if strings.Contains(contentStr, filename) {
					docTypeName := strings.TrimSuffix(configName, ext)
					usedBy = append(usedBy, clientName+"/"+docTypeName)
				}
			}
		}
	}

	return usedBy, nil
}
