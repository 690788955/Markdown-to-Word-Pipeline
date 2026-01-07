# 协作规范

欢迎参与本项目的协作！请阅读以下规范以保持项目的一致性和可维护性。

## 分支命名规范

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 主分支 | `main` | `main` |
| 功能分支 | `feature/<描述>` | `feature/add-client-abc` |
| 文档更新 | `docs/<描述>` | `docs/update-chapter-2` |
| 修复分支 | `fix/<描述>` | `fix/image-path-error` |

## 提交信息格式

使用以下格式编写提交信息：

```
<类型>: <简短描述>

[可选的详细说明]
```

**类型说明**:
- `feat`: 新增功能或文档内容
- `fix`: 修复问题
- `docs`: 文档更新（README、CONTRIBUTING 等）
- `style`: 格式调整（不影响内容）
- `refactor`: 重构（不影响功能）
- `chore`: 构建配置、依赖更新等

**示例**:
```
feat: 添加客户ABC的配置文件

- 新增 clients/abc/运维手册.yaml
- 新增 clients/abc/metadata.yaml
- 使用专属模板 templates/abc.docx
```

## 文档模块编写规范

### 文件命名

- 使用数字前缀表示顺序：`01-introduction.md`、`02-content.md`
- 使用小写字母和连字符：`03-technical-details.md`
- 避免使用空格和特殊字符

### Markdown 格式

```markdown
# 章节标题

正文内容...

## 二级标题

更多内容...

### 三级标题

详细内容...
```

### 图片引用

将图片放在 `src/images/` 目录下，使用相对路径引用：

```markdown
![图片描述](images/example.png)
```

### YAML Front Matter（可选）

如需为单个文档添加元数据，使用 YAML front matter：

```markdown
---
title: 章节标题
author: 作者名
---

# 正文开始
```

## 添加新客户配置

### 步骤 1: 创建客户目录

```bash
mkdir -p clients/new-client
```

### 步骤 2: 创建配置文件

创建 `clients/new-client/运维手册.yaml`：

```yaml
# 客户基本信息
client_name: "新客户公司"
template: "default.docx"

# 要包含的文档模块（按顺序）
modules:
  - src/metadata.yaml
  - src/01-introduction.md
  - src/02-content.md

# Pandoc 额外参数
pandoc_args:
  - "--toc"
  - "--number-sections"

# 输出文件名模式
output_pattern: "{client}_{title}_{date}.docx"
```

### 步骤 3: 创建元数据覆盖（可选）

创建 `clients/new-client/metadata.yaml`：

```yaml
---
title: "为新客户定制的文档"
subtitle: "专属方案"
author: "技术团队"
date: "2026-01-06"
client:
  name: "新客户公司"
  contact: "李经理"
---
```

### 步骤 4: 添加专属模板（可选）

如需专属排版，在 `templates/` 下添加 Word 模板文件，并在文档配置文件中引用。

### 步骤 5: 测试构建

```bash
make client=new-client doc=运维手册
```

## 代码审查清单

提交 Merge Request 前，请确认：

- [ ] 文档内容无拼写错误
- [ ] 图片路径正确且图片已添加
- [ ] 配置文件格式正确（YAML 语法）
- [ ] 本地构建测试通过
- [ ] 更新了 CHANGELOG.md（如适用）

## 问题反馈

如有问题或建议，请通过 GitLab Issues 提交。
