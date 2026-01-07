# Word 模板目录

此目录存放 Word 参考模板文件（.docx），用于定义输出文档的排版格式。

## Pandoc Word 样式完整列表

以下是 Pandoc 生成 Word 文档时使用的所有样式，修改模板时需要调整这些样式：

### 标题样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Title | YAML `title:` | 文档标题 |
| Subtitle | YAML `subtitle:` | 副标题 |
| Author | YAML `author:` | 作者 |
| Date | YAML `date:` | 日期 |
| Abstract | YAML `abstract:` | 摘要 |
| Heading 1 | `# 标题` | 一级标题 |
| Heading 2 | `## 标题` | 二级标题 |
| Heading 3 | `### 标题` | 三级标题 |
| Heading 4 | `#### 标题` | 四级标题 |
| Heading 5 | `##### 标题` | 五级标题 |
| Heading 6 | `###### 标题` | 六级标题 |

### 正文样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Body Text | 普通段落 | 正文（非首段） |
| First Paragraph | 段落首段 | 标题后的第一段 |
| Compact | 紧凑列表段落 | 紧凑列表中的段落 |

### 引用和代码

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Block Text | `> 引用` | 引用块 |
| Source Code | `` `代码` `` | 行内代码 |
| Verbatim Char | 代码字符 | 代码块中的字符样式 |

### 列表样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Bullet List | `- 项目` | 无序列表 |
| Numbered List | `1. 项目` | 有序列表 |
| Definition Term | 定义列表术语 | 定义列表的术语 |
| Definition | 定义列表定义 | 定义列表的定义 |

### 表格样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Table | 表格 | 表格整体样式 |
| Table Caption | 表格标题 | 表格说明文字 |
| Table Header | 表头 | 表格标题行 |

### 图片样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Figure | `![](image.png)` | 图片 |
| Image Caption | 图片标题 | 图片说明文字 |
| Caption | 通用标题 | 图表通用标题 |

### 目录样式

| 样式名称 | 说明 |
|---------|------|
| TOC Heading | 目录标题（"目录"二字） |
| TOC 1 | 目录一级条目 |
| TOC 2 | 目录二级条目 |
| TOC 3 | 目录三级条目 |

### 链接样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Hyperlink | `[文字](url)` | 超链接 |

### 脚注样式

| 样式名称 | Markdown 对应 | 说明 |
|---------|--------------|------|
| Footnote Text | `[^1]` | 脚注文本 |
| Footnote Reference | 脚注引用 | 脚注编号 |

### 其他样式

| 样式名称 | 说明 |
|---------|------|
| Header | 页眉 |
| Footer | 页脚 |
| Bibliography | 参考文献 |

---

## 常见问题修复

### 问题1：标题序号显示为蓝色斜体

修改 Heading 1-6 样式：
1. 右键标题样式 → 修改
2. 字体颜色改为 **黑色**
3. 取消 **斜体**

### 问题2：中文字体不正确

修改以下样式的字体：
- Body Text / First Paragraph → 宋体
- Heading 1-6 → 黑体
- Table → 宋体

---

## 推荐字体设置

| 样式 | 中文字体 | 西文字体 | 字号 | 其他 |
|------|----------|----------|------|------|
| Title | 黑体 | Arial | 小一(24pt) | 加粗、居中 |
| Subtitle | 宋体 | Times New Roman | 三号(16pt) | 居中 |
| Heading 1 | 黑体 | Arial | 小二(18pt) | 加粗、黑色 |
| Heading 2 | 黑体 | Arial | 三号(16pt) | 加粗、黑色 |
| Heading 3 | 黑体 | Arial | 小三(15pt) | 加粗、黑色 |
| Heading 4 | 黑体 | Arial | 四号(14pt) | 黑色 |
| Body Text | 宋体 | Times New Roman | 小四(12pt) | |
| First Paragraph | 宋体 | Times New Roman | 小四(12pt) | |
| Table | 宋体 | Times New Roman | 五号(10.5pt) | |
| Source Code | 等线/Consolas | Consolas | 五号(10.5pt) | |
| Block Text | 楷体 | Times New Roman | 小四(12pt) | 斜体 |
| TOC 1-3 | 宋体 | Times New Roman | 小四(12pt) | |

---

## 创建/修改模板步骤

### 方法一：从生成的文档创建模板（推荐）

```powershell
# 1. 生成一个文档
.\build.ps1 -Client example-client -Doc 部署手册

# 2. 用 Word 打开生成的文档
# 3. 修改各个样式（开始 → 样式 → 右键 → 修改）
# 4. 另存为 templates/default.docx
```

### 方法二：生成空白模板

```powershell
# Windows
.\build.ps1 -InitTemplate

# Linux/macOS
make init-template
```

---

## 为不同客户使用不同模板

```yaml
# clients/某客户/运维手册.yaml
template: "custom.docx"  # 使用自定义模板
```

将自定义模板放在 `templates/` 目录下即可。
