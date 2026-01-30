// 知识库编辑器 - Git 面板模块
// 提供 Git 状态、暂存区操作、提交、推送、拉取、远程配置等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Git = (function() {
    'use strict';

    const state = EditorApp.State.getState();
    
    // 模块私有状态
    let gitStagedChanges = [];
    let gitUnstagedChanges = [];

    // ==================== 状态加载 ====================

    async function loadStatus() {
        const container = document.getElementById('gitContent');
        const refreshBtn = document.getElementById('gitRefreshBtn');

        if (refreshBtn) refreshBtn.classList.add('rotating');

        if (!state.gitStatus && container && container.children.length === 0) {
            container.innerHTML = '<div class="git-loading">加载中...</div>';
        }

        try {
            const [statusRes, changesRes] = await Promise.all([
                fetch('/api/git/status'),
                fetch('/api/git/changes')
            ]);

            const statusData = await statusRes.json();
            const changesData = await changesRes.json();

            if (!statusData.success) {
                renderNotRepo(container);
                return;
            }

            state.gitStatus = statusData.data;

            if (changesData.success && changesData.data) {
                gitStagedChanges = (changesData.data.staged || []).filter(c => c.directory === 'src');
                gitUnstagedChanges = (changesData.data.unstaged || []).filter(c => c.directory === 'src');
            } else {
                gitStagedChanges = [];
                gitUnstagedChanges = [];
            }

            renderPanel();
            updateBadge();
        } catch (e) {
            if (!state.gitStatus) {
                if (container) container.innerHTML = '<div class="git-loading">加载失败</div>';
            } else {
                EditorApp.Utils.showToast('Git 状态刷新失败', 'error');
            }
            console.error('加载 Git 状态失败:', e);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('rotating');
        }
    }

    function updateBadge() {
        const badge = document.getElementById('gitBadge');
        if (!badge) return;
        
        const count = gitStagedChanges.length + gitUnstagedChanges.length;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ==================== 面板渲染 ====================

    function renderNotRepo(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="git-status">
                <p style="color: #999; text-align: center;">当前目录不是 Git 仓库</p>
                <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="EditorApp.Git.initRepo()">
                    初始化仓库
                </button>
            </div>
        `;
    }

    function renderPanel() {
        const container = document.getElementById('gitContent');
        if (!container) return;

        if (!state.gitStatus || !state.gitStatus.isRepository) {
            renderNotRepo(container);
            return;
        }

        let html = '';

        // 分支状态
        const remoteTag = state.gitStatus.hasRemote
            ? '<span class="git-remote-tag" title="点击配置远程仓库">🔗 origin</span>'
            : '<span class="git-remote-tag git-no-remote" title="点击配置远程仓库">⚠️ 未配置远程</span>';
        html += `
            <div class="git-status">
                <div class="git-branch">
                    <span class="git-branch-icon">⎇</span>
                    <span>${state.gitStatus.branch || 'main'}</span>
                </div>
                ${remoteTag}
            </div>
        `;

        // 提交区域
        html += `
            <div class="git-commit-section" style="margin-bottom: 12px;">
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="commitMessage" class="git-commit-input" placeholder="提交信息..." style="flex: 1; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px;">
                    <button class="btn btn-primary" onclick="EditorApp.Git.commit()" title="提交暂存的更改" id="gitCommitBtn" style="padding: 6px 12px;">✓</button>
                </div>
                <div class="git-actions" style="display: flex; gap: 6px;">
                    <button class="btn btn-outline btn-sm" onclick="EditorApp.Git.push()" style="flex: 1;">↑ 推送</button>
                    <button class="btn btn-outline btn-sm" onclick="EditorApp.Git.pull()" style="flex: 1;">↓ 拉取</button>
                </div>
            </div>
        `;

        // 暂存的更改区域
        html += renderStagedSection();

        // 更改区域（未暂存）
        html += renderUnstagedSection();

        container.innerHTML = html;
        updateCommitButtonState();
    }

    function renderStagedSection() {
        const count = gitStagedChanges.length;

        let html = `
            <div class="git-changes-section git-staged-section">
                <div class="git-section-header" onclick="EditorApp.Git.toggleSection(this)">
                    <span class="git-section-toggle">▼</span>
                    <span>暂存的更改</span>
                    <span class="git-section-count">${count}</span>
                    <div class="git-section-actions">
                        <button class="git-section-btn" onclick="event.stopPropagation(); EditorApp.Git.unstageAllFiles()" title="取消暂存全部">−</button>
                    </div>
                </div>
                <div class="git-section-content">
        `;

        if (count === 0) {
            html += '<div class="git-empty-hint">没有暂存的更改</div>';
        } else {
            for (const file of gitStagedChanges) {
                html += renderFileItem(file, true);
            }
        }

        html += '</div></div>';
        return html;
    }

    function renderUnstagedSection() {
        const count = gitUnstagedChanges.length;

        let html = `
            <div class="git-changes-section git-unstaged-section">
                <div class="git-section-header" onclick="EditorApp.Git.toggleSection(this)">
                    <span class="git-section-toggle">▼</span>
                    <span>更改</span>
                    <span class="git-section-count">${count}</span>
                    <div class="git-section-actions">
                        <button class="git-section-btn" onclick="event.stopPropagation(); EditorApp.Git.stageAllFiles()" title="暂存全部">+</button>
                    </div>
                </div>
                <div class="git-section-content">
        `;

        if (count === 0) {
            html += '<div class="git-empty-hint">没有更改的文件</div>';
        } else {
            for (const file of gitUnstagedChanges) {
                html += renderFileItem(file, false);
            }
        }

        html += '</div></div>';
        return html;
    }

    function renderFileItem(file, isStaged) {
        const statusLetter = getStatusLetter(file.status);
        const statusClass = getStatusColorClass(file.status);
        const displayPath = file.path.replace('src/', '');
        const escapedPath = EditorApp.Utils.escapeHtmlAttr(file.path);

        let actionsHtml = '';
        if (isStaged) {
            actionsHtml = `<button class="git-file-btn" onclick="EditorApp.Git.unstageFile('${escapedPath}')" title="取消暂存">−</button>`;
        } else {
            actionsHtml = `<button class="git-file-btn git-discard-btn" onclick="EditorApp.Git.discardFile('${escapedPath}')" title="放弃更改">↺</button>` +
                `<button class="git-file-btn" onclick="EditorApp.Git.stageFile('${escapedPath}')" title="暂存">+</button>`;
        }

        return `<div class="git-file-item">
            <span class="git-file-name" title="${escapedPath}">${EditorApp.Utils.escapeHtmlAttr(displayPath)}</span>
            <div class="git-file-actions">${actionsHtml}</div>
            <span class="git-file-status ${statusClass}">${statusLetter}</span>
        </div>`;
    }

    // ==================== 暂存区操作 ====================

    async function stageFile(filePath) {
        try {
            const response = await fetch('/api/git/stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: [filePath] })
            });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('暂存失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('暂存失败: ' + e.message, 'error');
        }
    }

    async function unstageFile(filePath) {
        try {
            const response = await fetch('/api/git/unstage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: [filePath] })
            });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('取消暂存失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('取消暂存失败: ' + e.message, 'error');
        }
    }

    async function stageAllFiles() {
        try {
            const response = await fetch('/api/git/stage-all', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('暂存全部失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('暂存全部失败: ' + e.message, 'error');
        }
    }

    async function unstageAllFiles() {
        try {
            const response = await fetch('/api/git/unstage-all', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('取消暂存全部失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('取消暂存全部失败: ' + e.message, 'error');
        }
    }

    async function discardFile(filePath) {
        const fileName = filePath.split('/').pop();
        if (!confirm('确定要放弃对 "' + fileName + '" 的更改吗？\n\n此操作不可撤销！')) {
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
                EditorApp.Utils.showToast('已放弃更改', 'success');
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('放弃更改失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('放弃更改失败: ' + e.message, 'error');
        }
    }

    // ==================== Git 操作 ====================

    async function initRepo() {
        try {
            const response = await fetch('/api/git/init', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('Git 仓库初始化成功', 'success');
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('初始化失败: ' + e.message, 'error');
        }
    }

    async function commit() {
        const msgInput = document.getElementById('commitMessage');
        let message = msgInput ? msgInput.value.trim() : '';

        if (!message) {
            const now = new Date();
            message = '更新 ' + now.toLocaleString('zh-CN');
        }

        if (gitStagedChanges.length === 0) {
            EditorApp.Utils.showToast('暂存区为空，请先暂存要提交的文件', 'info');
            return;
        }

        try {
            const response = await fetch('/api/git/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('提交成功: ' + data.data.hash, 'success');
            if (msgInput) msgInput.value = '';
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('提交失败: ' + e.message, 'error');
        }
    }

    async function push() {
        try {
            const response = await fetch('/api/git/push', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('推送成功', 'success');
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('推送失败: ' + e.message, 'error');
        }
    }

    async function pull() {
        try {
            const response = await fetch('/api/git/pull', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('拉取成功', 'success');
            loadStatus();
            if (EditorApp.Tree) {
                EditorApp.Tree.load();
            }
        } catch (e) {
            EditorApp.Utils.showToast('拉取失败: ' + e.message, 'error');
        }
    }

    // ==================== 远程配置 ====================

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
            modal.innerHTML = createRemoteConfigModalHTML();
            document.body.appendChild(modal);
        }

        const urlInput = modal.querySelector('#gitRemoteUrl');
        if (urlInput) urlInput.value = currentUrl;

        EditorApp.Utils.openModal(modal);
    }

    function createRemoteConfigModalHTML() {
        return `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h3>🔗 远程仓库配置</h3>
                    <button type="button" class="modal-close" onclick="EditorApp.Git.closeRemoteConfigModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>远程仓库 URL</label>
                        <input type="text" id="gitRemoteUrl" class="form-control"
                               placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git">
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
                    <button type="button" class="btn btn-outline" onclick="EditorApp.Git.closeRemoteConfigModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="EditorApp.Git.saveRemoteConfig()">保存</button>
                </div>
            </div>
        `;
    }

    function closeRemoteConfigModal() {
        const modal = document.getElementById('gitRemoteModal');
        if (modal) EditorApp.Utils.closeModal(modal);
    }

    async function saveRemoteConfig() {
        const urlInput = document.getElementById('gitRemoteUrl');
        const usernameInput = document.getElementById('gitUsername');
        const passwordInput = document.getElementById('gitPassword');

        const url = urlInput ? urlInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        let hasError = false;

        try {
            if (url) {
                const response = await fetch('/api/git/remote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                const data = await response.json();
                if (!data.success) {
                    EditorApp.Utils.showToast('设置远程仓库失败: ' + data.error, 'error');
                    hasError = true;
                }
            }

            if ((username || password) && !hasError) {
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
                    EditorApp.Utils.showToast('保存凭据失败: ' + credData.error, 'error');
                    hasError = true;
                }
            }

            if (!hasError) {
                EditorApp.Utils.showToast('配置保存成功', 'success');
                closeRemoteConfigModal();
                await loadStatus();
            }
        } catch (e) {
            EditorApp.Utils.showToast('保存配置失败: ' + e.message, 'error');
        }
    }

    // ==================== 工具函数 ====================

    function getStatusLetter(status) {
        const letters = {
            'M': 'M', 'A': 'A', 'D': 'D', 'U': 'U', 'R': 'R',
            'modified': 'M', 'added': 'A', 'deleted': 'D', 'untracked': 'U', 'renamed': 'R'
        };
        return letters[status] || '?';
    }

    function getStatusColorClass(status) {
        const classes = {
            'M': 'status-modified', 'A': 'status-added', 'D': 'status-deleted', 'U': 'status-untracked', 'R': 'status-renamed',
            'modified': 'status-modified', 'added': 'status-added', 'deleted': 'status-deleted', 'untracked': 'status-untracked', 'renamed': 'status-renamed'
        };
        return classes[status] || 'status-unknown';
    }

    function toggleSection(header) {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    }

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

    // 导出公共接口
    return {
        loadStatus: loadStatus,
        updateBadge: updateBadge,
        renderPanel: renderPanel,
        renderNotRepo: renderNotRepo,
        stageFile: stageFile,
        unstageFile: unstageFile,
        stageAllFiles: stageAllFiles,
        unstageAllFiles: unstageAllFiles,
        discardFile: discardFile,
        initRepo: initRepo,
        commit: commit,
        push: push,
        pull: pull,
        showRemoteConfig: showRemoteConfig,
        saveRemoteConfig: saveRemoteConfig,
        closeRemoteConfigModal: closeRemoteConfigModal,
        getStatusLetter: getStatusLetter,
        getStatusColorClass: getStatusColorClass,
        toggleSection: toggleSection
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.loadGitStatus = EditorApp.Git.loadStatus;
window.updateGitBadge = EditorApp.Git.updateBadge;
window.renderGitPanel = EditorApp.Git.renderPanel;
window.stageFile = EditorApp.Git.stageFile;
window.unstageFile = EditorApp.Git.unstageFile;
window.stageAllFiles = EditorApp.Git.stageAllFiles;
window.unstageAllFiles = EditorApp.Git.unstageAllFiles;
window.discardFile = EditorApp.Git.discardFile;
window.initGitRepo = EditorApp.Git.initRepo;
window.commitChanges = EditorApp.Git.commit;
window.pushChanges = EditorApp.Git.push;
window.pullChanges = EditorApp.Git.pull;
window.showRemoteConfig = EditorApp.Git.showRemoteConfig;
window.toggleGitSection = EditorApp.Git.toggleSection;
