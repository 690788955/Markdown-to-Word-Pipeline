// 知识库编辑器 - 版本历史模块
// 提供文件 Git 历史查看和版本对比功能

window.EditorApp = window.EditorApp || {};

EditorApp.VersionHistory = (function() {
    'use strict';

    // 内部状态
    let currentPath = null;
    let commits = [];
    let selectedCommit = null;
    let isVisible = false;

    // DOM 元素
    let panel = null;
    let commitList = null;
    let contentViewer = null;

    // ==================== 初始化 ====================

    function init() {
        createPanel();
        bindEvents();
        console.log('[VersionHistory] 初始化完成');
    }

    function createPanel() {
        // 检查是否已存在
        if (document.getElementById('versionHistoryPanel')) {
            panel = document.getElementById('versionHistoryPanel');
            commitList = panel.querySelector('.history-commit-list');
            contentViewer = panel.querySelector('.history-content-viewer');
            return;
        }

        panel = document.createElement('div');
        panel.id = 'versionHistoryPanel';
        panel.className = 'version-history-panel';
        panel.innerHTML = `
            <div class="history-header">
                <h3>版本历史</h3>
                <button class="history-close-btn" title="关闭">×</button>
            </div>
            <div class="history-body">
                <div class="history-sidebar">
                    <div class="history-file-path"></div>
                    <div class="history-commit-list"></div>
                </div>
                <div class="history-main">
                    <div class="history-content-header">
                        <span class="history-commit-info"></span>
                    </div>
                    <div class="history-content-viewer">
                        <div class="history-placeholder">选择一个版本查看内容</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        commitList = panel.querySelector('.history-commit-list');
        contentViewer = panel.querySelector('.history-content-viewer');
    }

    function bindEvents() {
        if (!panel) return;

        // 关闭按钮
        const closeBtn = panel.querySelector('.history-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hide);
        }

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isVisible) {
                hide();
            }
        });
    }

    // ==================== 显示/隐藏 ====================

    async function show(path) {
        if (!path) {
            EditorApp.Utils.showToast('请先选择一个文件', 'warning');
            return;
        }

        currentPath = path;
        isVisible = true;

        // 显示面板
        if (panel) {
            panel.classList.add('is-open');
        }

        // 更新文件路径显示
        const filePathEl = panel.querySelector('.history-file-path');
        if (filePathEl) {
            filePathEl.textContent = path;
        }

        // 清空之前的内容
        if (commitList) {
            commitList.innerHTML = '<div class="history-loading">加载中...</div>';
        }
        if (contentViewer) {
            contentViewer.innerHTML = '<div class="history-placeholder">选择一个版本查看内容</div>';
        }

        // 加载历史
        try {
            await loadHistory(path);
        } catch (e) {
            console.error('[VersionHistory] 加载历史失败:', e);
            EditorApp.Utils.showToast('加载版本历史失败: ' + e.message, 'error');
        }
    }

    function hide() {
        isVisible = false;
        currentPath = null;
        commits = [];
        selectedCommit = null;

        if (panel) {
            panel.classList.remove('is-open');
        }
    }

    // ==================== 数据加载 ====================

    async function loadHistory(path) {
        const response = await fetch('/api/git/file-history?path=' + encodeURIComponent(path) + '&limit=50');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '获取历史失败');
        }

        commits = data.data.commits || [];
        renderCommitList();
    }

    async function loadVersionContent(commit) {
        if (!currentPath || !commit) return;

        selectedCommit = commit;

        // 更新提交信息显示
        const commitInfo = panel.querySelector('.history-commit-info');
        if (commitInfo) {
            commitInfo.innerHTML = `
                <span class="commit-hash">${commit.shortHash}</span>
                <span class="commit-author">${commit.author}</span>
                <span class="commit-date">${commit.date}</span>
            `;
        }

        // 显示加载状态
        if (contentViewer) {
            contentViewer.innerHTML = '<div class="history-loading">加载中...</div>';
        }

        try {
            const response = await fetch(
                '/api/git/file-show?path=' + encodeURIComponent(currentPath) +
                '&commit=' + encodeURIComponent(commit.hash)
            );
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '获取文件内容失败');
            }

            renderContent(data.data.content);
        } catch (e) {
            console.error('[VersionHistory] 加载版本内容失败:', e);
            if (contentViewer) {
                contentViewer.innerHTML = `<div class="history-error">加载失败: ${e.message}</div>`;
            }
        }
    }

    // ==================== 渲染 ====================

    function renderCommitList() {
        if (!commitList) return;

        if (commits.length === 0) {
            commitList.innerHTML = '<div class="history-empty">此文件没有版本历史</div>';
            return;
        }

        commitList.innerHTML = '';

        commits.forEach((commit, index) => {
            const item = document.createElement('div');
            item.className = 'history-commit-item';
            item.dataset.index = index;

            item.innerHTML = `
                <div class="commit-header">
                    <span class="commit-hash">${commit.shortHash}</span>
                    <span class="commit-date">${commit.date}</span>
                </div>
                <div class="commit-message">${escapeHtml(commit.message)}</div>
                <div class="commit-author">${escapeHtml(commit.author)}</div>
            `;

            item.addEventListener('click', () => {
                // 更新选中状态
                commitList.querySelectorAll('.history-commit-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');

                // 加载内容
                loadVersionContent(commit);
            });

            commitList.appendChild(item);
        });
    }

    function renderContent(content) {
        if (!contentViewer) return;

        // 创建代码高亮显示
        const pre = document.createElement('pre');
        pre.className = 'history-content-code';

        const code = document.createElement('code');
        code.className = 'language-markdown';
        code.textContent = content;

        pre.appendChild(code);
        contentViewer.innerHTML = '';
        contentViewer.appendChild(pre);

        // 如果有 hljs，进行语法高亮
        if (typeof hljs !== 'undefined') {
            hljs.highlightElement(code);
        }
    }

    // ==================== 工具函数 ====================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isOpen() {
        return isVisible;
    }

    function getCurrentPath() {
        return currentPath;
    }

    function getCommits() {
        return commits;
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        loadHistory: loadHistory,
        loadVersionContent: loadVersionContent,
        isOpen: isOpen,
        getCurrentPath: getCurrentPath,
        getCommits: getCommits
    };
})();
