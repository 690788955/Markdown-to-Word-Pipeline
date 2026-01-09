// Package config 提供应用配置管理
package config

import (
	"os"
	"path/filepath"
)

// Config 应用配置
type Config struct {
	// Port 服务端口
	Port string
	// ClientsDir 客户配置目录路径
	ClientsDir string
	// BuildDir 构建输出目录路径
	BuildDir string
	// TemplatesDir 模板目录路径
	TemplatesDir string
	// SrcDir 源文档目录路径
	SrcDir string
	// WorkDir 工作目录（项目根目录）
	WorkDir string
	// AdminPassword 管理密码（用于锁定/解锁配置）
	AdminPassword string
}

// DefaultConfig 返回默认配置
func DefaultConfig() *Config {
	workDir := getWorkDir()
	return &Config{
		Port:          getEnv("PORT", "8080"),
		ClientsDir:    filepath.Join(workDir, getEnv("CLIENTS_DIR", "clients")),
		BuildDir:      filepath.Join(workDir, getEnv("BUILD_DIR", "build")),
		TemplatesDir:  filepath.Join(workDir, getEnv("TEMPLATES_DIR", "templates")),
		SrcDir:        filepath.Join(workDir, getEnv("SRC_DIR", "src")),
		WorkDir:       workDir,
		AdminPassword: getEnv("ADMIN_PASSWORD", "admin123"),
	}
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getWorkDir 获取工作目录
func getWorkDir() string {
	// 优先使用环境变量
	if workDir := os.Getenv("WORK_DIR"); workDir != "" {
		return workDir
	}
	// 默认使用可执行文件所在目录的父目录
	exe, err := os.Executable()
	if err != nil {
		// 如果获取失败，使用当前目录
		return "."
	}
	// 假设可执行文件在 web/ 目录下，工作目录是其父目录
	return filepath.Dir(filepath.Dir(exe))
}
