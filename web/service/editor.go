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

// FileTreeNode 文件树节点
type FileTreeNode struct {
	Name        string          `json:"name"`
	Path        string          `json:"path"`
	Type        string          `json:"type"` // "file" or "directory"
	DisplayName string          `json:"displayName,omitempty"`
	Children    []*FileTreeNode `json:"children,omitempty"`
}

// GetFileTree 获取文件树
// 返回: 文件树根节点和错误
func (s *EditorService) GetFileTree() (*FileTreeNode, error) {
	root := &FileTreeNode{
		Name:     "src",
		Path:     "",
		Type:     "directory",
		Children: []*FileTreeNode{},
	}

	err := s.buildFileTree(s.srcDir, "", root)
	if err != nil {
		return nil, err
	}

	return root, nil
}

// buildFileTree 递归构建文件树
func (s *EditorService) buildFileTree(basePath, relativePath string, parent *FileTreeNode) error {
	fullPath := basePath
	if relativePath != "" {
		fullPath = filepath.Join(basePath, relativePath)
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		
		// 跳过隐藏文件和 .gitkeep
		if strings.HasPrefix(name, ".") {
			continue
		}

		childPath := name
		if relativePath != "" {
			childPath = relativePath + "/" + name
		}

		node := &FileTreeNode{
			Name:        name,
			Path:        childPath,
			DisplayName: extractDisplayName(name),
		}

		if entry.IsDir() {
			node.Type = "directory"
			node.Children = []*FileTreeNode{}
			if err := s.buildFileTree(basePath, childPath, node); err != nil {
				log.Printf("[Editor] 读取目录失败 %s: %v", childPath, err)
				continue
			}
			parent.Children = append(parent.Children, node)
		} else if strings.HasSuffix(strings.ToLower(name), ".md") {
			node.Type = "file"
			parent.Children = append(parent.Children, node)
		}
	}

	return nil
}

// extractDisplayName 从文件名提取显示名称（去除编号前缀）
func extractDisplayName(name string) string {
	// 去除 .md 后缀
	displayName := strings.TrimSuffix(name, ".md")
	
	// 去除编号前缀（如 "01-", "02-" 等）
	if len(displayName) > 3 && displayName[2] == '-' {
		if displayName[0] >= '0' && displayName[0] <= '9' &&
			displayName[1] >= '0' && displayName[1] <= '9' {
			displayName = displayName[3:]
		}
	}
	
	return displayName
}

// DeleteModule 删除模块
// 参数: modulePath - 相对于 src/ 的文件路径
// 返回: 错误
func (s *EditorService) DeleteModule(modulePath string) error {
	// 验证路径
	absPath, err := s.ValidatePath(modulePath)
	if err != nil {
		return err
	}

	// 检查文件是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return ErrFileNotFound
	}

	// 删除文件
	if err := os.Remove(absPath); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 文件已删除: %s", modulePath)
	return nil
}

// RenameModule 重命名模块
// 参数: oldPath - 原路径, newPath - 新路径
// 返回: 错误
func (s *EditorService) RenameModule(oldPath, newPath string) error {
	// 验证原路径
	absOldPath, err := s.ValidatePath(oldPath)
	if err != nil {
		return err
	}

	// 验证新路径
	absNewPath, err := s.ValidatePath(newPath)
	if err != nil {
		return err
	}

	// 检查原文件是否存在
	if _, err := os.Stat(absOldPath); os.IsNotExist(err) {
		return ErrFileNotFound
	}

	// 检查新文件是否已存在
	if _, err := os.Stat(absNewPath); err == nil {
		return ErrFileExists
	}

	// 确保目标目录存在
	dir := filepath.Dir(absNewPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	// 重命名文件
	if err := os.Rename(absOldPath, absNewPath); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 文件已重命名: %s -> %s", oldPath, newPath)
	return nil
}

// SaveImage 保存图片
// 参数: modulePath - 当前编辑的模块路径, filename - 文件名, content - 图片内容
// 返回: 相对路径(用于markdown引用)和错误
func (s *EditorService) SaveImage(modulePath string, filename string, content []byte) (string, error) {
	// 验证文件名
	if err := s.ValidateFilename(filename); err != nil {
		return "", err
	}
	
	// 获取模块的绝对路径
	absStartPath, err := s.ValidatePath(modulePath)
	if err != nil {
		// 如果模块路径无效，回退到默认的 src/images
		log.Printf("[Editor] 模块路径无效，回退到默认目录: %v", err)
		return s.saveToGlobalImages(filename, content)
	}

	// 获取模块所在目录
	moduleDir := filepath.Dir(absStartPath)
	
	// 确保 images 目录存在
	imagesDir := filepath.Join(moduleDir, "images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	absPath := filepath.Join(imagesDir, filename)

	// 如果文件已存在，添加时间戳避免覆盖
	if _, err := os.Stat(absPath); err == nil {
		ext := filepath.Ext(filename)
		name := strings.TrimSuffix(filename, ext)
		timestamp := time.Now().Format("20060102150405")
		filename = fmt.Sprintf("%s_%s%s", name, timestamp, ext)
		absPath = filepath.Join(imagesDir, filename)
	}

	// 写入文件
	if err := os.WriteFile(absPath, content, 0644); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 图片已保存: %s", absPath)
	
	// 返回相对于模块目录的路径，例如 "images/filename.png"
	// 这样 markdown 文件就是便携的（不包含上层目录信息）
	// absPath: .../src/sub/images/foo.png
	// moduleDir: .../src/sub
	// relPath: images/foo.png
	relPath, err := filepath.Rel(moduleDir, absPath)
	if err != nil {
		return "", err
	}

	// 统一分隔符为 /
	relPath = filepath.ToSlash(relPath)
	
	return relPath, nil
}

// saveToGlobalImages 保存到全局 images 目录 (备用)
func (s *EditorService) saveToGlobalImages(filename string, content []byte) (string, error) {
	imagesDir := filepath.Join(s.srcDir, "images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	absPath := filepath.Join(imagesDir, filename)
	
	if _, err := os.Stat(absPath); err == nil {
		ext := filepath.Ext(filename)
		name := strings.TrimSuffix(filename, ext)
		timestamp := time.Now().Format("20060102150405")
		filename = fmt.Sprintf("%s_%s%s", name, timestamp, ext)
		absPath = filepath.Join(imagesDir, filename)
	}

	if err := os.WriteFile(absPath, content, 0644); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}
	
	return "images/" + filename, nil
}
