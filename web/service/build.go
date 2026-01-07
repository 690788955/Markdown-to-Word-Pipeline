package service

import (
	"bufio"
	"context"
	"fmt"
	"log"
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
	exeDir        string        // 可执行文件所在目录（用于查找 bin 脚本）
	timeout       time.Duration
	cleanupAge    time.Duration // 文件清理年龄
	cleanupTicker *time.Ticker
}

// NewBuildService 创建构建服务实例
func NewBuildService(workDir, buildDir string) *BuildService {
	log.Printf("[BuildService] 初始化构建服务")
	log.Printf("[BuildService] 工作目录: %s", workDir)
	log.Printf("[BuildService] 构建目录: %s", buildDir)
	
	// 获取可执行文件所在目录
	exeDir := ""
	if exePath, err := os.Executable(); err == nil {
		exeDir = filepath.Dir(exePath)
		log.Printf("[BuildService] 可执行文件目录: %s", exeDir)
	}
	
	svc := &BuildService{
		workDir:    workDir,
		buildDir:   buildDir,
		exeDir:     exeDir,
		timeout:    60 * time.Second,  // 默认 60 秒超时
		cleanupAge: 24 * time.Hour,    // 默认 24 小时后清理
	}
	
	// 启动定期清理
	svc.startCleanup()
	log.Printf("[BuildService] 构建服务初始化完成")
	
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
	startTime := time.Now()
	
	// 默认格式为 word
	format := req.Format
	if format == "" {
		format = "word"
	}
	
	log.Printf("[BuildService] ==========================================")
	log.Printf("[BuildService] 开始构建文档")
	log.Printf("[BuildService] 客户: %s", req.ClientName)
	log.Printf("[BuildService] 文档类型: %s", req.DocumentType)
	log.Printf("[BuildService] 自定义名称: %s", req.CustomName)
	log.Printf("[BuildService] 输出格式: %s", format)
	log.Printf("[BuildService] 工作目录: %s", s.workDir)
	log.Printf("[BuildService] ==========================================")
	
	// 构建命令
	args := s.buildCommandArgs(req.ClientName, req.DocumentType, req.CustomName, format)
	
	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
	defer cancel()

	// 根据操作系统选择构建命令
	var cmd *exec.Cmd
	var scriptPath string
	if runtime.GOOS == "windows" {
		// Windows 使用 PowerShell 脚本，优先查找 bin 目录
		scriptPath = s.findScript("build.ps1")
		if scriptPath == "" {
			log.Printf("[BuildService] 错误: 找不到构建脚本 build.ps1")
			return &BuildResult{
				Success: false,
				Error:   fmt.Sprintf("找不到构建脚本 build.ps1\n已检查路径:\n  - %s\n  - %s\n请确保脚本存在", 
					filepath.Join(s.workDir, "bin", "build.ps1"),
					filepath.Join(s.workDir, "build.ps1")),
			}, nil
		}
		
		psArgs := []string{"-ExecutionPolicy", "Bypass", "-File", scriptPath}
		psArgs = append(psArgs, args...)
		cmd = exec.CommandContext(ctx, "powershell", psArgs...)
		log.Printf("[BuildService] 执行命令: powershell %s", strings.Join(psArgs, " "))
	} else {
		// Linux/macOS 使用 bash 脚本
		scriptPath = s.findScript("build.sh")
		if scriptPath == "" {
			log.Printf("[BuildService] 错误: 找不到构建脚本 build.sh")
			return &BuildResult{
				Success: false,
				Error:   fmt.Sprintf("找不到构建脚本 build.sh\n已检查路径:\n  - %s\n  - %s\n请确保脚本存在", 
					filepath.Join(s.workDir, "bin", "build.sh"),
					filepath.Join(s.workDir, "build.sh")),
			}, nil
		}
		
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "bash", cmdArgs...)
		log.Printf("[BuildService] 执行命令: bash %s", strings.Join(cmdArgs, " "))
	}

	cmd.Dir = s.workDir

	// 捕获输出
	output, err := cmd.CombinedOutput()
	outputStr := string(output)
	
	elapsed := time.Since(startTime)

	if ctx.Err() == context.DeadlineExceeded {
		log.Printf("[BuildService] 构建超时 (耗时: %v)", elapsed)
		return &BuildResult{
			Success: false,
			Error:   "构建超时，请稍后重试",
			Output:  outputStr,
		}, nil
	}

	if err != nil {
		log.Printf("[BuildService] 构建失败: %v (耗时: %v)", err, elapsed)
		log.Printf("[BuildService] 错误输出: %s", outputStr)
		return &BuildResult{
			Success: false,
			Error:   fmt.Sprintf("构建失败: %v\n工作目录: %s\n请检查脚本权限和依赖", err, s.workDir),
			Output:  outputStr,
		}, nil
	}

	// 从输出中解析生成的文件路径
	filePath, fileName := s.parseOutputFile(outputStr, req.ClientName, format)
	if filePath == "" {
		// 尝试从 build 目录查找最新文件
		log.Printf("[BuildService] 从输出解析文件路径失败，尝试查找最新文件")
		filePath, fileName = s.findLatestFile(req.ClientName, format)
	}

	if filePath == "" {
		log.Printf("[BuildService] 构建完成但未找到输出文件 (耗时: %v)", elapsed)
		return &BuildResult{
			Success: false,
			Error:   "构建完成但未找到输出文件",
			Output:  outputStr,
		}, nil
	}

	log.Printf("[BuildService] ==========================================")
	log.Printf("[BuildService] 构建成功!")
	log.Printf("[BuildService] 输出文件: %s", filePath)
	log.Printf("[BuildService] 耗时: %v", elapsed)
	log.Printf("[BuildService] ==========================================")

	return &BuildResult{
		Success:  true,
		FilePath: filePath,
		FileName: fileName,
		Output:   outputStr,
	}, nil
}

// findScript 查找构建脚本，优先可执行文件目录的 bin，其次 workDir
func (s *BuildService) findScript(name string) string {
	log.Printf("[BuildService] 查找脚本: %s", name)
	
	// 1. 优先查找可执行文件目录的 bin 目录
	if s.exeDir != "" {
		exeBinPath := filepath.Join(s.exeDir, "bin", name)
		log.Printf("[BuildService] 检查路径: %s", exeBinPath)
		if info, err := os.Stat(exeBinPath); err == nil {
			log.Printf("[BuildService] 找到脚本: %s (权限: %s)", exeBinPath, info.Mode().String())
			return exeBinPath
		}
		
		// 可执行文件目录根
		exeRootPath := filepath.Join(s.exeDir, name)
		log.Printf("[BuildService] 检查路径: %s", exeRootPath)
		if info, err := os.Stat(exeRootPath); err == nil {
			log.Printf("[BuildService] 找到脚本: %s (权限: %s)", exeRootPath, info.Mode().String())
			return exeRootPath
		}
	}
	
	// 2. 其次查找 workDir 的 bin 目录（兼容旧部署方式）
	binPath := filepath.Join(s.workDir, "bin", name)
	log.Printf("[BuildService] 检查路径: %s", binPath)
	if info, err := os.Stat(binPath); err == nil {
		log.Printf("[BuildService] 找到脚本: %s (权限: %s)", binPath, info.Mode().String())
		return binPath
	}
	
	// 3. 最后查找 workDir 根目录
	rootPath := filepath.Join(s.workDir, name)
	log.Printf("[BuildService] 检查路径: %s", rootPath)
	if info, err := os.Stat(rootPath); err == nil {
		log.Printf("[BuildService] 找到脚本: %s (权限: %s)", rootPath, info.Mode().String())
		return rootPath
	}
	
	log.Printf("[BuildService] 未找到脚本: %s", name)
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
		return "powershell -ExecutionPolicy Bypass -File bin/build.ps1 " + strings.Join(args, " ")
	}
	return "bash bin/build.sh " + strings.Join(args, " ")
}

// buildCommandArgs 构建命令参数
func (s *BuildService) buildCommandArgs(clientName, docType, customName, format string) []string {
	if runtime.GOOS == "windows" {
		// PowerShell 参数格式，包含 WorkDir
		args := []string{"-Client", clientName, "-WorkDir", s.workDir}
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
	
	// Bash 脚本参数格式，包含 -w workdir
	args := []string{"-c", clientName, "-w", s.workDir}
	if docType != "" && docType != "config" {
		args = append(args, "-d", docType)
	}
	if customName != "" {
		args = append(args, "-n", customName)
	}
	if format == "pdf" {
		args = append(args, "-f", "pdf")
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
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = s.findScript("build.ps1")
		if scriptPath == "" {
			close(outputChan)
			return &BuildResult{
				Success: false,
				Error:   "找不到构建脚本 build.ps1",
			}, nil
		}
		psArgs := []string{"-ExecutionPolicy", "Bypass", "-File", scriptPath}
		psArgs = append(psArgs, args...)
		cmd = exec.CommandContext(ctx, "powershell", psArgs...)
	} else {
		// Linux/macOS 使用 bash 脚本（与 Build 函数保持一致）
		scriptPath = s.findScript("build.sh")
		if scriptPath == "" {
			close(outputChan)
			return &BuildResult{
				Success: false,
				Error:   "找不到构建脚本 build.sh",
			}, nil
		}
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(ctx, "bash", cmdArgs...)
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
