// Package service 提供业务逻辑服务
package service

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// VariableType 变量类型
type VariableType string

const (
	VarTypeText   VariableType = "text"
	VarTypeNumber VariableType = "number"
	VarTypeDate   VariableType = "date"
	VarTypeSelect VariableType = "select"
)

// VariableDeclaration 变量声明
type VariableDeclaration struct {
	Name        string       `json:"name" yaml:"name"`
	Description string       `json:"description" yaml:"description"`
	Type        VariableType `json:"type" yaml:"type"`
	Default     interface{}  `json:"default,omitempty" yaml:"default,omitempty"`
	Options     []string     `json:"options,omitempty" yaml:"options,omitempty"`   // for select type
	Min         *float64     `json:"min,omitempty" yaml:"min,omitempty"`           // for number type
	Max         *float64     `json:"max,omitempty" yaml:"max,omitempty"`           // for number type
	Pattern     string       `json:"pattern,omitempty" yaml:"pattern,omitempty"`   // for text type
	Format      string       `json:"format,omitempty" yaml:"format,omitempty"`     // for date type
	Required    bool         `json:"required" yaml:"-"`                            // computed: true if no default
	SourceFile  string       `json:"sourceFile" yaml:"-"`                          // which file declared it
}

// VariableValue 变量值
type VariableValue struct {
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

// ValidationError 验证错误
type ValidationError struct {
	Variable   string `json:"variable"`
	Message    string `json:"message"`
	Expected   string `json:"expected"`
	Actual     string `json:"actual"`
	File       string `json:"file"`
	Suggestion string `json:"suggestion,omitempty"`
}

// Error 实现 error 接口
func (e ValidationError) Error() string {
	return fmt.Sprintf("[ERROR] Variable '%s': %s (in %s)", e.Variable, e.Message, e.File)
}

// VariablesResponse API 响应
type VariablesResponse struct {
	Variables []VariableDeclaration `json:"variables"`
	Errors    []ValidationError     `json:"errors,omitempty"`
}

// VariableService 变量服务
type VariableService struct {
	srcDir string
}

// NewVariableService 创建变量服务实例
func NewVariableService(srcDir string) *VariableService {
	return &VariableService{
		srcDir: srcDir,
	}
}

// variableNameRegex 变量名正则：字母或下划线开头，后跟字母、数字、下划线或点
var variableNameRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.]*$`)

// placeholderRegex 占位符正则：匹配 {{variable_name}}
var placeholderRegex = regexp.MustCompile(`\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}`)

// escapedPlaceholderRegex 转义占位符正则：匹配 \{{text}}
var escapedPlaceholderRegex = regexp.MustCompile(`\\(\{\{[^}]*\}\})`)

// ValidateVariableName 验证变量名是否合法
func ValidateVariableName(name string) bool {
	return variableNameRegex.MatchString(name)
}


// frontMatter 用于解析 Markdown front-matter
type frontMatter struct {
	Variables map[string]interface{} `yaml:"variables"`
}

// parseVariableDeclaration 从 YAML map 解析变量声明
func parseVariableDeclaration(name string, data interface{}, sourceFile string) (*VariableDeclaration, error) {
	decl := &VariableDeclaration{
		Name:       name,
		Type:       VarTypeText, // 默认类型
		SourceFile: sourceFile,
	}

	// 如果是简单值，直接作为默认值
	switch v := data.(type) {
	case string:
		decl.Default = v
		decl.Required = false
		return decl, nil
	case int, int64, float64:
		decl.Default = v
		decl.Type = VarTypeNumber
		decl.Required = false
		return decl, nil
	case map[string]interface{}:
		// 复杂声明
		if desc, ok := v["description"].(string); ok {
			decl.Description = desc
		}
		if t, ok := v["type"].(string); ok {
			decl.Type = VariableType(t)
		}
		if def, ok := v["default"]; ok {
			decl.Default = def
			decl.Required = false
		} else {
			decl.Required = true
		}
		if opts, ok := v["options"].([]interface{}); ok {
			for _, opt := range opts {
				if s, ok := opt.(string); ok {
					decl.Options = append(decl.Options, s)
				}
			}
		}
		if min, ok := v["min"]; ok {
			if f, err := toFloat64(min); err == nil {
				decl.Min = &f
			}
		}
		if max, ok := v["max"]; ok {
			if f, err := toFloat64(max); err == nil {
				decl.Max = &f
			}
		}
		if pattern, ok := v["pattern"].(string); ok {
			decl.Pattern = pattern
		}
		if format, ok := v["format"].(string); ok {
			decl.Format = format
		}
		return decl, nil
	default:
		return nil, fmt.Errorf("invalid variable declaration for %s", name)
	}
}

// toFloat64 将各种数值类型转换为 float64
func toFloat64(v interface{}) (float64, error) {
	switch n := v.(type) {
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case float64:
		return n, nil
	case string:
		return strconv.ParseFloat(n, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", v)
	}
}

// ExtractVariablesFromFile 从单个文件提取变量声明
func (s *VariableService) ExtractVariablesFromFile(filePath string) ([]VariableDeclaration, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	return s.ExtractVariablesFromContent(string(content), filePath)
}

// ExtractVariablesFromContent 从内容提取变量声明
func (s *VariableService) ExtractVariablesFromContent(content, sourceFile string) ([]VariableDeclaration, error) {
	// 解析 front-matter
	fm, _, err := parseFrontMatter(content)
	if err != nil {
		return nil, err
	}

	if fm.Variables == nil {
		return []VariableDeclaration{}, nil
	}

	var declarations []VariableDeclaration
	for name, data := range fm.Variables {
		if !ValidateVariableName(name) {
			continue // 跳过无效变量名
		}
		decl, err := parseVariableDeclaration(name, data, sourceFile)
		if err != nil {
			continue
		}
		declarations = append(declarations, *decl)
	}

	return declarations, nil
}

// parseFrontMatter 解析 Markdown front-matter
func parseFrontMatter(content string) (*frontMatter, string, error) {
	fm := &frontMatter{}

	// 检查是否以 --- 开头
	if !strings.HasPrefix(content, "---") {
		return fm, content, nil
	}

	// 查找结束的 ---
	endIndex := strings.Index(content[3:], "\n---")
	if endIndex == -1 {
		return fm, content, nil
	}

	// 提取 front-matter 内容
	fmContent := content[3 : endIndex+3]
	bodyContent := content[endIndex+7:] // 跳过 \n---\n

	// 解析 YAML
	if err := yaml.Unmarshal([]byte(fmContent), fm); err != nil {
		return nil, content, err
	}

	return fm, bodyContent, nil
}


// ExtractVariables 从多个模块文件提取变量声明
func (s *VariableService) ExtractVariables(modulePaths []string) ([]VariableDeclaration, []ValidationError) {
	log.Printf("[VariableService] ExtractVariables 被调用")
	log.Printf("[VariableService] srcDir: %s", s.srcDir)
	log.Printf("[VariableService] 模块路径: %v", modulePaths)
	
	// 计算工作目录（srcDir 的父目录）
	workDir := filepath.Dir(s.srcDir)
	log.Printf("[VariableService] 工作目录: %s", workDir)
	
	varsByFile := make(map[string][]VariableDeclaration)

	for _, path := range modulePaths {
		// 构建完整路径
		fullPath := path
		if !filepath.IsAbs(path) {
			fullPath = filepath.Join(workDir, path)
		}
		// 清理路径，确保跨平台一致性
		fullPath = filepath.Clean(fullPath)
		log.Printf("[VariableService] 处理模块: %s -> %s", path, fullPath)
		
		// 检查文件是否存在
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			log.Printf("[VariableService] 文件不存在: %s", fullPath)
			continue
		}

		decls, err := s.ExtractVariablesFromFile(fullPath)
		if err != nil {
			log.Printf("[VariableService] 提取变量失败: %s, 错误: %v", fullPath, err)
			continue // 跳过无法读取的文件
		}
		log.Printf("[VariableService] 从 %s 提取到 %d 个变量", path, len(decls))
		if len(decls) > 0 {
			varsByFile[path] = decls
		}
	}

	return s.MergeVariables(varsByFile)
}

// MergeVariables 合并多个模块的变量声明
func (s *VariableService) MergeVariables(varsByFile map[string][]VariableDeclaration) ([]VariableDeclaration, []ValidationError) {
	merged := make(map[string]*VariableDeclaration)
	sources := make(map[string][]string) // 记录每个变量来自哪些文件
	var errors []ValidationError

	for file, decls := range varsByFile {
		for _, decl := range decls {
			sources[decl.Name] = append(sources[decl.Name], file)

			if existing, ok := merged[decl.Name]; ok {
				// 检查冲突
				if existing.Type != decl.Type {
					errors = append(errors, ValidationError{
						Variable: decl.Name,
						Message:  fmt.Sprintf("type conflict: '%s' vs '%s'", existing.Type, decl.Type),
						Expected: string(existing.Type),
						Actual:   string(decl.Type),
						File:     fmt.Sprintf("%s, %s", existing.SourceFile, file),
					})
					continue
				}
				// 检查 select 类型的 options 冲突
				if decl.Type == VarTypeSelect && !stringSliceEqual(existing.Options, decl.Options) {
					errors = append(errors, ValidationError{
						Variable: decl.Name,
						Message:  "options conflict",
						Expected: strings.Join(existing.Options, ", "),
						Actual:   strings.Join(decl.Options, ", "),
						File:     fmt.Sprintf("%s, %s", existing.SourceFile, file),
					})
					continue
				}
				// 合并：保留更完整的声明
				if existing.Description == "" && decl.Description != "" {
					existing.Description = decl.Description
				}
				if existing.Default == nil && decl.Default != nil {
					existing.Default = decl.Default
					existing.Required = false
				}
			} else {
				declCopy := decl
				merged[decl.Name] = &declCopy
			}
		}
	}

	// 转换为切片
	var result []VariableDeclaration
	for _, decl := range merged {
		result = append(result, *decl)
	}

	return result, errors
}

// stringSliceEqual 比较两个字符串切片是否相等
func stringSliceEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}


// ValidateValues 验证变量值
func (s *VariableService) ValidateValues(declarations []VariableDeclaration, values map[string]interface{}) []ValidationError {
	var errors []ValidationError

	for _, decl := range declarations {
		value, hasValue := values[decl.Name]

		// 检查必填
		if !hasValue && decl.Required {
			errors = append(errors, ValidationError{
				Variable:   decl.Name,
				Message:    "required variable is missing",
				Expected:   "a value",
				Actual:     "none",
				File:       decl.SourceFile,
				Suggestion: fmt.Sprintf("add '%s' to the variables section in your config", decl.Name),
			})
			continue
		}

		// 如果没有值，使用默认值
		if !hasValue {
			continue
		}

		// 类型验证
		switch decl.Type {
		case VarTypeNumber:
			if err := s.validateNumber(decl, value); err != nil {
				errors = append(errors, *err)
			}
		case VarTypeDate:
			if err := s.validateDate(decl, value); err != nil {
				errors = append(errors, *err)
			}
		case VarTypeSelect:
			if err := s.validateSelect(decl, value); err != nil {
				errors = append(errors, *err)
			}
		case VarTypeText:
			if err := s.validateText(decl, value); err != nil {
				errors = append(errors, *err)
			}
		}
	}

	return errors
}

// validateNumber 验证数字类型
func (s *VariableService) validateNumber(decl VariableDeclaration, value interface{}) *ValidationError {
	num, err := toFloat64(value)
	if err != nil {
		return &ValidationError{
			Variable: decl.Name,
			Message:  "value is not a valid number",
			Expected: "number",
			Actual:   fmt.Sprintf("%v", value),
			File:     decl.SourceFile,
		}
	}

	if decl.Min != nil && num < *decl.Min {
		return &ValidationError{
			Variable: decl.Name,
			Message:  fmt.Sprintf("value %v is less than minimum %v", num, *decl.Min),
			Expected: fmt.Sprintf(">= %v", *decl.Min),
			Actual:   fmt.Sprintf("%v", num),
			File:     decl.SourceFile,
		}
	}

	if decl.Max != nil && num > *decl.Max {
		return &ValidationError{
			Variable: decl.Name,
			Message:  fmt.Sprintf("value %v is greater than maximum %v", num, *decl.Max),
			Expected: fmt.Sprintf("<= %v", *decl.Max),
			Actual:   fmt.Sprintf("%v", num),
			File:     decl.SourceFile,
		}
	}

	return nil
}

// validateDate 验证日期类型
func (s *VariableService) validateDate(decl VariableDeclaration, value interface{}) *ValidationError {
	str, ok := value.(string)
	if !ok {
		return &ValidationError{
			Variable: decl.Name,
			Message:  "value is not a string",
			Expected: "date string (YYYY-MM-DD)",
			Actual:   fmt.Sprintf("%T", value),
			File:     decl.SourceFile,
		}
	}

	// 默认 ISO 8601 格式
	dateRegex := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	if !dateRegex.MatchString(str) {
		return &ValidationError{
			Variable: decl.Name,
			Message:  "value does not match date format",
			Expected: "YYYY-MM-DD",
			Actual:   str,
			File:     decl.SourceFile,
		}
	}

	return nil
}

// validateSelect 验证选择类型
func (s *VariableService) validateSelect(decl VariableDeclaration, value interface{}) *ValidationError {
	str, ok := value.(string)
	if !ok {
		return &ValidationError{
			Variable: decl.Name,
			Message:  "value is not a string",
			Expected: fmt.Sprintf("one of: %s", strings.Join(decl.Options, ", ")),
			Actual:   fmt.Sprintf("%T", value),
			File:     decl.SourceFile,
		}
	}

	for _, opt := range decl.Options {
		if opt == str {
			return nil
		}
	}

	return &ValidationError{
		Variable: decl.Name,
		Message:  "value is not in allowed options",
		Expected: fmt.Sprintf("one of: %s", strings.Join(decl.Options, ", ")),
		Actual:   str,
		File:     decl.SourceFile,
	}
}

// validateText 验证文本类型
func (s *VariableService) validateText(decl VariableDeclaration, value interface{}) *ValidationError {
	str, ok := value.(string)
	if !ok {
		// 尝试转换为字符串
		str = fmt.Sprintf("%v", value)
	}

	if decl.Pattern != "" {
		re, err := regexp.Compile(decl.Pattern)
		if err != nil {
			return &ValidationError{
				Variable: decl.Name,
				Message:  fmt.Sprintf("invalid pattern: %s", decl.Pattern),
				Expected: "valid regex pattern",
				Actual:   decl.Pattern,
				File:     decl.SourceFile,
			}
		}
		if !re.MatchString(str) {
			return &ValidationError{
				Variable: decl.Name,
				Message:  "value does not match pattern",
				Expected: decl.Pattern,
				Actual:   str,
				File:     decl.SourceFile,
			}
		}
	}

	return nil
}


// RenderContent 渲染内容（替换变量）
func (s *VariableService) RenderContent(content string, declarations []VariableDeclaration, values map[string]interface{}) (string, error) {
	// 创建声明的变量名集合
	declaredVars := make(map[string]bool)
	for _, decl := range declarations {
		declaredVars[decl.Name] = true
	}

	// 1. 先处理转义的占位符，临时替换为特殊标记
	escapePlaceholder := "\x00ESCAPED_PLACEHOLDER\x00"
	escapedMatches := escapedPlaceholderRegex.FindAllStringSubmatch(content, -1)
	escapedOriginals := make([]string, len(escapedMatches))
	for i, match := range escapedMatches {
		escapedOriginals[i] = match[1] // 保存原始的 {{text}}
	}
	content = escapedPlaceholderRegex.ReplaceAllString(content, escapePlaceholder)

	// 2. 替换已声明的变量
	content = placeholderRegex.ReplaceAllStringFunc(content, func(match string) string {
		// 提取变量名
		varName := match[2 : len(match)-2] // 去掉 {{ 和 }}

		// 只替换已声明的变量
		if !declaredVars[varName] {
			return match // 保持原样
		}

		// 获取值
		if val, ok := values[varName]; ok {
			return fmt.Sprintf("%v", val)
		}

		// 使用默认值
		for _, decl := range declarations {
			if decl.Name == varName && decl.Default != nil {
				return fmt.Sprintf("%v", decl.Default)
			}
		}

		return match // 没有值，保持原样
	})

	// 3. 恢复转义的占位符
	for i := 0; i < len(escapedOriginals); i++ {
		content = strings.Replace(content, escapePlaceholder, escapedOriginals[i], 1)
	}

	// 4. 移除 front-matter 中的 variables 节
	content = removeVariablesSection(content)

	return content, nil
}

// removeVariablesSection 从 front-matter 中移除 variables 节
func removeVariablesSection(content string) string {
	// 检查是否以 --- 开头
	if !strings.HasPrefix(content, "---") {
		return content
	}

	// 查找结束的 ---
	endIndex := strings.Index(content[3:], "\n---")
	if endIndex == -1 {
		return content
	}

	fmContent := content[3 : endIndex+3]
	bodyContent := content[endIndex+7:]

	// 解析 YAML
	var fmData map[string]interface{}
	if err := yaml.Unmarshal([]byte(fmContent), &fmData); err != nil {
		return content
	}

	// 删除 variables 键
	delete(fmData, "variables")

	// 如果还有其他内容，重新生成 front-matter
	if len(fmData) > 0 {
		newFM, err := yaml.Marshal(fmData)
		if err != nil {
			return content
		}
		return "---\n" + string(newFM) + "---" + bodyContent
	}

	// 没有其他内容，直接返回 body
	return strings.TrimLeft(bodyContent, "\n")
}

// RenderFile 渲染单个文件
func (s *VariableService) RenderFile(filePath string, values map[string]interface{}) (string, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	declarations, err := s.ExtractVariablesFromContent(string(content), filePath)
	if err != nil {
		return "", err
	}

	return s.RenderContent(string(content), declarations, values)
}

// ResolveValues 解析变量值（合并默认值、配置值、命令行值）
func (s *VariableService) ResolveValues(declarations []VariableDeclaration, configValues, cliValues map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	for _, decl := range declarations {
		// 优先级：CLI > Config > Default
		if val, ok := cliValues[decl.Name]; ok {
			result[decl.Name] = val
		} else if val, ok := configValues[decl.Name]; ok {
			result[decl.Name] = val
		} else if decl.Default != nil {
			result[decl.Name] = decl.Default
		}
	}

	return result
}
