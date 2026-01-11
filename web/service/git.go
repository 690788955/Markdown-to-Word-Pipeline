// Package service 提供业务逻辑服务
package service

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ManagedDirectories 管理的目录列表
var ManagedDirectories = []string{"src", "clients", "fonts", "templates"}

// GitStatus 仓库状态
type GitStatus struct {
	IsRepository  bool   `json:"isRepository"`
	Branch        string `json:"branch"`
	HasChanges    bool   `json:"hasChanges"`
	ChangedCount  int    `json:"changedCount"`
	StagedCount   int    `json:"stagedCount"`   // 暂存区文件数
	UnstagedCount int    `json:"unstagedCount"` // 未暂存文件数
	AheadCount    int    `json:"aheadCount"`    // 待推送提交数
	BehindCount   int    `json:"behindCount"`   // 待拉取提交数
	HasRemote     bool   `json:"hasRemote"`
	RemoteURL     string `json:"remoteUrl"`
}

// FileChange 文件变更
type FileChange struct {
	Path       string `json:"path"`
	FileName   string `json:"fileName"`   // 文件名（不含路径）
	Directory  string `json:"directory"`  // 所属目录 (src, clients, etc.)
	Status     string `json:"status"`     // "M", "A", "D", "U", "R"
	StatusText string `json:"statusText"` // "modified", "added", "deleted", "untracked", "renamed"
	Staged     bool   `json:"staged"`     // 是否在暂存区
}

// ChangesResult 变更文件结果（区分 staged/unstaged）
type ChangesResult struct {
	Staged   []FileChange `json:"staged"`   // 暂存区文件
	Unstaged []FileChange `json:"unstaged"` // 未暂存文件
}

// CommitInfo 提交信息
type CommitInfo struct {
	Hash      string `json:"hash"`      // 短哈希
	Message   string `json:"message"`
	Author    string `json:"author"`
	Timestamp string `json:"timestamp"` // ISO 8601 格式
}

// GitCredentials Git 凭据
type GitCredentials struct {
	Username string `json:"username"`
	Password string `json:"-"` // 不在 JSON 中返回
	Token    string `json:"-"` // 不在 JSON 中返回
}

// GitError Git 操作错误
type GitError struct {
	Operation  string `json:"operation"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion"`
}

// Error 实现 error 接口
func (e *GitError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Operation, e.Message)
}

// GitService Git 服务
type GitService struct {
	workDir     string
	managedDirs []string
	credentials *GitCredentials
}

// NewGitService 创建 Git 服务
func NewGitService(workDir string) *GitService {
	return &GitService{
		workDir:     workDir,
		managedDirs: ManagedDirectories,
		credentials: nil,
	}
}


// runGit 执行 git 命令
func (s *GitService) runGit(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = s.workDir

	// 设置环境变量
	env := os.Environ()
	env = append(env, "GIT_TERMINAL_PROMPT=0")
	
	// 如果有凭据，设置凭据相关环境变量
	if s.credentials != nil {
		if s.credentials.Username != "" {
			env = append(env, "GIT_AUTHOR_NAME="+s.credentials.Username)
			env = append(env, "GIT_COMMITTER_NAME="+s.credentials.Username)
		}
	}
	cmd.Env = env

	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

// CheckGitAvailable 检测 git 命令是否可用
func (s *GitService) CheckGitAvailable() (string, error) {
	output, err := s.runGit("--version")
	if err != nil {
		return "", &GitError{
			Operation:  "check",
			Message:    "Git 命令不可用",
			Suggestion: "请确保系统已安装 Git",
		}
	}
	// 解析版本号，如 "git version 2.39.0"
	version := strings.TrimPrefix(output, "git version ")
	log.Printf("[GitService] Git 版本: %s", version)
	return version, nil
}

// IsRepository 检测是否为 Git 仓库
func (s *GitService) IsRepository() bool {
	gitDir := filepath.Join(s.workDir, ".git")
	info, err := os.Stat(gitDir)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// GetStatus 获取仓库状态
func (s *GitService) GetStatus() (*GitStatus, error) {
	status := &GitStatus{
		IsRepository: s.IsRepository(),
	}

	if !status.IsRepository {
		return status, nil
	}

	// 获取当前分支
	branch, err := s.runGit("rev-parse", "--abbrev-ref", "HEAD")
	if err == nil {
		status.Branch = branch
	}

	// 获取变更数量（区分 staged/unstaged）
	changesResult, err := s.GetChangesResult()
	if err == nil {
		status.StagedCount = len(changesResult.Staged)
		status.UnstagedCount = len(changesResult.Unstaged)
		status.ChangedCount = status.StagedCount + status.UnstagedCount
		status.HasChanges = status.ChangedCount > 0
	}

	// 获取远程仓库信息
	remoteURL, err := s.GetRemote()
	if err == nil && remoteURL != "" {
		status.HasRemote = true
		status.RemoteURL = remoteURL

		// 获取 ahead/behind 数量
		s.updateAheadBehind(status)
	}

	return status, nil
}

// updateAheadBehind 更新 ahead/behind 计数
func (s *GitService) updateAheadBehind(status *GitStatus) {
	// 先 fetch 获取最新远程状态（静默执行）
	s.runGit("fetch", "--quiet")

	// 获取 ahead/behind
	output, err := s.runGit("rev-list", "--left-right", "--count", "HEAD...@{upstream}")
	if err != nil {
		return
	}

	parts := strings.Fields(output)
	if len(parts) >= 2 {
		status.AheadCount, _ = strconv.Atoi(parts[0])
		status.BehindCount, _ = strconv.Atoi(parts[1])
	}
}


// GetChanges 获取变更文件列表（仅管理目录）- 兼容旧接口
func (s *GitService) GetChanges() ([]FileChange, error) {
	result, err := s.GetChangesResult()
	if err != nil {
		return nil, err
	}
	// 合并 staged 和 unstaged
	all := make([]FileChange, 0, len(result.Staged)+len(result.Unstaged))
	all = append(all, result.Staged...)
	all = append(all, result.Unstaged...)
	return all, nil
}

// GetChangesResult 获取变更文件列表（区分 staged/unstaged）
func (s *GitService) GetChangesResult() (*ChangesResult, error) {
	if !s.IsRepository() {
		return nil, &GitError{
			Operation:  "changes",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	// 使用 git status --porcelain 获取变更
	output, err := s.runGit("status", "--porcelain")
	if err != nil {
		return nil, &GitError{
			Operation:  "changes",
			Message:    "获取变更列表失败: " + err.Error(),
			Suggestion: "请检查 Git 仓库状态",
		}
	}

	result := &ChangesResult{
		Staged:   []FileChange{},
		Unstaged: []FileChange{},
	}

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 3 {
			continue
		}

		// 解析状态码和文件路径
		// git status --porcelain 格式: XY filename
		// X = 暂存区状态, Y = 工作区状态
		x := line[0] // 暂存区状态
		y := line[1] // 工作区状态
		filePath := strings.TrimSpace(line[3:])

		// 处理重命名的情况 (R  old -> new)
		if strings.Contains(filePath, " -> ") {
			parts := strings.Split(filePath, " -> ")
			if len(parts) == 2 {
				filePath = parts[1]
			}
		}

		// 检查是否在管理目录中
		dir := s.getFileDirectory(filePath)
		if dir == "" {
			continue // 不在管理目录中，跳过
		}

		fileName := filepath.Base(filePath)

		// 暂存区有变更 (X 不是空格且不是 ?)
		if x != ' ' && x != '?' {
			result.Staged = append(result.Staged, FileChange{
				Path:       filePath,
				FileName:   fileName,
				Directory:  dir,
				Status:     string(x),
				StatusText: statusCodeToText(x),
				Staged:     true,
			})
		}

		// 工作区有变更 (Y 不是空格)
		if y != ' ' {
			status := y
			if y == '?' {
				status = 'U' // 未跟踪显示为 U
			}
			result.Unstaged = append(result.Unstaged, FileChange{
				Path:       filePath,
				FileName:   fileName,
				Directory:  dir,
				Status:     string(status),
				StatusText: statusCodeToText(byte(status)),
				Staged:     false,
			})
		}
	}

	return result, nil
}

// statusCodeToText 状态码转文本
func statusCodeToText(code byte) string {
	switch code {
	case 'M':
		return "modified"
	case 'A':
		return "added"
	case 'D':
		return "deleted"
	case 'R':
		return "renamed"
	case '?', 'U':
		return "untracked"
	default:
		return "unknown"
	}
}

// getFileDirectory 获取文件所属的管理目录
func (s *GitService) getFileDirectory(filePath string) string {
	// 规范化路径分隔符
	filePath = filepath.ToSlash(filePath)
	
	for _, dir := range s.managedDirs {
		if strings.HasPrefix(filePath, dir+"/") || filePath == dir {
			return dir
		}
	}
	return ""
}

// GetChangesByDirectory 按目录分组获取变更
func (s *GitService) GetChangesByDirectory() (map[string][]FileChange, error) {
	changes, err := s.GetChanges()
	if err != nil {
		return nil, err
	}

	byDir := make(map[string][]FileChange)
	for _, change := range changes {
		byDir[change.Directory] = append(byDir[change.Directory], change)
	}

	return byDir, nil
}

// Stage 暂存指定文件
func (s *GitService) Stage(files []string) error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "stage",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	for _, file := range files {
		// 只暂存管理目录中的文件
		if s.getFileDirectory(file) == "" {
			continue
		}
		_, err := s.runGit("add", file)
		if err != nil {
			return &GitError{
				Operation:  "stage",
				Message:    "暂存文件失败: " + file,
				Suggestion: "请检查文件路径是否正确",
			}
		}
	}
	return nil
}

// Unstage 取消暂存指定文件
func (s *GitService) Unstage(files []string) error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "unstage",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	for _, file := range files {
		_, err := s.runGit("reset", "HEAD", file)
		if err != nil {
			// reset HEAD 对于新仓库可能失败，尝试 rm --cached
			s.runGit("rm", "--cached", file)
		}
	}
	return nil
}

// StageAll 暂存所有管理目录的变更
func (s *GitService) StageAll() error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "stage-all",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	for _, dir := range s.managedDirs {
		dirPath := filepath.Join(s.workDir, dir)
		if _, err := os.Stat(dirPath); err == nil {
			s.runGit("add", dir)
		}
	}
	return nil
}

// UnstageAll 取消暂存所有文件
func (s *GitService) UnstageAll() error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "unstage-all",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	_, err := s.runGit("reset", "HEAD")
	if err != nil {
		// 新仓库可能没有 HEAD，忽略错误
		log.Printf("[GitService] reset HEAD 失败（可能是新仓库）: %v", err)
	}
	return nil
}

// Discard 放弃指定文件的更改
func (s *GitService) Discard(files []string) error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "discard",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	for _, file := range files {
		// 只处理管理目录中的文件
		if s.getFileDirectory(file) == "" {
			continue
		}

		// 先尝试 checkout（已跟踪文件）
		_, err := s.runGit("checkout", "--", file)
		if err != nil {
			// 可能是未跟踪文件，尝试删除
			fullPath := filepath.Join(s.workDir, file)
			if removeErr := os.Remove(fullPath); removeErr != nil {
				log.Printf("[GitService] 放弃更改失败: %s, checkout err: %v, remove err: %v", file, err, removeErr)
			}
		}
	}
	return nil
}


// defaultGitignore 默认的 .gitignore 内容
const defaultGitignore = `# Build output
build/
*.docx
*.pdf

# Logs
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
`

// Init 初始化 Git 仓库
func (s *GitService) Init() error {
	if s.IsRepository() {
		return &GitError{
			Operation:  "init",
			Message:    "目录已经是 Git 仓库",
			Suggestion: "无需重复初始化",
		}
	}

	// 执行 git init
	_, err := s.runGit("init")
	if err != nil {
		return &GitError{
			Operation:  "init",
			Message:    "初始化仓库失败: " + err.Error(),
			Suggestion: "请检查目录权限",
		}
	}

	// 创建默认 .gitignore
	gitignorePath := filepath.Join(s.workDir, ".gitignore")
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		if err := os.WriteFile(gitignorePath, []byte(defaultGitignore), 0644); err != nil {
			log.Printf("[GitService] 创建 .gitignore 失败: %v", err)
			// 不返回错误，初始化已成功
		}
	}

	log.Printf("[GitService] Git 仓库初始化成功")
	return nil
}


// Commit 提交暂存区变更
func (s *GitService) Commit(message string, files []string) (string, error) {
	if !s.IsRepository() {
		return "", &GitError{
			Operation:  "commit",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	// 验证提交信息非空
	message = strings.TrimSpace(message)
	if message == "" {
		return "", &GitError{
			Operation:  "commit",
			Message:    "提交信息不能为空",
			Suggestion: "请输入有意义的提交信息",
		}
	}

	// 如果指定了文件，先暂存这些文件（兼容旧行为）
	if len(files) > 0 {
		for _, file := range files {
			// 只暂存管理目录中的文件
			if s.getFileDirectory(file) == "" {
				continue
			}
			_, err := s.runGit("add", file)
			if err != nil {
				log.Printf("[GitService] 暂存文件失败: %s, %v", file, err)
			}
		}
	}

	// 检查暂存区是否为空
	changesResult, err := s.GetChangesResult()
	if err != nil {
		return "", err
	}
	if len(changesResult.Staged) == 0 {
		return "", &GitError{
			Operation:  "commit",
			Message:    "暂存区为空，没有需要提交的变更",
			Suggestion: "请先暂存要提交的文件",
		}
	}

	// 执行提交（只提交暂存区）
	output, err := s.runGit("commit", "-m", message)
	if err != nil {
		// 检查是否是没有变更的情况
		if strings.Contains(output, "nothing to commit") {
			return "", &GitError{
				Operation:  "commit",
				Message:    "没有需要提交的变更",
				Suggestion: "请先修改文件后再提交",
			}
		}
		return "", &GitError{
			Operation:  "commit",
			Message:    "提交失败: " + output,
			Suggestion: "请检查 Git 配置（user.name 和 user.email）",
		}
	}

	// 获取提交哈希
	hash, _ := s.runGit("rev-parse", "--short", "HEAD")
	log.Printf("[GitService] 提交成功: %s", hash)
	return hash, nil
}


// GetRemote 获取远程仓库 URL
func (s *GitService) GetRemote() (string, error) {
	if !s.IsRepository() {
		return "", &GitError{
			Operation:  "remote",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	output, err := s.runGit("remote", "get-url", "origin")
	if err != nil {
		return "", nil // 没有远程仓库不是错误
	}

	return output, nil
}

// GetRemoteProtocol 获取远程仓库协议类型
func (s *GitService) GetRemoteProtocol(url string) string {
	if strings.HasPrefix(url, "https://") {
		return "https"
	}
	if strings.HasPrefix(url, "ssh://") || strings.HasPrefix(url, "git@") {
		return "ssh"
	}
	return "unknown"
}

// ValidateRemoteURL 验证远程仓库 URL 格式
func (s *GitService) ValidateRemoteURL(url string) bool {
	url = strings.TrimSpace(url)
	if url == "" {
		return false
	}

	// HTTPS URL: https://github.com/user/repo.git
	httpsPattern := regexp.MustCompile(`^https://[a-zA-Z0-9.-]+/.*$`)
	// SSH URL: git@github.com:user/repo.git 或 ssh://git@github.com/user/repo.git
	sshPattern1 := regexp.MustCompile(`^git@[a-zA-Z0-9.-]+:.*$`)
	sshPattern2 := regexp.MustCompile(`^ssh://[a-zA-Z0-9@.-]+/.*$`)

	return httpsPattern.MatchString(url) || sshPattern1.MatchString(url) || sshPattern2.MatchString(url)
}

// SetRemote 设置远程仓库
func (s *GitService) SetRemote(url string) error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "remote",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	url = strings.TrimSpace(url)
	if !s.ValidateRemoteURL(url) {
		return &GitError{
			Operation:  "remote",
			Message:    "无效的远程仓库 URL",
			Suggestion: "请使用 HTTPS (https://...) 或 SSH (git@...) 格式的 URL",
		}
	}

	// 检查是否已有 origin
	existingURL, _ := s.GetRemote()
	if existingURL != "" {
		// 更新现有远程仓库
		_, err := s.runGit("remote", "set-url", "origin", url)
		if err != nil {
			return &GitError{
				Operation:  "remote",
				Message:    "更新远程仓库失败: " + err.Error(),
				Suggestion: "请检查 URL 格式",
			}
		}
	} else {
		// 添加新远程仓库
		_, err := s.runGit("remote", "add", "origin", url)
		if err != nil {
			return &GitError{
				Operation:  "remote",
				Message:    "添加远程仓库失败: " + err.Error(),
				Suggestion: "请检查 URL 格式",
			}
		}
	}

	log.Printf("[GitService] 远程仓库设置成功: %s", url)
	return nil
}


// Push 推送到远程仓库
func (s *GitService) Push() error {
	if !s.IsRepository() {
		return &GitError{
			Operation:  "push",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	remoteURL, _ := s.GetRemote()
	if remoteURL == "" {
		return &GitError{
			Operation:  "push",
			Message:    "未配置远程仓库",
			Suggestion: "请先配置远程仓库地址",
		}
	}

	// 获取当前分支
	branch, err := s.runGit("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		branch = "main"
	}

	// 尝试推送，设置上游分支
	output, err := s.runGit("push", "-u", "origin", branch)
	if err != nil {
		// 分析错误类型
		if strings.Contains(output, "Authentication failed") ||
			strings.Contains(output, "could not read Username") {
			return &GitError{
				Operation:  "push",
				Message:    "认证失败",
				Suggestion: "请检查凭据配置，或使用 SSH 密钥",
			}
		}
		if strings.Contains(output, "rejected") {
			return &GitError{
				Operation:  "push",
				Message:    "推送被拒绝，远程有新的提交",
				Suggestion: "请先拉取远程更新后再推送",
			}
		}
		if strings.Contains(output, "Could not resolve host") {
			return &GitError{
				Operation:  "push",
				Message:    "无法连接远程仓库",
				Suggestion: "请检查网络连接和远程仓库地址",
			}
		}
		return &GitError{
			Operation:  "push",
			Message:    "推送失败: " + output,
			Suggestion: "请检查远程仓库配置和网络连接",
		}
	}

	log.Printf("[GitService] 推送成功")
	return nil
}

// Pull 从远程仓库拉取
func (s *GitService) Pull() ([]string, error) {
	if !s.IsRepository() {
		return nil, &GitError{
			Operation:  "pull",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	remoteURL, _ := s.GetRemote()
	if remoteURL == "" {
		return nil, &GitError{
			Operation:  "pull",
			Message:    "未配置远程仓库",
			Suggestion: "请先配置远程仓库地址",
		}
	}

	output, err := s.runGit("pull")
	if err != nil {
		// 检查是否有冲突
		if strings.Contains(output, "CONFLICT") {
			conflicts := s.parseConflicts(output)
			return conflicts, &GitError{
				Operation:  "pull",
				Message:    "拉取产生冲突",
				Suggestion: "请手动解决冲突后提交",
			}
		}
		if strings.Contains(output, "Authentication failed") {
			return nil, &GitError{
				Operation:  "pull",
				Message:    "认证失败",
				Suggestion: "请检查凭据配置",
			}
		}
		return nil, &GitError{
			Operation:  "pull",
			Message:    "拉取失败: " + output,
			Suggestion: "请检查远程仓库配置和网络连接",
		}
	}

	log.Printf("[GitService] 拉取成功")
	return nil, nil
}

// parseConflicts 解析冲突文件列表
func (s *GitService) parseConflicts(output string) []string {
	var conflicts []string
	conflictPattern := regexp.MustCompile(`CONFLICT \([^)]+\): Merge conflict in (.+)`)
	matches := conflictPattern.FindAllStringSubmatch(output, -1)
	for _, match := range matches {
		if len(match) > 1 {
			conflicts = append(conflicts, match[1])
		}
	}
	return conflicts
}


// GetLog 获取提交历史
func (s *GitService) GetLog(limit int, offset int) ([]CommitInfo, int, error) {
	if !s.IsRepository() {
		return nil, 0, &GitError{
			Operation:  "log",
			Message:    "当前目录不是 Git 仓库",
			Suggestion: "请先初始化 Git 仓库",
		}
	}

	if limit <= 0 {
		limit = 20
	}

	// 获取总提交数
	totalOutput, err := s.runGit("rev-list", "--count", "HEAD")
	total := 0
	if err == nil {
		total, _ = strconv.Atoi(totalOutput)
	}

	// 获取提交历史
	// 格式: hash|message|author|timestamp
	format := "%h|%s|%an|%aI"
	skipArg := fmt.Sprintf("--skip=%d", offset)
	limitArg := fmt.Sprintf("-n%d", limit)

	output, err := s.runGit("log", limitArg, skipArg, "--format="+format)
	if err != nil {
		// 可能是空仓库
		if strings.Contains(output, "does not have any commits") {
			return []CommitInfo{}, 0, nil
		}
		return nil, 0, &GitError{
			Operation:  "log",
			Message:    "获取提交历史失败: " + err.Error(),
			Suggestion: "请检查仓库状态",
		}
	}

	var commits []CommitInfo
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "|", 4)
		if len(parts) < 4 {
			continue
		}

		commit := CommitInfo{
			Hash:      parts[0],
			Message:   parts[1],
			Author:    parts[2],
			Timestamp: parts[3],
		}
		commits = append(commits, commit)
	}

	return commits, total, nil
}

// GetLogFormatted 获取格式化的提交历史（用于显示）
func (s *GitService) GetLogFormatted(limit int) ([]CommitInfo, error) {
	commits, _, err := s.GetLog(limit, 0)
	if err != nil {
		return nil, err
	}

	// 格式化时间戳为更友好的格式
	for i := range commits {
		t, err := time.Parse(time.RFC3339, commits[i].Timestamp)
		if err == nil {
			commits[i].Timestamp = t.Format("2006-01-02 15:04")
		}
	}

	return commits, nil
}


// SetCredentials 设置凭据
func (s *GitService) SetCredentials(creds *GitCredentials) {
	s.credentials = creds
	log.Printf("[GitService] 凭据已设置: username=%s", creds.Username)
}

// GetCredentials 获取凭据（不返回敏感信息）
func (s *GitService) GetCredentials() *GitCredentials {
	if s.credentials == nil {
		return nil
	}
	// 返回不包含密码的副本
	return &GitCredentials{
		Username: s.credentials.Username,
	}
}

// LoadCredentialsFromEnv 从环境变量加载凭据
func (s *GitService) LoadCredentialsFromEnv() {
	username := os.Getenv("GIT_USERNAME")
	password := os.Getenv("GIT_PASSWORD")
	token := os.Getenv("GIT_TOKEN")

	if username != "" || password != "" || token != "" {
		s.credentials = &GitCredentials{
			Username: username,
			Password: password,
			Token:    token,
		}
		log.Printf("[GitService] 从环境变量加载凭据: username=%s", username)
	}
}

// HasCredentials 检查是否已配置凭据
func (s *GitService) HasCredentials() bool {
	return s.credentials != nil && (s.credentials.Password != "" || s.credentials.Token != "")
}

// ConfigureGitCredentialHelper 配置 Git 凭据助手
func (s *GitService) ConfigureGitCredentialHelper() error {
	if s.credentials == nil {
		return nil
	}

	// 配置用户信息
	if s.credentials.Username != "" {
		s.runGit("config", "user.name", s.credentials.Username)
	}

	return nil
}
