# Word 模板目录

此目录存放 Word 参考模板文件（.docx），用于定义输出文档的排版格式。

## 设置中文字体（重要！）

Pandoc 使用模板的**样式**来控制字体。请按以下步骤设置：

### 步骤 1：打开模板
用 Word 打开 `templates/default.docx`

### 步骤 2：修改样式
1. 点击 **开始** 选项卡
2. 在 **样式** 区域，右键点击要修改的样式
3. 选择 **修改**
4. 点击 **格式** → **字体**
5. 设置中文字体和西文字体

### 步骤 3：推荐字体设置

| 样式 | 中文字体 | 西文字体 | 字号 |
|------|----------|----------|------|
| Normal (正文) | 宋体/仿宋 | Times New Roman | 小四(12pt) |
| Heading 1 (标题1) | 黑体 | Arial | 小二(18pt) 加粗 |
| Heading 2 (标题2) | 黑体 | Arial | 三号(16pt) 加粗 |
| Heading 3 (标题3) | 黑体 | Arial | 小三(15pt) 加粗 |
| Heading 4 (标题4) | 黑体 | Arial | 四号(14pt) |
| Title (文档标题) | 黑体 | Arial | 小一(24pt) 加粗 |
| Subtitle (副标题) | 宋体 | Times New Roman | 三号(16pt) |
| Table (表格) | 宋体 | Times New Roman | 五号(10.5pt) |

### 步骤 4：保存模板
修改完成后保存文件。

### 需要修改的样式列表
- Normal (正文)
- Heading 1-4 (标题1-4)
- Title (文档标题)
- Subtitle (副标题)
- First Paragraph (首段)
- Body Text (正文文本)
- Table (表格)
- Block Text (引用)
- TOC Heading (目录标题)

## 创建模板

### 方法一：使用命令生成基础模板

```powershell
# Windows
.\build.ps1 -InitTemplate

# Linux/macOS
make init-template
```

### 方法二：手动创建

1. 创建一个新的 Word 文档
2. 设置所需的样式（标题、正文、目录等）
3. 保存为 `default.docx`

## 为不同客户使用不同模板

```yaml
# clients/某客户/config.yaml
template: "custom.docx"  # 使用自定义模板
```

1. 复制 `default.docx` 为 `客户名.docx`
2. 修改样式、页眉页脚、Logo 等
3. 在客户配置中引用

## 样式说明

| 样式名称 | 用途 |
|---------|------|
| Title | 文档标题 |
| Subtitle | 副标题 |
| Author | 作者信息 |
| Date | 日期 |
| Heading 1-4 | 各级标题 |
| Normal / Body Text | 正文 |
| Table | 表格样式 |
| TOC Heading | 目录标题 |
| Block Text | 引用块 |
| Source Code | 代码块 |
