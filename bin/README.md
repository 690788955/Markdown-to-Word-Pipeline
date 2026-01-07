# bin 目录 - 脚本文件

本目录包含项目的可执行脚本文件。

## 脚本说明

| 脚本 | 平台 | 说明 |
|------|------|------|
| `build.sh` | Linux/macOS | 文档构建主脚本，由 Makefile 调用 |
| `install-fonts.sh` | Linux/macOS | 字体安装脚本 |
| `install-fonts.ps1` | Windows | 字体安装脚本 |

## build.sh

文档构建的核心脚本，负责：
- 读取客户配置文件（YAML）
- 解析文档模块列表
- 调用 Pandoc 将 Markdown 转换为 Word 文档
- 处理元数据和模板

**用法**（通常通过 Makefile 调用）：

```bash
./bin/build.sh <客户名> [文档类型] [自定义客户名称]

# 示例
./bin/build.sh 标准文档              # 使用默认配置
./bin/build.sh 标准文档 运维手册      # 构建运维手册
./bin/build.sh 标准文档 运维手册 某某公司  # 使用自定义客户名称
```

**推荐使用 Makefile**：

```bash
make client=标准文档
make client=标准文档 doc=运维手册
make client=标准文档 client_name=某某公司
```

## install-fonts.sh / install-fonts.ps1

安装 `fonts/` 目录下的字体到系统，用于文档生成时使用自定义字体。

**Linux/macOS**：

```bash
./bin/install-fonts.sh
```

**Windows (PowerShell)**：

```powershell
.\bin\install-fonts.ps1
```

**或通过构建脚本**：

```bash
# Linux/macOS - 暂不支持
# Windows
.\build.ps1 -InstallFonts
```

## 注意事项

- Linux/macOS 下需要先赋予执行权限：`chmod +x bin/*.sh`
- 这些脚本需要在项目根目录下运行
- `build.sh` 依赖 Pandoc，请确保已安装
