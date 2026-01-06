# 字体目录

此目录存放项目使用的字体文件，确保在任何环境下都能使用统一的字体。

## 推荐字体

### 思源宋体 (Source Han Serif) - 正文用
- 下载地址：https://github.com/adobe-fonts/source-han-serif/releases
- 选择：`SourceHanSerifSC-Regular.otf` (简体中文常规)
- 选择：`SourceHanSerifSC-Bold.otf` (简体中文粗体)

### 思源黑体 (Source Han Sans) - 标题用
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
