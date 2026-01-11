// Package service 提供编辑器服务
package service

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// 编辑器错误代码
var (
	ErrFileNotFound    = errors.New("模块文件不存在")
	ErrPathForbidden   = errors.New("禁止访问该路径")
	ErrInvalidFileType = errors.New("只允许操作 .md 文件")
	ErrFileExists      = errors.New("文件已存在")
	ErrInvalidFilename = errors.New("文件名包含非法字符")
	ErrReadError       = errors.New("文件读取失败")
	ErrWriteError      = errors.New("文件写入失败")
)

// ModuleContent 模块内容
type ModuleContent struct {
	Path         string    `json:"path"`
	Content      string    `json:"content"`
	LastModified time.Time `json:"lastModified"`
}

// EditorService 编辑器服务
type EditorService struct {
	srcDir string
}

// NewEditorService 创建编辑器服务
func NewEditorService(srcDir string) *EditorService {
	return &EditorService{
		srcDir: srcDir,
	}
}

// ValidatePath 验证路径安全性
// 参数: modulePath - 文件路径（可以是 "src/xxx.md" 或 "xxx.md" 格式）
// 返回: 清理后的安全绝对路径和错误
func (s *EditorService) ValidatePath(modulePath string) (string, error) {
	// 检查路径是否包含 ..
	if strings.Contains(modulePath, "..") {
		log.Printf("[Editor] 检测到路径遍历尝试: %s", modulePath)
		return "", ErrPathForbidden
	}

	// 检查是否以 .md 结尾
	if !strings.HasSuffix(strings.ToLower(modulePath), ".md") {
		return "", ErrInvalidFileType
	}

	// 清理路径
	cleanPath := filepath.Clean(modulePath)
	
	// 如果路径以 "src/" 开头，去掉这个前缀（因为 srcDir 已经是 src 目录）
	cleanPath = strings.TrimPrefix(cleanPath, "src/")
	cleanPath = strings.TrimPrefix(cleanPath, "src\\") // Windows 兼容
	
	// 构建绝对路径
	absPath := filepath.Join(s.srcDir, cleanPath)
	
	// 确保路径在 srcDir 内
	absPath, err := filepath.Abs(absPath)
	if err != nil {
		return "", ErrPathForbidden
	}
	
	absSrcDir, err := filepath.Abs(s.srcDir)
	if err != nil {
		return "", ErrPathForbidden
	}
	
	// 确保路径以 srcDir 开头
	if !strings.HasPrefix(absPath, absSrcDir) {
		log.Printf("[Editor] 路径超出 src 目录: %s", modulePath)
		return "", ErrPathForbidden
	}

	return absPath, nil
}

// ValidateFilename 验证文件名是否合法
// 参数: filename - 文件名（不含路径）
// 返回: 错误
func (s *EditorService) ValidateFilename(filename string) error {
	// 检查非法字符
	invalidChars := []string{"/", "\\", "..", "\x00"}
	for _, char := range invalidChars {
		if strings.Contains(filename, char) {
			return ErrInvalidFilename
		}
	}
	
	// 检查文件名是否为空
	if strings.TrimSpace(filename) == "" {
		return ErrInvalidFilename
	}
	
	return nil
}


// ReadModule 读取模块内容
// 参数: modulePath - 相对于 src/ 的文件路径
// 返回: 模块内容和错误
func (s *EditorService) ReadModule(modulePath string) (*ModuleContent, error) {
	// 验证路径
	absPath, err := s.ValidatePath(modulePath)
	if err != nil {
		return nil, err
	}

	// 检查文件是否存在
	info, err := os.Stat(absPath)
	if os.IsNotExist(err) {
		return nil, ErrFileNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrReadError, err)
	}

	// 读取文件内容
	content, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrReadError, err)
	}

	return &ModuleContent{
		Path:         modulePath,
		Content:      string(content),
		LastModified: info.ModTime(),
	}, nil
}

// SaveModule 保存模块内容
// 参数: modulePath - 相对于 src/ 的文件路径, content - 文件内容
// 返回: 错误
func (s *EditorService) SaveModule(modulePath string, content string) error {
	// 验证路径
	absPath, err := s.ValidatePath(modulePath)
	if err != nil {
		return err
	}

	// 检查文件是否存在（只允许编辑已存在的文件）
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return ErrFileNotFound
	}

	// 写入文件
	if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 文件已保存: %s", modulePath)
	return nil
}

// CreateModule 创建新模块
// 参数: modulePath - 相对于 src/ 的文件路径
// 返回: 错误
func (s *EditorService) CreateModule(modulePath string) error {
	// 提取文件名进行验证
	filename := filepath.Base(modulePath)
	if err := s.ValidateFilename(filename); err != nil {
		return err
	}

	// 验证路径
	absPath, err := s.ValidatePath(modulePath)
	if err != nil {
		return err
	}

	// 检查文件是否已存在
	if _, err := os.Stat(absPath); err == nil {
		return ErrFileExists
	}

	// 确保目录存在
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	// 创建空文件
	if err := os.WriteFile(absPath, []byte(""), 0644); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 文件已创建: %s", modulePath)
	return nil
}

// GetSrcDir 获取 src 目录路径
func (s *EditorService) GetSrcDir() string {
	return s.srcDir
}
