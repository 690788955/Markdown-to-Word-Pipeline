// Package service 提供业务逻辑服务
package service

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ModuleInfo 文档模块信息
type ModuleInfo struct {
	FileName    string `json:"fileName"`    // 完整文件名，如 "01-概述.md"
	DisplayName string `json:"displayName"` // 显示名称，如 "概述"
	Order       int    `json:"order"`       // 排序序号
}

// ModuleService 模块服务
type ModuleService struct {
	srcDir string
}

// NewModuleService 创建模块服务实例
func NewModuleService(srcDir string) *ModuleService {
	return &ModuleService{
		srcDir: srcDir,
	}
}

// ListModules 获取所有可用模块
func (s *ModuleService) ListModules() ([]ModuleInfo, error) {
	entries, err := os.ReadDir(s.srcDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ModuleInfo{}, nil
		}
		return nil, err
	}

	var modules []ModuleInfo

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		ext := filepath.Ext(name)

		// 只处理 .md 文件
		if ext != ".md" {
			continue
		}

		// 解析文件名
		order, displayName := parseModuleFileName(name)

		modules = append(modules, ModuleInfo{
			FileName:    name,
			DisplayName: displayName,
			Order:       order,
		})
	}

	// 按数字前缀排序
	sort.Slice(modules, func(i, j int) bool {
		return modules[i].Order < modules[j].Order
	})

	return modules, nil
}

// parseModuleFileName 解析模块文件名，提取序号和显示名称
// 输入: "01-概述.md" -> 输出: (1, "概述")
// 输入: "概述.md" -> 输出: (0, "概述")
func parseModuleFileName(fileName string) (int, string) {
	// 去除扩展名
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	// 匹配数字前缀模式: XX-名称
	re := regexp.MustCompile(`^(\d+)-(.+)$`)
	matches := re.FindStringSubmatch(baseName)

	if len(matches) == 3 {
		order, _ := strconv.Atoi(matches[1])
		return order, matches[2]
	}

	// 没有数字前缀，返回原名称
	return 0, baseName
}

// GetModulePath 获取模块的完整路径（相对于项目根目录）
func (s *ModuleService) GetModulePath(fileName string) string {
	return "src/" + fileName
}
