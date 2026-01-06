# Design Document

## Overview

本设计文档描述 Markdown 文档组合到 Word 输出的自动化构建系统。系统采用 Makefile 作为构建入口，Pandoc 作为文档转换引擎，支持多客户配置和 GitLab CI/CD 集成。

### 设计目标

1. **模块化**: 文档内容可拆分为独立模块，按需组合
2. **可配置**: 通过 YAML 配置文件控制构建行为
3. **可扩展**: 易于添加新客户配置和文档模板
4. **团队友好**: 清晰的项目结构，完善的文档说明

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      用户/GitLab CI                          │
│                           │                                  │
│                     make client=xxx                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Makefile                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 解析参数     │→│ 加载配置     │→│ 调用 Pandoc  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ src/*.md    │ │ clients/    │ │ templates/  │
    │ 文档模块     │ │ 客户配置     │ │ Word模板    │
    └─────────────┘ └─────────────┘ └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │ build/*.docx│
                    │ 输出文档     │
                    └─────────────┘
```

## Components and Interfaces

### 项目目录结构

```
project-root/
├── Makefile                    # 构建入口
├── README.md                   # 项目说明
├── CONTRIBUTING.md             # 协作规范
├── CHANGELOG.md                # 变更日志
├── .gitignore                  # Git 忽略规则
├── .gitlab-ci.yml              # GitLab CI 配置
│
├── src/                        # 文档源码目录
│   ├── metadata.yaml           # 默认元数据
│   ├── 00-cover.md             # 封面（可选）
│   ├── 01-introduction.md      # 第一章
│   ├── 02-content.md           # 第二章
│   ├── 03-appendix.md          # 附录
│   └── images/                 # 图片资源
│       └── logo.png
│
├── clients/                    # 客户配置目录
│   ├── default/                # 默认配置
│   │   ├── config.yaml         # 客户配置文件
│   │   └── metadata.yaml       # 客户元数据覆盖
│   ├── client-a/               # 客户 A
│   │   ├── config.yaml
│   │   └── metadata.yaml
│   └── client-b/               # 客户 B
│       ├── config.yaml
│       └── metadata.yaml
│
├── templates/                  # 模板目录
│   ├── default.docx            # 默认 Word 模板
│   ├── client-a.docx           # 客户 A 专用模板
│   └── client-b.docx           # 客户 B 专用模板
│
└── build/                      # 输出目录（自动生成）
    └── output.docx
```

### 配置文件格式

#### 客户配置文件 (clients/{client}/config.yaml)

```yaml
# 客户基本信息
client_name: "客户A公司"
template: "client-a.docx"

# 要包含的文档模块（按顺序）
modules:
  - src/metadata.yaml
  - src/01-introduction.md
  - src/02-content.md
  - src/03-appendix.md

# Pandoc 额外参数
pandoc_args:
  - "--toc"
  - "--number-sections"

# 输出文件名模式
output_pattern: "{client}_{title}_{version}_{date}.docx"
```

#### 元数据文件 (clients/{client}/metadata.yaml)

```yaml
---
title: "项目技术方案"
subtitle: "为客户A定制"
author: "技术团队"
date: "2026-01-06"
version: "v1.0"
lang: "zh-CN"
toc-title: "目录"

# 客户特定信息
client:
  name: "客户A公司"
  contact: "张经理"
  logo: "images/client-a-logo.png"
---
```

### Makefile 接口

| 命令 | 说明 |
|------|------|
| `make` | 使用默认配置构建 |
| `make client=client-a` | 使用客户 A 配置构建 |
| `make list-clients` | 列出所有可用客户配置 |
| `make list-modules` | 列出所有文档模块 |
| `make clean` | 清理构建产物 |
| `make help` | 显示帮助信息 |

## Data Models

### 构建配置模型

```
BuildConfig:
  client_name: string          # 客户名称
  template: string             # Word 模板文件名
  modules: string[]            # 文档模块路径列表
  pandoc_args: string[]        # Pandoc 额外参数
  output_pattern: string       # 输出文件名模式
```

### 元数据模型

```
Metadata:
  title: string                # 文档标题
  subtitle: string?            # 副标题（可选）
  author: string               # 作者
  date: string                 # 日期
  version: string              # 版本号
  lang: string                 # 语言代码
  toc-title: string            # 目录标题
  client: ClientInfo?          # 客户信息（可选）

ClientInfo:
  name: string                 # 客户公司名称
  contact: string?             # 联系人
  logo: string?                # Logo 路径
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 文档模块发现完整性

*For any* `src/` 目录包含的 Markdown 文件集合，Document_Builder 发现的模块列表应包含该目录下所有 `.md` 文件。

**Validates: Requirements 1.1**

### Property 2: YAML 元数据解析保真性

*For any* 包含有效 YAML front matter 的 Markdown 文件，解析后的元数据对象应与原始 YAML 内容等价（round-trip）。

**Validates: Requirements 1.2, 2.1**

### Property 3: 文档组合顺序一致性

*For any* 配置文件中指定的模块列表，组合后的文档内容顺序应与配置中的模块顺序严格一致。

**Validates: Requirements 2.2**

### Property 4: 元数据覆盖优先级

*For any* 同时存在默认元数据和客户元数据的情况，客户元数据中的字段应覆盖默认元数据中的同名字段，未覆盖的字段应保留默认值。

**Validates: Requirements 2.3, 8.1**

### Property 5: 客户配置加载正确性

*For any* `clients/` 目录下的客户配置，当指定该客户名称时，系统应加载对应目录下的 `config.yaml` 和 `metadata.yaml`。

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 6: 输出文件名模式替换

*For any* 有效的 `output_pattern` 和元数据组合，生成的文件名应正确替换所有占位符（{client}、{title}、{version}、{date}）。

**Validates: Requirements 8.2**

### Property 7: 图片相对路径解析

*For any* Markdown 文件中的相对图片路径，系统应将其解析为相对于 `src/` 目录的正确路径。

**Validates: Requirements 1.3**

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| 配置文件格式错误 | 输出 YAML 解析错误详情，终止构建 |
| 指定的客户配置不存在 | 输出可用客户列表，终止构建 |
| 模板文件不存在 | 输出错误信息，提示检查模板路径 |
| 图片文件不存在 | 输出警告信息，继续构建 |
| Pandoc 执行失败 | 输出 Pandoc 错误信息，终止构建 |
| 输出目录无写入权限 | 输出权限错误，终止构建 |

## Testing Strategy

### 测试方法

本项目采用双重测试策略：

1. **属性测试 (Property-Based Testing)**: 验证核心逻辑的通用正确性
2. **单元测试 (Unit Testing)**: 验证特定示例和边界情况

### 属性测试配置

- 测试框架: 根据实现语言选择（如 Python 使用 Hypothesis，Shell 脚本使用 BATS）
- 每个属性测试运行至少 100 次迭代
- 测试标签格式: **Feature: markdown-to-word-pipeline, Property {number}: {property_text}**

### 单元测试覆盖

| 测试类型 | 覆盖内容 |
|---------|---------|
| 配置解析测试 | YAML 配置文件解析、默认值处理 |
| 路径处理测试 | 相对路径解析、路径拼接 |
| 文件名生成测试 | 占位符替换、特殊字符处理 |
| 错误处理测试 | 各种错误场景的正确响应 |

### 集成测试

| 测试场景 | 验证内容 |
|---------|---------|
| 默认构建 | `make` 命令生成正确的 Word 文档 |
| 客户构建 | `make client=xxx` 使用正确的客户配置 |
| 清理构建 | `make clean` 正确删除构建产物 |
| CI 构建 | GitLab CI 正确执行构建并保存 artifacts |
