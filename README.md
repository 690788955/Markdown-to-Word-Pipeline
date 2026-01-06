# 运维文档生成系统

一个自动化的运维文档构建系统，支持将 Markdown 文档模块组合并输出为 Word 格式，为不同客户/项目定制文档。

## 功能特性

- 📝 **模块化文档**: 将运维文档拆分为独立模块（架构、日常运维、故障处理等）
- 🎨 **多客户支持**: 为不同客户配置专属的文档组合和元数据
- 🔧 **自动化构建**: 通过命令一键生成 Word 文档
- 🌐 **Web 界面**: 提供可视化界面，选择客户和文档类型即可生成
- 🚀 **CI/CD 集成**: 支持 GitHub Actions / GitLab CI 自动构建

## 目录结构

```
project-root/
├── build.ps1                   # Windows 构建脚本
├── Makefile                    # Linux/macOS 构建入口
├── README.md                   # 项目说明
│
├── src/                        # 文档源码目录
│   ├── metadata.yaml           # 默认元数据
│   ├── 01-概述.md              # 概述
│   ├── 02-系统架构.md          # 系统架构
│   ├── 03-日常运维.md          # 日常运维
│   ├── 04-故障处理.md          # 故障处理
│   ├── 05-监控告警.md          # 监控告警
│   ├── 06-备份恢复.md          # 备份恢复
│   ├── 07-安全规范.md          # 安全规范
│   ├── 08-部署上线.md          # 部署上线
│   ├── 09-应急预案.md          # 应急预案
│   ├── 10-项目背景.md          # 项目背景
│   ├── 11-联系人.md            # 联系人信息
│   └── images/                 # 图片资源
│
├── clients/                    # 客户配置目录
│   ├── default/                # 默认配置
│   │   └── config.yaml
│   └── example-client/         # 示例客户
│       ├── config.yaml         # 文档配置
│       └── metadata.yaml       # 元数据覆盖
│
├── templates/                  # Word 模板目录
│   └── default.docx
│
├── scripts/                    # 构建脚本
│   └── build.sh
│
├── web/                        # Web 界面（Go）
│   ├── main.go                 # 入口文件
│   ├── static/                 # 前端资源
│   └── README.md               # Web 使用说明
│
└── build/                      # 输出目录
```

## 快速开始

### 1. 安装依赖

**Pandoc** (必需):
```bash
# Windows (PowerShell)
choco install pandoc

# Debian/Ubuntu
sudo apt install pandoc

# macOS
brew install pandoc
```

### 2. 构建文档

**Windows:**
```powershell
# 使用默认配置构建
.\build.ps1

# 指定客户构建
.\build.ps1 -Client example-client

# 查看帮助
.\build.ps1 -Help
```

**Linux/macOS:**
```bash
# 初始化
make init
make init-template

# 构建
make
make client=example-client
```

### 3. 查看输出

构建完成后，Word 文档保存在 `build/` 目录。

## Web 界面

除了命令行，还可以使用 Web 界面生成文档：

### 启动 Web 服务

```bash
# 进入 web 目录构建
cd web
go build -o doc-generator-web .

# 回到项目根目录运行
cd ..
./web/doc-generator-web      # Linux/macOS
web\doc-generator-web.exe    # Windows
```

访问 http://localhost:8080 即可使用。

### Web 功能

- 选择客户和文档类型
- 一键生成并下载文档
- 创建新客户配置
- 实时显示配置更新

详细说明见 [web/README.md](web/README.md)

## 常用命令

### Windows (PowerShell)

| 命令 | 说明 |
|------|------|
| `.\build.ps1` | 使用默认配置构建 |
| `.\build.ps1 -Client xxx` | 指定客户构建 |
| `.\build.ps1 -Client xxx -Doc 文档名` | 构建指定文档 |
| `.\build.ps1 -Client xxx -ListDocs` | 列出客户的文档类型 |
| `.\build.ps1 -Client xxx -BuildAll` | 构建客户所有文档 |
| `.\build.ps1 -ListClients` | 列出所有客户 |
| `.\build.ps1 -ListModules` | 列出所有文档模块 |
| `.\build.ps1 -Clean` | 清理构建目录 |
| `.\build.ps1 -InitTemplate` | 生成默认模板 |

### Linux/macOS (Make)

| 命令 | 说明 |
|------|------|
| `make` | 使用默认配置构建 |
| `make client=xxx` | 指定客户构建 |
| `make list-clients` | 列出所有客户 |
| `make list-modules` | 列出所有文档模块 |
| `make clean` | 清理构建目录 |
| `make init-template` | 生成默认模板 |
| `make help` | 显示帮助 |

## 添加新客户

1. 复制 `clients/example-client/` 目录
2. 重命名为客户名称
3. 修改 `config.yaml` 选择需要的章节
4. 修改 `metadata.yaml` 设置客户信息
5. 运行构建命令

## 一个客户多个文档

在客户目录下创建多个 `.yaml` 配置文件：

```
clients/某客户/
├── config.yaml       # 默认文档
├── metadata.yaml     # 共享元数据
├── 运维手册.yaml     # 运维手册配置
├── 应急预案.yaml     # 应急预案配置
└── 交接文档.yaml     # 交接文档配置
```

构建指定文档：
```powershell
.\build.ps1 -Client 某客户 -Doc 运维手册
.\build.ps1 -Client 某客户 -BuildAll  # 构建所有
```

## 文档模块说明

| 模块 | 内容 |
|------|------|
| 01-概述.md | 文档概述、适用范围、联系方式 |
| 02-系统架构.md | 系统架构、服务器清单、网络拓扑 |
| 03-日常运维.md | 日常巡检、常用命令、变更管理 |
| 04-故障处理.md | 故障分级、常见故障处理、复盘模板 |
| 05-监控告警.md | 监控体系、告警阈值、值班安排 |
| 06-备份恢复.md | 备份策略、恢复流程、演练计划 |
| 07-安全规范.md | 访问控制、安全检查、应急响应 |
| 08-部署上线.md | 部署流程、上线检查、回滚方案 |
| 09-应急预案.md | 应急预案、故障升级、灾难恢复 |
| 10-项目背景.md | 项目背景、业务说明、系统演进 |
| 11-联系人.md | 联系人清单、值班表、供应商信息 |

## 许可证

MIT License
