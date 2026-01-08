package service

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// PathFixService 路径修复服务
type PathFixService struct {
	workDir string
}

// NewPathFixService 创建路径修复服务
func NewPathFixService(workDir string) *PathFixService {
	return &PathFixService{
		workDir: workDir,
	}
}

// FixMarkdownPaths 修复 Markdown 文件中的图片路径
// 将 Windows 风格路径 (.\images\, .\assets\) 转换为跨平台路径 (images/, assets/)
func (s *PathFixService) FixMarkdownPaths(filePath string) error {
	// 读取文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取文件失败: %w", err)
	}

	originalContent := string(content)
	fixedContent := s.normalizeImagePaths(originalContent)

	// 如果内容没有变化，不需要写回
	if fixedContent == originalContent {
		return nil
	}

	// 写回文件
	if err := os.WriteFile(filePath, []byte(fixedContent), 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	log.Printf("[PathFix] 已修复路径: %s", filePath)
	return nil
}

// normalizeImagePaths 规范化图片路径
func (s *PathFixService) normalizeImagePaths(content string) string {
	// 匹配 Markdown 图片语法: ![alt](path)
	// 支持的路径格式:
	// - .\images\file.png  -> images/file.png
	// - ./images\file.png  -> images/file.png
	// - .\assets\file.png  -> assets/file.png
	// - ..\images\file.png -> ../images/file.png

	patterns := []struct {
		regex       *regexp.Regexp
		description string
	}{
		{
			// 匹配 .\path\to\file 格式
			regex:       regexp.MustCompile(`!\[([^\]]*)\]\(\.\\([^)]+)\)`),
			description: ".\\path\\file",
		},
		{
			// 匹配 ./path\to\file 格式（混合斜杠）
			regex:       regexp.MustCompile(`!\[([^\]]*)\]\(\.\/([^)\\]+)\\([^)]+)\)`),
			description: "./path\\file",
		},
		{
			// 匹配 ..\path\to\file 格式
			regex:       regexp.MustCompile(`!\[([^\]]*)\]\(\.\.\\([^)]+)\)`),
			description: "..\\path\\file",
		},
	}

	result := content

	for _, pattern := range patterns {
		result = pattern.regex.ReplaceAllStringFunc(result, func(match string) string {
			// 提取 alt 文本和路径
			submatches := pattern.regex.FindStringSubmatch(match)
			if len(submatches) < 2 {
				return match
			}

			alt := submatches[1]
			var path string

			if len(submatches) == 3 {
				// .\path 或 ..\path 格式
				path = submatches[2]
			} else if len(submatches) == 4 {
				// ./path\file 格式
				path = submatches[2] + "/" + submatches[3]
			}

			// 将所有反斜杠替换为正斜杠
			normalizedPath := strings.ReplaceAll(path, "\\", "/")

			// 处理 .. 开头的路径
			if strings.HasPrefix(match, "!["+alt+"](..\\") {
				return fmt.Sprintf("![%s](../%s)", alt, normalizedPath)
			}

			// 处理 . 开头的路径（移除 ./ 前缀）
			normalizedPath = strings.TrimPrefix(normalizedPath, "./")

			return fmt.Sprintf("![%s](%s)", alt, normalizedPath)
		})
	}

	return result
}

// FixAllMarkdownInDir 修复目录下所有 Markdown 文件的路径
func (s *PathFixService) FixAllMarkdownInDir(dir string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if info.IsDir() {
			return nil
		}

		// 只处理 .md 文件
		if !strings.HasSuffix(strings.ToLower(path), ".md") {
			return nil
		}

		// 修复路径
		if err := s.FixMarkdownPaths(path); err != nil {
			log.Printf("[PathFix] 警告: 修复文件失败 %s: %v", path, err)
			// 继续处理其他文件
		}

		return nil
	})
}

// ScanAndFixPaths 扫描并修复项目中的路径问题
func (s *PathFixService) ScanAndFixPaths() error {
	log.Printf("[PathFix] 开始扫描并修复路径...")

	// 修复 src 目录
	srcDir := filepath.Join(s.workDir, "src")
	if _, err := os.Stat(srcDir); err == nil {
		log.Printf("[PathFix] 扫描 src 目录: %s", srcDir)
		if err := s.FixAllMarkdownInDir(srcDir); err != nil {
			return fmt.Errorf("修复 src 目录失败: %w", err)
		}
	}

	// 修复 clients 目录
	clientsDir := filepath.Join(s.workDir, "clients")
	if _, err := os.Stat(clientsDir); err == nil {
		log.Printf("[PathFix] 扫描 clients 目录: %s", clientsDir)
		if err := s.FixAllMarkdownInDir(clientsDir); err != nil {
			return fmt.Errorf("修复 clients 目录失败: %w", err)
		}
	}

	log.Printf("[PathFix] 路径修复完成")
	return nil
}

// CheckPathIssues 检查文件中的路径问题（不修复）
func (s *PathFixService) CheckPathIssues(filePath string) ([]string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var issues []string
	scanner := bufio.NewScanner(strings.NewReader(string(content)))
	lineNum := 0

	// 检测 Windows 风格路径的正则表达式
	windowsPathRegex := regexp.MustCompile(`!\[([^\]]*)\]\([^)]*\\[^)]*\)`)

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if windowsPathRegex.MatchString(line) {
			issues = append(issues, fmt.Sprintf("第 %d 行: %s", lineNum, line))
		}
	}

	return issues, nil
}
