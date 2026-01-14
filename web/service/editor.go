// Package service 提供编辑器服务
package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// 支持的图片扩展名
var imageExtensions = []string{
	".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico",
}

const editorOrderFileName = ".editor-order.json"

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

// isImageFile 判断是否为图片文件
func isImageFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, imgExt := range imageExtensions {
		if ext == imgExt {
			return true
		}
	}
	return false
}

// sanitizeFilename 清理文件名，保留有效字符
// 有效字符: 字母、数字、下划线、中划线、点、中文字符
func sanitizeFilename(name string) string {
	// 使用正则表达式保留有效字符
	// 允许: 字母、数字、下划线、中划线、点、中文字符
	reg := regexp.MustCompile(`[^\p{L}\p{N}_\-.]`)
	sanitized := reg.ReplaceAllString(name, "_")
	
	// 合并连续的下划线
	for strings.Contains(sanitized, "__") {
		sanitized = strings.ReplaceAll(sanitized, "__", "_")
	}
	
	// 去除首尾下划线
	sanitized = strings.Trim(sanitized, "_")
	
	// 如果结果为空，返回默认名称
	if sanitized == "" {
		sanitized = "image"
	}
	
	return sanitized
}

// generateImageFilename 生成规范化的图片文件名
// 格式: YYYYMMDD_HHMMSS_sanitized_filename.ext
func generateImageFilename(originalName string) string {
	// 获取扩展名
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" {
		ext = ".png" // 默认扩展名
	}
	
	// 获取不含扩展名的文件名
	nameWithoutExt := strings.TrimSuffix(originalName, filepath.Ext(originalName))
	
	// 清理文件名
	sanitized := sanitizeFilename(nameWithoutExt)
	
	// 生成时间戳
	timestamp := time.Now().Format("20060102_150405")
	
	// 组合最终文件名
	return fmt.Sprintf("%s_%s%s", timestamp, sanitized, ext)
}

// generateUniqueFilename 生成唯一的文件名（处理冲突）
func generateUniqueFilename(dir, filename string) string {
	absPath := filepath.Join(dir, filename)
	
	// 如果文件不存在，直接返回
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return filename
	}
	
	// 文件存在，添加序号
	ext := filepath.Ext(filename)
	nameWithoutExt := strings.TrimSuffix(filename, ext)
	
	for i := 1; i <= 1000; i++ {
		newFilename := fmt.Sprintf("%s_%d%s", nameWithoutExt, i, ext)
		newPath := filepath.Join(dir, newFilename)
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			return newFilename
		}
	}
	
	// 极端情况：添加额外时间戳
	return fmt.Sprintf("%s_%d%s", nameWithoutExt, time.Now().UnixNano(), ext)
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
	orderMap, err := s.loadTreeOrder()
	if err != nil {
		log.Printf("[Editor] 读取排序配置失败: %v", err)
		orderMap = map[string][]string{}
	}

	root := &FileTreeNode{
		Name:     "src",
		Path:     "",
		Type:     "directory",
		Children: []*FileTreeNode{},
	}

	err = s.buildFileTree(s.srcDir, "", root, orderMap)
	if err != nil {
		return nil, err
	}

	return root, nil
}

// buildFileTree 递归构建文件树
func (s *EditorService) buildFileTree(basePath, relativePath string, parent *FileTreeNode, orderMap map[string][]string) error {
	fullPath := basePath
	if relativePath != "" {
		fullPath = filepath.Join(basePath, relativePath)
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return err
	}

	children := []*FileTreeNode{}
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
			if err := s.buildFileTree(basePath, childPath, node, orderMap); err != nil {
				log.Printf("[Editor] 读取目录失败 %s: %v", childPath, err)
				continue
			}
			children = append(children, node)
		} else if strings.HasSuffix(strings.ToLower(name), ".md") {
			node.Type = "file"
			children = append(children, node)
		} else if isImageFile(name) {
			// 支持图片文件显示在文件树中
			node.Type = "image"
			node.DisplayName = name // 图片文件显示完整文件名
			children = append(children, node)
		}
	}

	if len(children) > 0 {
		order := orderMap[relativePath]
		if len(order) > 0 {
			indexMap := make(map[string]int, len(order))
			for i, item := range order {
				indexMap[item] = i
			}
			sort.SliceStable(children, func(i, j int) bool {
				left, right := children[i], children[j]
				leftIndex, leftOk := indexMap[left.Name]
				rightIndex, rightOk := indexMap[right.Name]
				if leftOk && rightOk {
					return leftIndex < rightIndex
				}
				if leftOk != rightOk {
					return leftOk
				}
				if left.Type != right.Type {
					return left.Type == "directory"
				}
				return strings.Compare(left.Name, right.Name) < 0
			})
		} else {
			sort.SliceStable(children, func(i, j int) bool {
				if children[i].Type != children[j].Type {
					return children[i].Type == "directory"
				}
				return strings.Compare(children[i].Name, children[j].Name) < 0
			})
		}
	}

	parent.Children = children
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

// SaveTreeOrder 保存文件树排序
func (s *EditorService) SaveTreeOrder(parentPath string, order []string) error {
	cleanPath := path.Clean(strings.ReplaceAll(parentPath, "\\", "/"))
	if cleanPath == "." {
		cleanPath = ""
	}
	if strings.Contains(cleanPath, "..") || strings.HasPrefix(cleanPath, "/") {
		return ErrPathForbidden
	}

	orderMap, err := s.loadTreeOrder()
	if err != nil {
		return err
	}

	orderMap[cleanPath] = order
	return s.saveTreeOrder(orderMap)
}

func (s *EditorService) loadTreeOrder() (map[string][]string, error) {
	orderPath := filepath.Join(s.srcDir, editorOrderFileName)
	data, err := os.ReadFile(orderPath)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string][]string{}, nil
		}
		return nil, fmt.Errorf("%w: %v", ErrReadError, err)
	}

	if len(data) == 0 {
		return map[string][]string{}, nil
	}

	var orderMap map[string][]string
	if err := json.Unmarshal(data, &orderMap); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrReadError, err)
	}
	return orderMap, nil
}

func (s *EditorService) saveTreeOrder(orderMap map[string][]string) error {
	orderPath := filepath.Join(s.srcDir, editorOrderFileName)
	data, err := json.MarshalIndent(orderMap, "", "  ")
	if err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	if err := os.WriteFile(orderPath, data, 0644); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}
	return nil
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

// DeleteImage 删除图片文件
// 参数: imagePath - 相对于 src/ 的图片路径
// 返回: 错误
func (s *EditorService) DeleteImage(imagePath string) error {
	// 检查路径是否包含 ..
	if strings.Contains(imagePath, "..") {
		log.Printf("[Editor] 检测到路径遍历尝试: %s", imagePath)
		return ErrPathForbidden
	}

	// 检查是否是图片文件
	if !isImageFile(imagePath) {
		return ErrInvalidFileType
	}

	// 清理路径
	cleanPath := filepath.Clean(imagePath)
	cleanPath = strings.TrimPrefix(cleanPath, "src/")
	cleanPath = strings.TrimPrefix(cleanPath, "src\\")

	// 构建绝对路径
	absPath := filepath.Join(s.srcDir, cleanPath)
	absPath, err := filepath.Abs(absPath)
	if err != nil {
		return ErrPathForbidden
	}

	// 确保路径在 srcDir 内
	absSrcDir, err := filepath.Abs(s.srcDir)
	if err != nil {
		return ErrPathForbidden
	}
	if !strings.HasPrefix(absPath, absSrcDir) {
		log.Printf("[Editor] 路径超出 src 目录: %s", imagePath)
		return ErrPathForbidden
	}

	// 检查文件是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return ErrFileNotFound
	}

	// 删除文件
	if err := os.Remove(absPath); err != nil {
		return fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 图片已删除: %s", imagePath)
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
	
	// 生成规范化的文件名
	newFilename := generateImageFilename(filename)
	
	// 获取模块的绝对路径
	absStartPath, err := s.ValidatePath(modulePath)
	if err != nil {
		// 如果模块路径无效，回退到默认的 src/images
		log.Printf("[Editor] 模块路径无效，回退到默认目录: %v", err)
		return s.saveToGlobalImages(newFilename, content)
	}

	// 获取模块所在目录
	moduleDir := filepath.Dir(absStartPath)
	
	// 确保 images 目录存在
	imagesDir := filepath.Join(moduleDir, "images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	// 生成唯一文件名（处理冲突）
	finalFilename := generateUniqueFilename(imagesDir, newFilename)
	absPath := filepath.Join(imagesDir, finalFilename)

	// 写入文件
	if err := os.WriteFile(absPath, content, 0644); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	log.Printf("[Editor] 图片已保存: %s", absPath)
	
	// 返回相对于模块目录的路径，例如 "images/filename.png"
	relPath := "images/" + finalFilename
	
	return relPath, nil
}

// saveToGlobalImages 保存到全局 images 目录 (备用)
func (s *EditorService) saveToGlobalImages(filename string, content []byte) (string, error) {
	imagesDir := filepath.Join(s.srcDir, "images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}

	// 生成唯一文件名
	finalFilename := generateUniqueFilename(imagesDir, filename)
	absPath := filepath.Join(imagesDir, finalFilename)

	if err := os.WriteFile(absPath, content, 0644); err != nil {
		return "", fmt.Errorf("%w: %v", ErrWriteError, err)
	}
	
	log.Printf("[Editor] 图片已保存到全局目录: %s", absPath)
	return "images/" + finalFilename, nil
}
