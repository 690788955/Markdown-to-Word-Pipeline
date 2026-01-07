# 字体目录

此目录存放项目使用的字体文件，确保在任何环境下都能使用统一的字体。

## Word 文档字体

### 推荐字体

#### 思源宋体 (Source Han Serif) - 正文用
- 下载地址：https://github.com/adobe-fonts/source-han-serif/releases
- 选择：`SourceHanSerifSC-Regular.otf` (简体中文常规)
- 选择：`SourceHanSerifSC-Bold.otf` (简体中文粗体)

#### 思源黑体 (Source Han Sans) - 标题用
- 下载地址：https://github.com/adobe-fonts/source-han-sans/releases
- 选择：`SourceHanSansSC-Regular.otf` (简体中文常规)
- 选择：`SourceHanSansSC-Bold.otf` (简体中文粗体)

### 下载步骤

1. 访问上面的 GitHub 链接
2. 点击 Releases
3. 下载 OTF 格式的简体中文版本 (SC = Simplified Chinese)
4. 将 .otf 文件放到此目录

### 需要的字体文件

```
fonts/
├── SourceHanSansSC-Regular.otf    # 思源黑体-常规（标题）
├── SourceHanSansSC-Bold.otf       # 思源黑体-粗体（标题加粗）
├── SourceHanSerifSC-Regular.otf   # 思源宋体-常规（正文）
├── SourceHanSerifSC-Bold.otf      # 思源宋体-粗体（正文加粗）
└── README.md
```

## PDF 文档字体

PDF 输出使用 XeLaTeX 引擎，需要系统安装中文字体。

### 推荐字体：Noto Sans CJK

Noto Sans CJK 是 Google 和 Adobe 合作开发的开源中文字体，支持简体中文、繁体中文、日文、韩文。

**安装方法：**

```bash
# Debian/Ubuntu
sudo apt install fonts-noto-cjk

# macOS
brew install font-noto-sans-cjk

# Windows
# 下载地址: https://github.com/googlefonts/noto-cjk/releases
# 下载 NotoSansCJKsc-*.otf 文件，双击安装
```

### 备选字体

如果无法安装 Noto Sans CJK，可使用以下系统自带字体：

| 操作系统 | 字体名称 | 配置值 |
|---------|---------|--------|
| Windows | 微软雅黑 | `Microsoft YaHei` |
| Windows | 宋体 | `SimSun` |
| macOS | 苹方 | `PingFang SC` |
| macOS | 华文黑体 | `STHeiti` |
| Linux | 文泉驿微米黑 | `WenQuanYi Micro Hei` |

在 `metadata.yaml` 中配置：

```yaml
pdf_options:
  mainfont: "Microsoft YaHei"  # 或其他已安装的字体
  CJKmainfont: "Microsoft YaHei"
```

### 字体缺失排查

如果 PDF 生成时出现中文显示为方框或乱码：

1. **检查字体是否安装**
   ```bash
   # Linux/macOS
   fc-list | grep -i "noto\|cjk\|chinese"
   
   # Windows PowerShell
   Get-ChildItem C:\Windows\Fonts | Where-Object { $_.Name -match "noto|cjk|yah" }
   ```

2. **检查 PDF 依赖**
   ```bash
   # Linux/macOS
   ./bin/check-pdf-deps.sh
   
   # Windows
   .\bin\check-pdf-deps.ps1
   ```

3. **确认配置正确**
   - 检查 `metadata.yaml` 中的 `pdf_options.mainfont` 是否与已安装字体名称一致
   - 字体名称区分大小写

4. **刷新字体缓存**（Linux）
   ```bash
   fc-cache -fv
   ```

## 安装字体

### Windows
双击 .otf 文件 → 点击"安装"

或批量安装：
```powershell
# 以管理员身份运行
$fonts = Get-ChildItem -Path "fonts" -Filter "*.otf"
foreach ($font in $fonts) {
    Copy-Item $font.FullName "C:\Windows\Fonts\"
}
```

### Linux
```bash
mkdir -p ~/.local/share/fonts
cp fonts/*.otf ~/.local/share/fonts/
fc-cache -fv
```

### macOS
双击 .otf 文件 → 点击"安装字体"

## 在 Word 模板中使用

安装字体后，修改 `templates/default.docx` 的样式：

| 样式 | 字体 |
|------|------|
| Title, Heading 1-6 | 思源黑体 (Source Han Sans SC) |
| Body Text, First Paragraph | 思源宋体 (Source Han Serif SC) |
| Table | 思源宋体 (Source Han Serif SC) |
| Source Code | 等距更纱黑体 或 Consolas |

## 许可证

思源字体采用 SIL Open Font License 1.1，可免费商用。
