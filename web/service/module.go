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
	FileName    string `json:"fileName"`    // 文件名，如 "01-概述.md"
	DisplayName string `json:"displayName"` // 显示名称，如 "概述"
	Path        string `json:"path"`        // 相对路径，如 "src/运维/01-概述.md"
	Directory   string `json:"directory"`   // 所属目录，如 "运维" 或 "" (根目录)
	Order       int    `json:"order"`       // 排序序号
}

// DirectoryInfo 目录信息
type DirectoryInfo struct {
	Name        string       `json:"name"`        // 目录名，如 "运维"
	DisplayName string       `json:"displayName"` // 显示名称（去除数字前缀）
	Path        string       `json:"path"`        // 相对路径，如 "src/运维"
	Order       int          `json:"order"`       // 排序序号
	Modules     []ModuleInfo `json:"modules"`     // 目录下的模块
}

// ModuleTree 模块树形结构
type ModuleTree struct {
	RootModules []ModuleInfo    `json:"rootModules"` // 根目录下的模块
	Directories []DirectoryInfo `json:"directories"` // 子目录列表
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

// 需要忽略的目录
var ignoredDirs = map[string]bool{
	"images": true,
	".git":   true,
}

// ListModules 获取所有可用模块（扁平列表，兼容旧版）
func (s *ModuleService) ListModules() ([]ModuleInfo, error) {
	tree, err := s.ListModulesWithTree()
	if err != nil {
		return nil, err
	}

	// 将树形结构转换为扁平列表
	var modules []ModuleInfo
	modules = append(modules, tree.RootModules...)
	for _, dir := range tree.Directories {
		modules = append(modules, dir.Modules...)
	}

	return modules, nil
}

// ListModulesWithTree 获取所有可用模块（树形结构）
func (s *ModuleService) ListModulesWithTree() (*ModuleTree, error) {
	tree := &ModuleTree{
		RootModules: []ModuleInfo{},
		Directories: []DirectoryInfo{},
	}

	entries, err := os.ReadDir(s.srcDir)
	if err != nil {
		if os.IsNotExist(err) {
			return tree, nil
		}
		return nil, err
	}

	for _, entry := range entries {
		name := entry.Name()

		if entry.IsDir() {
			// 跳过忽略的目录
			if ignoredDirs[name] {
				continue
			}

			// 扫描子目录
			dirInfo, err := s.scanDirectory(name)
			if err != nil {
				continue // 跳过无法读取的目录
			}
			if len(dirInfo.Modules) > 0 {
				tree.Directories = append(tree.Directories, *dirInfo)
			}
		} else {
			// 处理根目录下的文件
			ext := filepath.Ext(name)
			if ext != ".md" {
				continue
			}

			order, displayName := parseModuleFileName(name)
			tree.RootModules = append(tree.RootModules, ModuleInfo{
				FileName:    name,
				DisplayName: displayName,
				Path:        "src/" + name,
				Directory:   "",
				Order:       order,
			})
		}
	}

	// 排序根目录模块
	sort.Slice(tree.RootModules, func(i, j int) bool {
		return tree.RootModules[i].Order < tree.RootModules[j].Order
	})

	// 排序子目录
	sort.Slice(tree.Directories, func(i, j int) bool {
		return tree.Directories[i].Order < tree.Directories[j].Order
	})

	return tree, nil
}


// scanDirectory 扫描子目录
func (s *ModuleService) scanDirectory(dirName string) (*DirectoryInfo, error) {
	dirPath := filepath.Join(s.srcDir, dirName)
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	order, displayName := parseDirectoryName(dirName)
	dirInfo := &DirectoryInfo{
		Name:        dirName,
		DisplayName: displayName,
		Path:        "src/" + dirName,
		Order:       order,
		Modules:     []ModuleInfo{},
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue // 暂不支持多级嵌套，只支持一级子目录
		}

		name := entry.Name()
		ext := filepath.Ext(name)
		if ext != ".md" {
			continue
		}

		moduleOrder, moduleDisplayName := parseModuleFileName(name)
		dirInfo.Modules = append(dirInfo.Modules, ModuleInfo{
			FileName:    name,
			DisplayName: moduleDisplayName,
			Path:        "src/" + dirName + "/" + name,
			Directory:   dirName,
			Order:       moduleOrder,
		})
	}

	// 排序模块
	sort.Slice(dirInfo.Modules, func(i, j int) bool {
		return dirInfo.Modules[i].Order < dirInfo.Modules[j].Order
	})

	return dirInfo, nil
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

// parseDirectoryName 解析目录名，提取序号和显示名称
// 输入: "01-运维" -> 输出: (1, "运维")
// 输入: "运维" -> 输出: (0, "运维")
func parseDirectoryName(dirName string) (int, string) {
	// 匹配数字前缀模式: XX-名称
	re := regexp.MustCompile(`^(\d+)-(.+)$`)
	matches := re.FindStringSubmatch(dirName)

	if len(matches) == 3 {
		order, _ := strconv.Atoi(matches[1])
		return order, matches[2]
	}

	// 没有数字前缀，返回原名称
	return 0, dirName
}

// GetModulePath 获取模块的完整路径（相对于项目根目录）
func (s *ModuleService) GetModulePath(fileName string) string {
	return "src/" + fileName
}
