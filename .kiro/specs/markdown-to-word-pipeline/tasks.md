# Implementation Plan: Markdown to Word Pipeline

## Overview

本实现计划将设计文档转化为可执行的编码任务。采用增量开发方式，从项目结构搭建开始，逐步实现配置解析、文档组合、Word 生成等核心功能，最后完成 GitLab CI 集成。

## Tasks

- [x] 1. 搭建项目基础结构
  - [x] 1.1 创建目录结构和基础文件
    - 创建 `src/`、`clients/`、`templates/`、`build/` 目录
    - 创建 `.gitignore` 文件，排除 `build/` 目录和临时文件
    - _Requirements: 6.1, 6.4_

  - [x] 1.2 创建 README.md 项目说明文档
    - 包含项目简介、目录结构说明、快速开始指南
    - 包含 Makefile 命令使用说明
    - 包含依赖安装说明（Pandoc、Make）
    - _Requirements: 6.2_

  - [x] 1.3 创建 CONTRIBUTING.md 协作规范文档
    - 包含分支命名规范、提交信息格式
    - 包含文档模块编写规范
    - 包含客户配置添加流程
    - _Requirements: 6.3_

  - [x] 1.4 创建 CHANGELOG.md 变更日志模板
    - 使用 Keep a Changelog 格式
    - _Requirements: 8.3_

- [x] 2. 创建示例文档模块和配置
  - [x] 2.1 创建默认元数据文件 src/metadata.yaml
    - 包含 title、author、date、version、lang 等字段
    - _Requirements: 1.2, 8.1_

  - [x] 2.2 创建示例 Markdown 文档模块
    - 创建 `src/01-introduction.md` 示例章节
    - 创建 `src/02-content.md` 示例章节
    - 创建 `src/images/` 目录和示例图片占位说明
    - _Requirements: 1.1, 1.3_

  - [x] 2.3 创建默认客户配置
    - 创建 `clients/default/config.yaml` 配置文件
    - 创建 `clients/default/metadata.yaml` 元数据覆盖文件
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.4 创建示例客户配置
    - 创建 `clients/example-client/config.yaml`
    - 创建 `clients/example-client/metadata.yaml`
    - _Requirements: 3.1, 3.2_

- [x] 3. 创建 Word 模板
  - [x] 3.1 创建默认 Word 模板
    - 创建 `templates/default.docx` 基础样式模板
    - 包含标题、正文、目录等基本样式
    - _Requirements: 4.2_

- [x] 4. 实现 Makefile 构建系统
  - [x] 4.1 创建 Makefile 基础框架
    - 定义配置变量（PROJECT、BUILD_DIR、PANDOC 等）
    - 实现 `dir` 目标创建输出目录
    - 实现 `clean` 目标清理构建产物
    - 实现 `help` 目标显示帮助信息
    - _Requirements: 5.1, 5.3_

  - [x] 4.2 实现客户配置加载逻辑
    - 支持 `client` 变量指定客户名称
    - 实现默认客户配置回退逻辑
    - 实现 `list-clients` 目标列出可用客户
    - _Requirements: 3.2, 5.2, 5.4_

  - [x] 4.3 实现文档组合和 Word 生成
    - 读取客户配置中的模块列表
    - 调用 Pandoc 组合文档并生成 Word
    - 应用客户指定的 Word 模板
    - 支持自动生成目录
    - _Requirements: 2.2, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.4 实现输出文件名模式替换
    - 支持 {client}、{title}、{version}、{date} 占位符
    - _Requirements: 8.2_

  - [x] 4.5 实现 list-modules 目标
    - 列出 src/ 目录下所有可用的文档模块
    - _Requirements: 1.1_

- [x] 5. Checkpoint - 本地构建验证
  - 确保 `make`、`make client=example-client`、`make clean` 命令正常工作
  - 确保生成的 Word 文档格式正确
  - 如有问题请询问用户

- [x] 6. 实现 GitLab CI/CD 集成
  - [x] 6.1 创建 .gitlab-ci.yml 配置文件
    - 定义构建阶段和 Docker 镜像（pandoc/latex 或类似镜像）
    - 配置主分支推送触发构建
    - 配置 artifacts 保存生成的 Word 文档
    - 支持通过 CI 变量指定客户名称
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7. 实现错误处理
  - [x] 7.1 添加配置文件验证
    - 检查客户配置文件是否存在
    - 检查模板文件是否存在
    - 输出明确的错误信息
    - _Requirements: 2.4, 3.4, 4.5_

  - [x] 7.2 添加图片路径警告
    - 检查 Markdown 中引用的图片是否存在
    - 输出警告但继续构建
    - _Requirements: 1.4_

- [x] 8. Final Checkpoint - 完整功能验证
  - 确保所有 Makefile 命令正常工作
  - 确保错误处理正确输出信息
  - 确保项目文档完整
  - 如有问题请询问用户

## Notes

- 本项目主要使用 Makefile 和 Shell 脚本实现，无需复杂的编程语言
- Word 模板需要手动创建或使用现有模板，Makefile 只负责调用
- GitLab CI 配置需要在 GitLab 环境中验证
- 属性测试可使用 BATS (Bash Automated Testing System) 实现
