# 运维文档生成系统 - Web 界面

基于 Go 语言开发的 Web 界面，用于生成运维文档。编译为单一可执行文件，无需安装运行时依赖。

## 功能特性

- 📋 选择客户配置，多选文档类型批量生成
- 📄 支持 Word 和 PDF 两种输出格式
- ✏️ 支持自定义客户名称（覆盖配置中的默认名称）
- 📥 在线下载生成的文档
- 🔄 动态读取配置，无需重启服务
- 🧹 自动清理 24 小时前的构建文件
- 🌙 支持深色模式
- 📱 响应式布局，支持移动端

## 快速开始

### 方式一：直接运行可执行文件

1. 下载对应平台的可执行文件
2. 将可执行文件放到项目根目录
3. 运行：

```bash
# Linux/macOS
./doc-generator-web

# Windows
doc-generator-web.exe
```

4. 打开浏览器访问 http://localhost:8080

### 方式二：从源码构建

```bash
# 进入 web 目录
cd web

# 构建
go build -o doc-generator-web .

# 运行（需要在项目根目录运行，或设置 WORK_DIR）
cd ..
./web/doc-generator-web
```

### 方式三：使用 Docker

```bash
# 构建镜像
docker build -t doc-generator-web -f web/Dockerfile .

# 运行容器
docker run -p 8080:8080 doc-generator-web
```

## 配置

通过环境变量配置：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `WORK_DIR` | 自动检测 | 项目根目录路径 |
| `CLIENTS_DIR` | `clients` | 客户配置目录 |
| `BUILD_DIR` | `build` | 构建输出目录 |

示例：

```bash
# 指定端口和工作目录
PORT=3000 WORK_DIR=/path/to/project ./doc-generator-web
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clients` | 获取客户列表 |
| GET | `/api/clients/{name}/docs` | 获取客户的文档类型列表 |
| POST | `/api/generate` | 生成文档（支持批量） |
| GET | `/api/download/{filename}` | 下载文档 |

### 生成文档请求

```bash
curl -X POST http://localhost:8080/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "clientConfig": "example-client",
    "documentTypes": ["运维手册", "部署手册"],
    "clientName": "某某公司",
    "format": "word"
  }'
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `clientConfig` | string | 是 | 客户配置目录名 |
| `documentTypes` | string[] | 是 | 要生成的文档类型列表 |
| `clientName` | string | 否 | 自定义客户名称（覆盖配置） |
| `format` | string | 否 | 输出格式：`word`（默认）或 `pdf` |

**响应示例：**

```json
{
  "success": true,
  "results": [
    {
      "documentType": "运维手册",
      "success": true,
      "filename": "某某公司_运维手册_v1.0_20260107.docx"
    }
  ]
}
```

### 下载文档

```bash
# 下载 Word 文档
curl -O http://localhost:8080/api/download/某某公司_运维手册_v1.0_20260107.docx

# 下载 PDF 文档
curl -O http://localhost:8080/api/download/某某公司_运维手册_v1.0_20260107.pdf
```

**Content-Type：**
- Word 文档：`application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- PDF 文档：`application/pdf`

### 示例请求

获取客户列表：
```bash
curl http://localhost:8080/api/clients
```

批量生成文档：
```bash
curl -X POST http://localhost:8080/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "clientConfig": "example-client",
    "documentTypes": ["运维手册", "部署手册"],
    "clientName": "某某公司"
  }'
```

## 跨平台构建

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o doc-generator-web-linux-amd64 .

# Windows
GOOS=windows GOARCH=amd64 go build -o doc-generator-web-windows-amd64.exe .

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -o doc-generator-web-darwin-amd64 .

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o doc-generator-web-darwin-arm64 .
```

## 项目结构

```
web/
├── main.go           # 入口文件
├── go.mod            # Go 模块定义
├── config/
│   └── config.go     # 配置管理
├── service/
│   ├── client.go     # 客户服务
│   ├── document.go   # 文档服务
│   └── build.go      # 构建服务
├── handler/
│   └── api.go        # API 处理器
├── static/
│   ├── index.html    # 主页面
│   ├── style.css     # 样式
│   └── app.js        # 前端逻辑
├── Dockerfile        # Docker 构建文件
└── README.md         # 本文档
```

## 依赖要求

运行时依赖（用于生成文档）：
- Pandoc
- Make（Linux/macOS）或 PowerShell（Windows）

PDF 输出额外依赖：
- XeLaTeX（TeX Live 或 MiKTeX）
- Eisvogel 模板
- 中文字体（Noto Sans CJK 推荐）

构建时依赖：
- Go 1.21+

### Docker 部署 PDF 支持

Docker 镜像已包含 PDF 生成所需的全部依赖：
- texlive-xetex
- Eisvogel 模板
- Noto Sans CJK 字体

直接使用 Docker 部署即可支持 PDF 输出，无需额外配置。

## 许可证

MIT License
