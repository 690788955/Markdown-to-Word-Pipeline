# Word 模板目录

此目录存放 Word 样式模板文件（.docx），用于定义输出文档的排版格式。

## 创建模板

### 方法一：使用 Pandoc 生成基础模板

运行以下命令生成默认模板：

```bash
pandoc -o templates/default.docx --print-default-data-file reference.docx
```

或者使用 Makefile：

```bash
make init-template
```

### 方法二：手动创建

1. 创建一个新的 Word 文档
2. 设置所需的样式（标题、正文、目录等）
3. 保存为 `default.docx`

## 自定义样式

在 Word 中打开模板文件，修改以下样式：

| 样式名称 | 用途 |
|---------|------|
| Title | 文档标题 |
| Subtitle | 副标题 |
| Author | 作者信息 |
| Date | 日期 |
| Heading 1 | 一级标题 |
| Heading 2 | 二级标题 |
| Heading 3 | 三级标题 |
| Body Text | 正文 |
| Table | 表格样式 |
| TOC Heading | 目录标题 |

## 客户专属模板

为特定客户创建专属模板：

1. 复制 `default.docx` 为 `客户名.docx`
2. 修改样式、页眉页脚、Logo 等
3. 在客户配置中引用：`template: "客户名.docx"`
