// Git 集成功能 - 前端逻辑（VS Code 风格）
// 提供 Git 版本控制功能：暂存区管理、提交、推送、拉取等

let gitStatus = null;
let gitStagedChanges = [];    // 暂存区文件
let gitUnstagedChanges = [];  // 未暂存文件
let gitAvailable = false;
let gitPanelOpen = false;

// 切换 Git 侧边面板
function toggleGitPanel() {
    const panel = document.getElementById('gitSidePanel');
    const overlay = document.getElementById('gitPanelOverlay');
    
    if (!panel || !overlay) return;
    
    gitPanelOpen = !gitPanelOpen;
    
    if (gitPanelOpen) {
        panel.classList.add('show');
        overlay.classList.add('show');
        loadGitStatus();
    } else {
        panel.classList.remove('show');
        overlay.classList.remove('show');
    }
}

// 初始化 Git 面板
async function initGitPanel() {
    console.log('[Git] 初始化 Git 面板');
    
    // 绑定事件
    const toggleBtn = document.getElementById('gitToggleBtn');
    const closeBtn = document.getElementById('gitSideCloseBtn');
    const overlay = document.getElementById('gitPanelOverlay');
    
    if (toggleBtn) toggleBtn.addEventListener('click', toggleGitPanel);
    if (closeBtn) closeBtn.addEventListener('click', toggleGitPanel);
    if (overlay) overlay.addEventListener('click', toggleGitPanel);
    
    // 检测 Git 是否可用
    const available = await checkGitAvailable();
    if (!available) {
        return;
    }
    
    // 更新右上角按钮状态
    updateGitToggleButton();
}

// 更新右上角按钮状态
function updateGitToggleButton() {
    const badge = document.getElementById('gitBadge');
    if (!badge) return;
    
    const totalChanges = (gitStatus?.stagedCount || 0) + (gitStatus?.unstagedCount || 0);
    if (totalChanges > 0) {
        badge.textContent = totalChanges;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// 检测 Git 是否可用
async function checkGitAvailable() {
    try {
        const response = await fetch('/api/git/check');
        const data = await response.json();
        
        if (data.success && data.data.available) {
            gitAvailable = true;
            console.log('[Git] Git 可用，版本:', data.data.version);
            return true;
        } else {
            gitAvailable = false;
            console.log('[Git] Git 不可用:', data.data.error);
            return false;
        }
    } catch (e) {
        console.error('[Git] 检测 Git 失败:', e);
        gitAvailable = false;
        return false;
    }
}

// 加载 Git 状态
async function loadGitStatus() {
    const content = document.getElementById('gitPanelContent');
    if (!content) return;
    
    if (!gitAvailable) {
        renderGitUnavailable(content);
        return;
    }
    
    content.innerHTML = '<div class="git-loading">加载中...</div>';
    
    try {
        const response = await fetch('/api/git/status');
        const data = await response.json();
        
        if (data.success) {
            gitStatus = data.data;
            console.log('[Git] 状态:', gitStatus);
            updateGitToggleButton();
            renderGitSidePanel(content);
        } else {
            content.innerHTML = '<div class="git-error">获取状态失败: ' + data.error + '</div>';
        }
    } catch (e) {
        console.error('[Git] 加载状态失败:', e);
        content.innerHTML = '<div class="git-error">加载失败: ' + e.message + '</div>';
    }
}

// 加载变更文件（区分 staged/unstaged）
async function loadGitChanges() {
    try {
        const response = await fetch('/api/git/changes');
        const data = await response.json();
        
        if (data.success) {
            gitStagedChanges = data.data.staged || [];
            gitUnstagedChanges = data.data.unstaged || [];
            return data.data;
        }
    } catch (e) {
        console.error('[Git] 加载变更失败:', e);
    }
    return { staged: [], unstaged: [] };
}

// 渲染 Git 不可用状态
function renderGitUnavailable(container) {
    if (!container) {
        container = document.getElementById('gitPanelContent');
    }
    if (!container) return;
    
    container.innerHTML = `
        <div class="git-unavailable-panel">
            <div class="git-unavailable-icon">⚠️</div>
            <div class="git-unavailable-title">Git 不可用</div>
            <div class="git-unavailable-desc">请确保系统已安装 Git</div>
        </div>
    `;
}

// 渲染 Git 侧边面板（VS Code 风格）
function renderGitSidePanel(container) {
    if (!container) {
        container = document.getElementById('gitPanelContent');
    }
    if (!container) return;
    
    if (!gitStatus) {
        container.innerHTML = '<div class="git-error">无法获取状态</div>';
        return;
    }
    
    let html = '';
    
    // 未初始化仓库
    if (!gitStatus.isRepository) {
        html = `
            <div class="git-setup-panel">
                <div class="git-setup-icon">📁</div>
                <div class="git-setup-title">未初始化 Git 仓库</div>
                <div class="git-setup-desc">选择一种方式开始版本控制</div>
                <div class="git-setup-actions">
                    <button class="btn btn-primary" onclick="initGitRepo()">初始化本地仓库</button>
                </div>
            </div>
        `;
        container.innerHTML = html;
        return;
    }
    
    // 工具栏（提交信息输入框 + 提交按钮）
    html += `
        <div class="git-toolbar">
            <div class="git-commit-row">
                <input type="text" id="gitCommitMsg" class="git-commit-input" placeholder="提交信息">
                <button class="git-toolbar-btn git-commit-btn" onclick="doQuickCommit()" title="提交暂存的更改" id="gitCommitBtn">
                    <span>✓</span>
                </button>
            </div>
            <div class="git-toolbar-actions">
                <button class="git-toolbar-btn" onclick="doPush()" title="推送">
                    <span>↑</span> 推送
                </button>
                <button class="git-toolbar-btn" onclick="doPull()" title="拉取">
                    <span>↓</span> 拉取
                </button>
                <button class="git-toolbar-btn" onclick="showGitHistory()" title="历史">
                    <span>☰</span> 历史
                </button>
                <button class="git-toolbar-btn" onclick="refreshGitStatus()" title="刷新">
                    <span>↻</span>
                </button>
            </div>
        </div>
    `;
    
    // 仓库信息
    html += `
        <div class="git-repo-info">
            <span class="git-branch-tag">🌿 ${gitStatus.branch || 'main'}</span>
            ${gitStatus.hasRemote ? `<span class="git-remote-tag" onclick="showRemoteConfig()" title="点击配置远程仓库">🔗 origin</span>` : `<span class="git-remote-tag git-no-remote" onclick="showRemoteConfig()" title="点击配置远程仓库">⚠️ 未配置远程</span>`}
            ${gitStatus.aheadCount > 0 ? `<span class="git-sync-tag">↑${gitStatus.aheadCount}</span>` : ''}
            ${gitStatus.behindCount > 0 ? `<span class="git-sync-tag">↓${gitStatus.behindCount}</span>` : ''}
        </div>
    `;
    
    container.innerHTML = html;
    
    // 加载并渲染变更文件
    loadAndRenderChanges(container);
}


// 加载并渲染变更文件（VS Code 风格：暂存区 + 更改区）
async function loadAndRenderChanges(container) {
    try {
        const changesData = await loadGitChanges();
        gitStagedChanges = changesData.staged || [];
        gitUnstagedChanges = changesData.unstaged || [];
        
        let html = '';
        
        // 暂存的更改区域
        html += renderStagedSection(gitStagedChanges);
        
        // 更改区域（未暂存）
        html += renderUnstagedSection(gitUnstagedChanges);
        
        container.innerHTML += html;
        
        // 更新提交按钮状态
        updateCommitButtonState();
        
    } catch (e) {
        console.error('[Git] 加载变更失败:', e);
    }
}

// 渲染暂存区文件列表
function renderStagedSection(stagedFiles) {
    const count = stagedFiles.length;
    
    let html = `
        <div class="git-changes-section git-staged-section">
            <div class="git-section-header" onclick="toggleSection(this)">
                <span class="git-section-toggle">▼</span>
                <span>暂存的更改</span>
                <span class="git-section-count">${count}</span>
                <div class="git-section-actions">
                    <button class="git-section-btn" onclick="event.stopPropagation(); unstageAll()" title="取消暂存全部">−</button>
                </div>
            </div>
            <div class="git-section-content">
    `;
    
    if (count === 0) {
        html += '<div class="git-empty-hint">没有暂存的更改</div>';
    } else {
        for (const file of stagedFiles) {
            html += renderFileItem(file, true);
        }
    }
    
    html += '</div></div>';
    return html;
}

// 渲染未暂存文件列表
function renderUnstagedSection(unstagedFiles) {
    const count = unstagedFiles.length;
    
    let html = `
        <div class="git-changes-section git-unstaged-section">
            <div class="git-section-header" onclick="toggleSection(this)">
                <span class="git-section-toggle">▼</span>
                <span>更改</span>
                <span class="git-section-count">${count}</span>
                <div class="git-section-actions">
                    <button class="git-section-btn" onclick="event.stopPropagation(); stageAll()" title="暂存全部">+</button>
                </div>
            </div>
            <div class="git-section-content">
    `;
    
    if (count === 0) {
        html += '<div class="git-empty-hint">没有更改的文件</div>';
    } else {
        for (const file of unstagedFiles) {
            html += renderFileItem(file, false);
        }
    }
    
    html += '</div></div>';
    return html;
}

// 渲染单个文件项
function renderFileItem(file, isStaged) {
    const statusLetter = getStatusLetter(file.status);
    const statusClass = getStatusColorClass(file.status);
    const fileIcon = getFileTypeIcon(file.fileName);
    const dirPath = file.directory ? file.directory + '/' : '';
    
    let actionsHtml = '';
    if (isStaged) {
        // 暂存区文件：取消暂存按钮
        actionsHtml = `
            <button class="git-file-btn" onclick="unstageFile('${escapeHtml(file.path)}')" title="取消暂存">−</button>
        `;
    } else {
        // 未暂存文件：放弃更改 + 暂存按钮
        actionsHtml = `
            <button class="git-file-btn git-discard-btn" onclick="discardFile('${escapeHtml(file.path)}')" title="放弃更改">↺</button>
            <button class="git-file-btn" onclick="stageFile('${escapeHtml(file.path)}')" title="暂存">+</button>
        `;
    }
    
    return `
        <div class="git-file-item">
            <span class="git-file-icon">${fileIcon}</span>
            <span class="git-file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.fileName)}</span>
            <span class="git-file-dir">${escapeHtml(dirPath)}</span>
            <div class="git-file-actions">${actionsHtml}</div>
            <span class="git-file-status ${statusClass}">${statusLetter}</span>
        </div>
    `;
}

// 获取状态字母
function getStatusLetter(status) {
    const letters = {
        'M': 'M',
        'A': 'A',
        'D': 'D',
        'U': 'U',
        'R': 'R',
        'modified': 'M',
        'added': 'A',
        'deleted': 'D',
        'untracked': 'U',
        'renamed': 'R'
    };
    return letters[status] || '?';
}

// 获取状态颜色类
function getStatusColorClass(status) {
    const classes = {
        'M': 'status-modified',
        'A': 'status-added',
        'D': 'status-deleted',
        'U': 'status-untracked',
        'R': 'status-renamed',
        'modified': 'status-modified',
        'added': 'status-added',
        'deleted': 'status-deleted',
        'untracked': 'status-untracked',
        'renamed': 'status-renamed'
    };
    return classes[status] || 'status-unknown';
}

// 获取文件类型图标
function getFileTypeIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        'md': '📝',
        'yaml': '⚙️',
        'yml': '⚙️',
        'json': '📋',
        'txt': '📄',
        'docx': '📘',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🎨',
        'go': '🔵',
        'js': '🟨',
        'css': '🎨',
        'html': '🌐'
    };
    return icons[ext] || '📄';
}

// 切换区域展开/折叠
function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// 更新提交按钮状态
function updateCommitButtonState() {
    const btn = document.getElementById('gitCommitBtn');
    if (!btn) return;
    
    if (gitStagedChanges.length === 0) {
        btn.disabled = true;
        btn.title = '暂存区为空，无法提交';
    } else {
        btn.disabled = false;
        btn.title = '提交暂存的更改';
    }
}


// ==================== 暂存区操作 ====================

// 暂存单个文件
async function stageFile(filePath) {
    try {
        const response = await fetch('/api/git/stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('暂存失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('暂存失败: ' + e.message, 'error');
    }
}

// 取消暂存单个文件
async function unstageFile(filePath) {
    try {
        const response = await fetch('/api/git/unstage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('取消暂存失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('取消暂存失败: ' + e.message, 'error');
    }
}

// 暂存所有变更
async function stageAll() {
    try {
        const response = await fetch('/api/git/stage-all', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('暂存全部失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('暂存全部失败: ' + e.message, 'error');
    }
}

// 取消暂存所有文件
async function unstageAll() {
    try {
        const response = await fetch('/api/git/unstage-all', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('取消暂存全部失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('取消暂存全部失败: ' + e.message, 'error');
    }
}

// 放弃单个文件的更改（需要确认）
async function discardFile(filePath) {
    const fileName = filePath.split('/').pop();
    
    if (!confirm(`确定要放弃对 "${fileName}" 的更改吗？\n\n此操作不可撤销！`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/git/discard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('已放弃更改', 'success');
            await loadGitStatus();
        } else {
            showToast('放弃更改失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('放弃更改失败: ' + e.message, 'error');
    }
}

// ==================== 提交操作 ====================

// 快速提交（只提交暂存区）
async function doQuickCommit() {
    const msgInput = document.getElementById('gitCommitMsg');
    let message = msgInput ? msgInput.value.trim() : '';
    
    // 默认提交信息
    if (!message) {
        const now = new Date();
        message = '更新 ' + now.toLocaleString('zh-CN');
    }
    
    if (gitStagedChanges.length === 0) {
        showToast('暂存区为空，请先暂存要提交的文件', 'info');
        return;
    }
    
    try {
        const response = await fetch('/api/git/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('提交成功: ' + data.data.hash, 'success');
            if (msgInput) msgInput.value = '';
            loadGitStatus();
        } else {
            showToast('提交失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('提交失败: ' + e.message, 'error');
    }
}

// 初始化 Git 仓库
async function initGitRepo() {
    try {
        const response = await fetch('/api/git/init', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Git 仓库初始化成功', 'success');
            await loadGitStatus();
        } else {
            showToast('初始化失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('初始化失败: ' + e.message, 'error');
    }
}

// ==================== 推送/拉取操作 ====================

// 执行推送
async function doPush() {
    try {
        showToast('正在推送...', 'info');
        
        const response = await fetch('/api/git/push', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('推送成功', 'success');
            await loadGitStatus();
        } else {
            if (data.error && data.error.includes('认证')) {
                showToast('推送失败: 请先配置凭据', 'error');
                showRemoteConfig();
            } else {
                showToast('推送失败: ' + data.error, 'error');
            }
        }
    } catch (e) {
        showToast('推送失败: ' + e.message, 'error');
    }
}

// 执行拉取
async function doPull() {
    try {
        showToast('正在拉取...', 'info');
        
        const response = await fetch('/api/git/pull', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            if (data.data && data.data.conflicts && data.data.conflicts.length > 0) {
                showToast('拉取完成，但存在冲突文件', 'warning');
                showConflictDialog(data.data.conflicts);
            } else {
                showToast('拉取成功', 'success');
            }
            await loadGitStatus();
        } else {
            showToast('拉取失败: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('拉取失败: ' + e.message, 'error');
    }
}

// 显示冲突对话框
function showConflictDialog(conflicts) {
    let modal = document.getElementById('gitConflictModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gitConflictModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    let conflictHtml = conflicts.map(f => `<li class="conflict-file">⚠️ ${f}</li>`).join('');
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>⚠️ 合并冲突</h3>
                <button type="button" class="modal-close" onclick="closeModal(document.getElementById('gitConflictModal'))">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 12px;">以下文件存在合并冲突，请手动解决：</p>
                <ul class="conflict-list">${conflictHtml}</ul>
                <p style="margin-top: 12px; color: var(--color-text-muted); font-size: 0.85rem;">
                    解决冲突后，请重新提交变更。
                </p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeModal(document.getElementById('gitConflictModal'))">知道了</button>
            </div>
        </div>
    `;
    
    openModal(modal);
}


// ==================== 历史记录 ====================

// 显示提交历史
async function showGitHistory() {
    try {
        const response = await fetch('/api/git/log?limit=20');
        const data = await response.json();
        
        if (!data.success) {
            showToast('获取历史失败: ' + data.error, 'error');
            return;
        }
        
        let modal = document.getElementById('gitHistoryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gitHistoryModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        const commits = data.data.commits || [];
        let historyHtml = '';
        
        if (commits.length === 0) {
            historyHtml = '<div class="list-empty">暂无提交记录</div>';
        } else {
            historyHtml = commits.map(commit => `
                <div class="git-commit-item">
                    <div class="commit-header">
                        <span class="commit-hash">${commit.hash}</span>
                        <span class="commit-time">${formatTime(commit.timestamp)}</span>
                    </div>
                    <div class="commit-message">${escapeHtml(commit.message)}</div>
                    <div class="commit-author">👤 ${escapeHtml(commit.author)}</div>
                </div>
            `).join('');
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>📜 提交历史</h3>
                    <button type="button" class="modal-close" onclick="closeModal(document.getElementById('gitHistoryModal'))">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="git-history-list">${historyHtml}</div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal(document.getElementById('gitHistoryModal'))">关闭</button>
                </div>
            </div>
        `;
        
        openModal(modal);
    } catch (e) {
        showToast('获取历史失败: ' + e.message, 'error');
    }
}

// ==================== 远程仓库配置 ====================

// 显示远程仓库配置
async function showRemoteConfig() {
    let currentUrl = '';
    try {
        const response = await fetch('/api/git/remote');
        const data = await response.json();
        if (data.success && data.data) {
            currentUrl = data.data.url || '';
        }
    } catch (e) {
        console.error('[Git] 获取远程配置失败:', e);
    }
    
    let modal = document.getElementById('gitRemoteModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gitRemoteModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header">
                <h3>🔗 远程仓库配置</h3>
                <button type="button" class="modal-close" onclick="closeRemoteConfigModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>远程仓库 URL</label>
                    <input type="text" id="gitRemoteUrl" class="form-control" 
                           placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git"
                           value="${escapeHtml(currentUrl)}">
                    <small class="form-hint">支持 HTTPS 和 SSH 格式</small>
                </div>
                
                <div class="git-credentials-section">
                    <h4 style="margin: 16px 0 12px; font-size: 0.95rem;">凭据配置（可选）</h4>
                    <div class="form-group">
                        <label>用户名</label>
                        <input type="text" id="gitUsername" class="form-control" placeholder="Git 用户名">
                    </div>
                    <div class="form-group">
                        <label>密码 / Token</label>
                        <input type="password" id="gitPassword" class="form-control" placeholder="密码或 Personal Access Token">
                        <small class="form-hint">推荐使用 Personal Access Token 代替密码</small>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeRemoteConfigModal()">取消</button>
                <button type="button" class="btn btn-primary" onclick="saveRemoteConfig()">保存</button>
            </div>
        </div>
    `;
    
    openModal(modal);
}

// 关闭远程配置对话框
function closeRemoteConfigModal() {
    const modal = document.getElementById('gitRemoteModal');
    if (modal) closeModal(modal);
}

// 保存远程配置
async function saveRemoteConfig() {
    const urlInput = document.getElementById('gitRemoteUrl');
    const usernameInput = document.getElementById('gitUsername');
    const passwordInput = document.getElementById('gitPassword');
    
    const url = urlInput ? urlInput.value.trim() : '';
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    
    try {
        if (url) {
            const response = await fetch('/api/git/remote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            if (!data.success) {
                showToast('设置远程仓库失败: ' + data.error, 'error');
                return;
            }
        }
        
        if (username || password) {
            const credResponse = await fetch('/api/git/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password: password,
                    token: password
                })
            });
            
            const credData = await credResponse.json();
            if (!credData.success) {
                showToast('保存凭据失败: ' + credData.error, 'error');
                return;
            }
        }
        
        showToast('配置保存成功', 'success');
        closeRemoteConfigModal();
        await loadGitStatus();
    } catch (e) {
        showToast('保存配置失败: ' + e.message, 'error');
    }
}

// ==================== 工具函数 ====================

// 格式化时间
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 刷新 Git 状态（供外部调用）
async function refreshGitStatus() {
    await loadGitStatus();
}
