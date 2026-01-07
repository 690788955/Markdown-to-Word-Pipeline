package service

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// BuildRequest 构建请求
type BuildRequest struct {
	ClientName   string `json:"clientName"`
	DocumentType string `json:"documentType"` // 可选，空表示默认
	CustomName   string `json:"customName"`   // 自定义客户名称（可选）
	Format       string `json:"format"`       // 输出格式：word 或 pdf（默认: word）
}

// BuildResult 构建结果
type BuildResult struct {
	Success  bool   `json:"success"`
	FilePath string `json:"filePath"` // 生成的文件路径
	FileName string `json:"fileName"` // 文件名
	Error    string `json:"error,omitempty"`
	Output   string `json:"output,omitempty"` // 构建输出日志
}

// BuildService 构建服务
type BuildService struct {
	workDir       string
	buildDir      string
	timeout       time.Duration
	cleanupAge    time.Duration // 文件清理年龄
	cleanupTicker *time.Ticker
}

// NewBuildService 创建构建服务实例
func NewBuildService(workDir, buildDir string) *BuildService {
	svc := &BuildService{
		workDir:    workDir,
		buildDir:   buildDir,
		timeout:    60 * time.Second,  // 默认 60 秒超时
		cleanupAge: 24 * time.Hour,    // 默认 24 小时后清理
	}
	
	// 启动定期清理
	svc.startCleanup()
	
	return svc
}

// startCleanup 启动定期清理任务
func (s *BuildService) startCleanup() {
	s.cleanupTicker = time.NewTicker(1 * time.Hour) // 每小时检查一次
	go func() {
		for range s.cleanupTicker.C {
			s.CleanOldFiles()
		}
	}()
}

// CleanOldFiles 清理过期文件
func (s *BuildService) CleanOldFiles() error {
	entries, err := os.ReadDir(s.buildDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	cutoff := time.Now().Add(-s.cleanupAge)
	
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".docx") && !strings.HasSuffix(name, ".pdf") {
			continue
		}
		
		filePath := filepath.Join(s.buildDir, name)
		info, err := os.Stat(filePath)
		if err != nil {
			continue
		}
		
		if info.ModTime().Before(cutoff) {
			os.Remove(filePath)
		}
	}
	
	return nil
}

// Build 执行文档构建
func (s *BuildService) Build(req BuildRequest) (*BuildResult, error) {
	// 默认格式为 word
	format := req.Format
	if format == "" {
		format = "word"
	}
	
	// 构建命令
	args := s.buildCommandArgs(req.ClientName, req.DocumentType, req.CustomName, format)
	
	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	// 根据操作系统选择构建命令
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		// Windows 使用 PowerShell 脚本，优先查找 bin 目录
		scriptPath := s.findScript("build.ps1")
		if scriptPath == "" {
			return &BuildResult{
				Success: false,
				Error:   "找不到构建脚本 build.ps1\n请确保 bin/build.ps1 或 build.ps1 存在",
			}, nil
		}
		
		psArgs := []string{"-ExecutionPolicy", "Bypass", "-File", scriptPath}
		psArgs = append(psArgs, args...)
		cmd = exec.CommandContext(ctx, "powershell", psArgs...)
	} else {
		// Linux/macOS 使用 bash 脚本
		scriptPath := s.findScript("build.sh")
		if scriptPath == "" {
			return &BuildResult{
				Success: false,
				Error:   "找不到构建脚本 build.sh\n请确保 bin/build.sh 存在",
			}, nil
		}
		
		cmd = exec.CommandContext(ctx, "bash", append([]string{scriptPath}, args...)...)
	}

	cmd.Dir = s.workDir

	// 捕获输出
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	if ctx.Err() == context.DeadlineExceeded {
		return &BuildResult{
			Success: false,
			Error:   "构建超时，请稍后重试",
			Output:  outputStr,
		}, nil
	}

	if err != nil {
		return &BuildResult{
			Success: false,
			Error:   fmt.Sprintf("构建失败: %v\n工作目录: %s", err, s.workDir),
			Output:  outputStr,
		}, nil
	}

	// 从输出中解析生成的文件路径
	filePath, fileName := s.parseOutputFile(outputStr, req.ClientName, format)
	if filePath == "" {
		// 尝试从 build 目录查找最新文件
		filePath, fileName = s.findLatestFile(req.ClientName, format)
	}

	if filePath == "" {
		return &BuildResult{
			Success: false,
			Error:   "构建完成但未找到输出文件",
			Output:  outputStr,
		}, nil
	}

	return &BuildResult{
		Success:  true,
		FilePath: filePath,
		FileName: fileName,
		Output:   outputStr,
	}, nil
}

// findScript 查找构建脚本，优先 bin 目录
func (s *BuildService) findScript(name string) string {
	// 优先查找 bin 目录
	binPath := filepath.Join(s.workDir, "bin", name)
	if _, err := os.Stat(binPath); err == nil {
		return binPath
	}
	
	// 其次查找工作目录根
	rootPath := filepath.Join(s.workDir, name)
	if _, err := os.Stat(rootPath); err == nil {
		return rootPath
	}
	
	return ""
}

// GetBuildOutput 获取构建输出文件路径
func (s *BuildService) GetBuildOutput(fileName string) (string, error) {
	filePath := filepath.Join(s.buildDir, fileName)
	
	// 安全检查：确保文件在 build 目录内
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", fmt.Errorf("无效的文件路径")
	}
	
	absBuildDir, err := filepath.Abs(s.buildDir)
	if err != nil {
		return "", fmt.Errorf("无效的构建目录")
	}

	if !strings.HasPrefix(absPath, absBuildDir) {
		return "", fmt.Errorf("非法的文件路径")
	}

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", fmt.Errorf("文件不存在: %s", fileName)
	}

	return filePath, nil
}

// BuildCommand 生成构建命令字符串（用于测试）
func (s *BuildService) BuildCommand(clientName, docType, format string) string {
	args := s.buildCommandArgs(clientName, docType, "", format)
	if runtime.GOOS == "windows" {
		return "powershell -ExecutionPolicy Bypass -File build.ps1 " + strings.Join(args, " ")
	}
	return "make " + strings.Join(args, " ")
}

// buildCommandArgs 构建命令参数
func (s *BuildService) buildCommandArgs(clientName, docType, customName, format string) []string {
	if runtime.GOOS == "windows" {
		// PowerShell 参数格式
		args := []string{"-Client", clientName}
		if docType != "" && docType != "config" {
			args = append(args, "-Doc", docType)
		}
		if customName != "" {
			args = append(args, "-ClientName", customName)
		}
		if format == "pdf" {
			args = append(args, "-Format", "pdf")
		}
		return args
	}
	
	// Make 参数格式
	args := []string{fmt.Sprintf("client=%s", clientName)}
	if docType != "" && docType != "config" {
		args = append(args, fmt.Sprintf("doc=%s", docType))
	}
	if customName != "" {
		args = append(args, fmt.Sprintf("client_name=%s", customName))
	}
	if format == "pdf" {
		args = append(args, "format=pdf")
	}
	return args
}

// parseOutputFile 从构建输出中解析生成的文件路径
func (s *BuildService) parseOutputFile(output, clientName, format string) (string, string) {
	// 根据格式确定文件扩展名
	ext := ".docx"
	if format == "pdf" {
		ext = ".pdf"
	}
	
	// 匹配 "输出文件: xxx.docx/pdf" 或 "Output: xxx.docx/pdf"
	patterns := []string{
		`输出文件:\s*(.+` + regexp.QuoteMeta(ext) + `)`,
		`Output:\s*(.+` + regexp.QuoteMeta(ext) + `)`,
		`输出:\s*(.+` + regexp.QuoteMeta(ext) + `)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(output)
		if len(matches) > 1 {
			filePath := strings.TrimSpace(matches[1])
			fileName := filepath.Base(filePath)
			
			// 如果是相对路径，转换为绝对路径
			if !filepath.IsAbs(filePath) {
				filePath = filepath.Join(s.workDir, filePath)
			}
			
			return filePath, fileName
		}
	}

	return "", ""
}

// findLatestFile 在 build 目录中查找最新的文件
func (s *BuildService) findLatestFile(clientName, format string) (string, string) {
	entries, err := os.ReadDir(s.buildDir)
	if err != nil {
		return "", ""
	}

	// 根据格式确定文件扩展名
	ext := ".docx"
	if format == "pdf" {
		ext = ".pdf"
	}

	var latestFile string
	var latestTime time.Time

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(name, ext) {
			continue
		}

		// 优先匹配包含客户名的文件
		if clientName != "" && !strings.Contains(name, clientName) {
			continue
		}

		filePath := filepath.Join(s.buildDir, name)
		info, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		if info.ModTime().After(latestTime) {
			latestTime = info.ModTime()
			latestFile = name
		}
	}

	if latestFile != "" {
		return filepath.Join(s.buildDir, latestFile), latestFile
	}

	return "", ""
}

// ListBuildFiles 列出所有构建文件
func (s *BuildService) ListBuildFiles() ([]string, error) {
	entries, err := os.ReadDir(s.buildDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".docx") || strings.HasSuffix(name, ".pdf") {
			files = append(files, name)
		}
	}

	return files, nil
}

// CleanBuildDir 清理构建目录
func (s *BuildService) CleanBuildDir() error {
	entries, err := os.ReadDir(s.buildDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".docx") || strings.HasSuffix(name, ".pdf") {
			filePath := filepath.Join(s.buildDir, name)
			os.Remove(filePath)
		}
	}

	return nil
}

// StreamBuild 流式构建（返回实时输出）
func (s *BuildService) StreamBuild(req BuildRequest, outputChan chan<- string) (*BuildResult, error) {
	defer close(outputChan)

	// 默认格式为 word
	format := req.Format
	if format == "" {
		format = "word"
	}

	args := s.buildCommandArgs(req.ClientName, req.DocumentType, req.CustomName, format)
	
	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		psArgs := []string{"-ExecutionPolicy", "Bypass", "-File", "build.ps1"}
		psArgs = append(psArgs, args...)
		cmd = exec.CommandContext(ctx, "powershell", psArgs...)
	} else {
		makeArgs := append([]string{}, args...)
		cmd = exec.CommandContext(ctx, "make", makeArgs...)
	}

	cmd.Dir = s.workDir

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	// 读取输出
	var outputBuilder strings.Builder
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			outputBuilder.WriteString(line + "\n")
			outputChan <- line
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			outputBuilder.WriteString(line + "\n")
			outputChan <- line
		}
	}()

	err = cmd.Wait()
	outputStr := outputBuilder.String()

	if ctx.Err() == context.DeadlineExceeded {
		return &BuildResult{
			Success: false,
			Error:   "构建超时",
			Output:  outputStr,
		}, nil
	}

	if err != nil {
		return &BuildResult{
			Success: false,
			Error:   fmt.Sprintf("构建失败: %v", err),
			Output:  outputStr,
		}, nil
	}

	filePath, fileName := s.parseOutputFile(outputStr, req.ClientName, format)
	if filePath == "" {
		filePath, fileName = s.findLatestFile(req.ClientName, format)
	}

	return &BuildResult{
		Success:  true,
		FilePath: filePath,
		FileName: fileName,
		Output:   outputStr,
	}, nil
}
