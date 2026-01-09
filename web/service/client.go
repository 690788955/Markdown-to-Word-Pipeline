// Package service 提供业务逻辑服务
package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Client 客户信息
type Client struct {
	Name        string    `json:"name"`        // 目录名
	DisplayName string    `json:"displayName"` // 显示名称
	ModifiedAt  time.Time `json:"modifiedAt"`  // 最后修改时间
	IsCustom    bool      `json:"isCustom"`    // 是否为自定义配置
	Locked      bool      `json:"locked"`      // 是否已锁定
}

// ClientMetadata 客户元数据（从 metadata.yaml 读取）
type ClientMetadata struct {
	Title    string `yaml:"title"`
	Subtitle string `yaml:"subtitle"`
	Author   string `yaml:"author"`
	Version  string `yaml:"version"`
	Client   struct {
		Name    string `yaml:"name"`
		Contact string `yaml:"contact"`
		System  string `yaml:"system"`
	} `yaml:"client"`
}

// ClientService 客户服务
type ClientService struct {
	clientsDir string
}

// NewClientService 创建客户服务实例
func NewClientService(clientsDir string) *ClientService {
	return &ClientService{
		clientsDir: clientsDir,
	}
}

// ListClients 获取所有客户列表
func (s *ClientService) ListClients() ([]Client, error) {
	entries, err := os.ReadDir(s.clientsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Client{}, nil
		}
		return nil, fmt.Errorf("读取客户目录失败: %w", err)
	}

	var clients []Client
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		clientDir := filepath.Join(s.clientsDir, entry.Name())
		
		// 检查是否有有效配置文件
		if !s.hasValidConfig(clientDir) {
			continue
		}

		// 获取客户信息
		client, err := s.getClientInfo(entry.Name(), clientDir)
		if err != nil {
			// 跳过无法读取的客户，但记录日志
			continue
		}

		clients = append(clients, *client)
	}

	return clients, nil
}

// GetClient 获取单个客户信息
func (s *ClientService) GetClient(name string) (*Client, error) {
	clientDir := filepath.Join(s.clientsDir, name)
	
	info, err := os.Stat(clientDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("客户不存在: %s", name)
		}
		return nil, fmt.Errorf("读取客户目录失败: %w", err)
	}

	if !info.IsDir() {
		return nil, fmt.Errorf("客户不存在: %s", name)
	}

	return s.getClientInfo(name, clientDir)
}

// ClientExists 检查客户是否存在
func (s *ClientService) ClientExists(name string) bool {
	clientDir := filepath.Join(s.clientsDir, name)
	info, err := os.Stat(clientDir)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// CreateClient 创建新客户
func (s *ClientService) CreateClient(name, displayName string) error {
	if s.ClientExists(name) {
		return fmt.Errorf("客户已存在: %s", name)
	}

	// 创建客户目录
	clientDir := filepath.Join(s.clientsDir, name)
	if err := os.MkdirAll(clientDir, 0755); err != nil {
		return fmt.Errorf("创建客户目录失败: %w", err)
	}

	// 复制 default 模板
	defaultDir := filepath.Join(s.clientsDir, "default")
	if err := s.copyDefaultTemplate(defaultDir, clientDir, name, displayName); err != nil {
		// 清理已创建的目录
		os.RemoveAll(clientDir)
		return fmt.Errorf("复制模板失败: %w", err)
	}

	return nil
}

// hasValidConfig 检查目录是否包含有效配置文件
func (s *ClientService) hasValidConfig(clientDir string) bool {
	// 检查是否有任何 .yaml 配置文件（除了 metadata.yaml）
	entries, err := os.ReadDir(clientDir)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) == ".yaml" && name != "metadata.yaml" {
			return true
		}
	}

	return false
}

// getClientInfo 获取客户信息
func (s *ClientService) getClientInfo(name, clientDir string) (*Client, error) {
	client := &Client{
		Name:        name,
		DisplayName: name, // 默认使用目录名
		IsCustom:    s.isCustomClient(clientDir),
		Locked:      s.isClientLocked(clientDir),
	}

	// 获取目录修改时间
	info, err := os.Stat(clientDir)
	if err == nil {
		client.ModifiedAt = info.ModTime()
	}

	// 尝试从 metadata.yaml 读取显示名称
	metadataPath := filepath.Join(clientDir, "metadata.yaml")
	metadata, err := s.readMetadata(metadataPath)
	if err == nil && metadata != nil {
		if metadata.Client.Name != "" {
			client.DisplayName = metadata.Client.Name
		} else if metadata.Title != "" {
			client.DisplayName = metadata.Title
		}
		
		// 更新修改时间为 metadata 文件的修改时间
		if metaInfo, err := os.Stat(metadataPath); err == nil {
			if metaInfo.ModTime().After(client.ModifiedAt) {
				client.ModifiedAt = metaInfo.ModTime()
			}
		}
	}

	return client, nil
}

// isCustomClient 检查是否为自定义客户
func (s *ClientService) isCustomClient(clientDir string) bool {
	markerPath := filepath.Join(clientDir, ".custom")
	_, err := os.Stat(markerPath)
	return err == nil
}

// isClientLocked 检查客户是否已锁定
func (s *ClientService) isClientLocked(clientDir string) bool {
	lockedPath := filepath.Join(clientDir, ".locked")
	_, err := os.Stat(lockedPath)
	return err == nil
}

// IsCustomClient 检查客户是否为自定义配置（公开方法）
func (s *ClientService) IsCustomClient(name string) bool {
	clientDir := filepath.Join(s.clientsDir, name)
	return s.isCustomClient(clientDir)
}

// readMetadata 读取元数据文件
func (s *ClientService) readMetadata(path string) (*ClientMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	var metadata ClientMetadata
	if err := yaml.Unmarshal(data, &metadata); err != nil {
		return nil, err
	}

	return &metadata, nil
}

// copyDefaultTemplate 复制默认模板到新客户目录
func (s *ClientService) copyDefaultTemplate(srcDir, dstDir, clientName, displayName string) error {
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		// 如果 default 目录不存在，创建基本配置
		return s.createBasicConfig(dstDir, clientName, displayName)
	}

	for _, entry := range entries {
		srcPath := filepath.Join(srcDir, entry.Name())
		dstPath := filepath.Join(dstDir, entry.Name())

		if entry.IsDir() {
			continue
		}

		// 复制文件
		if err := s.copyFile(srcPath, dstPath); err != nil {
			return err
		}
	}

	// 更新 metadata.yaml 中的客户名称
	metadataPath := filepath.Join(dstDir, "metadata.yaml")
	if err := s.updateMetadata(metadataPath, clientName, displayName); err != nil {
		// 非致命错误，继续
	}

	return nil
}

// createBasicConfig 创建基本配置文件
func (s *ClientService) createBasicConfig(clientDir, clientName, displayName string) error {
	// 创建默认文档配置（使用"默认文档.yaml"而不是"config.yaml"）
	configContent := fmt.Sprintf(`# %s 配置
client_name: "%s"
template: "default.docx"

modules:
  - src/metadata.yaml
  - src/01-概述.md

pandoc_args:
  - "--toc"
  - "--number-sections"
  - "--standalone"

output_pattern: "{client}_文档_{date}.docx"
`, displayName, displayName)

	configPath := filepath.Join(clientDir, "默认文档.yaml")
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		return err
	}

	// 创建 metadata.yaml
	metadataContent := fmt.Sprintf(`---
title: "%s文档"
subtitle: "为%s定制"
author: "运维团队"
date: "%s"
version: "v1.0"

client:
  name: "%s"
  contact: ""
  system: ""
---
`, displayName, displayName, time.Now().Format("2006年1月"), displayName)

	metadataPath := filepath.Join(clientDir, "metadata.yaml")
	return os.WriteFile(metadataPath, []byte(metadataContent), 0644)
}

// copyFile 复制文件
func (s *ClientService) copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// updateMetadata 更新元数据文件中的客户名称
func (s *ClientService) updateMetadata(path, clientName, displayName string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var metadata map[string]interface{}
	if err := yaml.Unmarshal(data, &metadata); err != nil {
		return err
	}

	// 更新客户信息
	if client, ok := metadata["client"].(map[string]interface{}); ok {
		client["name"] = displayName
	}
	metadata["title"] = displayName + "文档"
	metadata["subtitle"] = "为" + displayName + "定制"

	newData, err := yaml.Marshal(metadata)
	if err != nil {
		return err
	}

	// 添加 YAML 文档标记
	content := "---\n" + string(newData) + "---\n"
	return os.WriteFile(path, []byte(content), 0644)
}
