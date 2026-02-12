// 知识库编辑器 - 布局管理模块
// 提供面板折叠、拖拽调整宽度、专注模式、布局偏好持久化等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Layout = (function() {
    'use strict';

    const state = EditorApp.State.getState();

    // ==================== 面板切换 ====================

    function toggleFileTree() {
        state.fileTreeCollapsed = !state.fileTreeCollapsed;
        apply();
        savePreferences();
    }

    function toggleGitPanel() {
        state.gitPanelCollapsed = !state.gitPanelCollapsed;
        apply();
        savePreferences();

        // 展开面板时加载 Git 状态
        if (!state.gitPanelCollapsed && EditorApp.Git) {
            EditorApp.Git.loadStatus();
        }
    }

    function toggleChatPanel() {
        state.chatPanelCollapsed = !state.chatPanelCollapsed;
        // 关闭面板时退出全屏
        if (state.chatPanelCollapsed && state.chatMaximized) {
            state.chatMaximized = false;
            applyChatMaximized();
        }
        apply();
        savePreferences();
    }

    function toggleChatMaximized() {
        // 如果面板是折叠的，先展开
        if (state.chatPanelCollapsed) {
            state.chatPanelCollapsed = false;
            apply();
        }
        state.chatMaximized = !state.chatMaximized;
        applyChatMaximized();
        savePreferences();
    }

    function toggleFocusMode() {
        state.focusMode = !state.focusMode;
        applyFocusMode();
        savePreferences();
    }

    // ==================== 布局应用 ====================

    function apply() {
        const fileTreePanel = document.getElementById('fileTreePanel');
        const gitPanel = document.getElementById('gitPanel');
        const chatPanel = document.getElementById('chatPanel');
        const leftResizer = document.getElementById('leftResizer');
        const rightResizer = document.getElementById('rightResizer');
        const chatResizer = document.getElementById('chatResizer');

        if (fileTreePanel) {
            fileTreePanel.classList.toggle('collapsed', state.fileTreeCollapsed);
            if (!state.fileTreeCollapsed) {
                fileTreePanel.style.width = state.fileTreeWidth + 'px';
            }
        }

        if (gitPanel) {
            gitPanel.classList.toggle('collapsed', state.gitPanelCollapsed);
            if (!state.gitPanelCollapsed) {
                gitPanel.style.width = state.gitPanelWidth + 'px';
            }
        }

        if (chatPanel) {
            chatPanel.classList.toggle('collapsed', state.chatPanelCollapsed);
            if (!state.chatPanelCollapsed) {
                chatPanel.style.width = state.chatPanelWidth + 'px';
            }
        }

        if (leftResizer) {
            leftResizer.style.display = state.fileTreeCollapsed ? 'none' : 'block';
        }

        if (rightResizer) {
            rightResizer.style.display = state.gitPanelCollapsed ? 'none' : 'block';
        }

        if (chatResizer) {
            chatResizer.style.display = (state.chatPanelCollapsed || state.chatMaximized) ? 'none' : 'block';
        }

        // 更新活动栏按钮状态
        const fileTreeBtn = document.getElementById('toggleFileTree');
        const gitPanelBtn = document.getElementById('toggleGitPanel');
        const chatPanelBtn = document.getElementById('toggleChatPanel');
        if (fileTreeBtn) {
            fileTreeBtn.classList.toggle('is-active', !state.fileTreeCollapsed);
        }
        if (gitPanelBtn) {
            gitPanelBtn.classList.toggle('is-active', !state.gitPanelCollapsed);
        }
        if (chatPanelBtn) {
            chatPanelBtn.classList.toggle('is-active', !state.chatPanelCollapsed);
        }
    }

    function applyFocusMode() {
        const body = document.body;
        const focusBtn = document.getElementById('toggleFocusMode');
        body.classList.toggle('focus-mode', state.focusMode);
        if (focusBtn) {
            focusBtn.classList.toggle('is-active', state.focusMode);
        }
    }

    function applyChatMaximized() {
        const chatPanel = document.getElementById('chatPanel');
        const overlay = document.getElementById('chatMaximizeOverlay');
        const btn = document.getElementById('chat-maximize-btn');

        if (chatPanel) {
            chatPanel.classList.toggle('maximized', state.chatMaximized);
        }
        if (overlay) {
            overlay.classList.toggle('visible', state.chatMaximized);
        }
        if (btn) {
            btn.textContent = state.chatMaximized ? '⧉' : '⛶';
            btn.title = state.chatMaximized ? '还原 (Ctrl+Shift+M / Esc)' : '全屏 (Ctrl+Shift+M)';
        }

        // 隐藏/显示 chatResizer
        const chatResizer = document.getElementById('chatResizer');
        if (chatResizer) {
            chatResizer.style.display = state.chatMaximized ? 'none' : (state.chatPanelCollapsed ? 'none' : 'block');
        }
    }

    // ==================== 拖拽调整宽度 ====================

    function initResizers() {
        const leftResizer = document.getElementById('leftResizer');
        const rightResizer = document.getElementById('rightResizer');
        const chatResizer = document.getElementById('chatResizer');

        if (!leftResizer || !rightResizer) return;

        let isResizing = false;
        let currentResizer = null;

        function startResize(e, resizer) {
            isResizing = true;
            currentResizer = resizer;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        function doResize(e) {
            if (!isResizing) return;

            if (currentResizer === leftResizer) {
                const width = Math.max(180, Math.min(400, e.clientX));
                state.fileTreeWidth = width;
                document.getElementById('fileTreePanel').style.width = width + 'px';
            } else if (currentResizer === rightResizer) {
                const gitPanel = document.getElementById('gitPanel');
                const chatPanel = document.getElementById('chatPanel');
                const chatCollapsed = state.chatPanelCollapsed;
                const chatWidth = chatCollapsed ? 0 : state.chatPanelWidth;
                const width = Math.max(200, Math.min(400, window.innerWidth - e.clientX - chatWidth));
                state.gitPanelWidth = width;
                gitPanel.style.width = width + 'px';
            } else if (currentResizer === chatResizer) {
                const maxWidth = Math.floor(window.innerWidth * 0.6);
                const width = Math.max(300, Math.min(maxWidth, window.innerWidth - e.clientX));
                state.chatPanelWidth = width;
                document.getElementById('chatPanel').style.width = width + 'px';
            }
        }

        function stopResize() {
            if (!isResizing) return;
            isResizing = false;
            currentResizer.classList.remove('dragging');
            currentResizer = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            savePreferences();
        }

        leftResizer.addEventListener('mousedown', (e) => startResize(e, leftResizer));
        rightResizer.addEventListener('mousedown', (e) => startResize(e, rightResizer));
        if (chatResizer) {
            chatResizer.addEventListener('mousedown', (e) => startResize(e, chatResizer));
        }
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    // ==================== 偏好持久化 ====================

    function loadPreferences() {
        try {
            const prefs = JSON.parse(localStorage.getItem('editorLayout') || '{}');
            if (prefs.fileTreeWidth) state.fileTreeWidth = prefs.fileTreeWidth;
            if (prefs.gitPanelWidth) state.gitPanelWidth = prefs.gitPanelWidth;
            if (prefs.chatPanelWidth) state.chatPanelWidth = prefs.chatPanelWidth;
            if (prefs.fileTreeCollapsed !== undefined) state.fileTreeCollapsed = prefs.fileTreeCollapsed;
            if (prefs.gitPanelCollapsed !== undefined) state.gitPanelCollapsed = prefs.gitPanelCollapsed;
            if (prefs.chatPanelCollapsed !== undefined) state.chatPanelCollapsed = prefs.chatPanelCollapsed;
            if (prefs.chatMaximized !== undefined) state.chatMaximized = prefs.chatMaximized;
            if (prefs.focusMode !== undefined) state.focusMode = prefs.focusMode;
        } catch (e) {
            console.error('加载布局偏好失败:', e);
        }
    }

    function savePreferences() {
        try {
            localStorage.setItem('editorLayout', JSON.stringify({
                fileTreeWidth: state.fileTreeWidth,
                gitPanelWidth: state.gitPanelWidth,
                chatPanelWidth: state.chatPanelWidth,
                fileTreeCollapsed: state.fileTreeCollapsed,
                gitPanelCollapsed: state.gitPanelCollapsed,
                chatPanelCollapsed: state.chatPanelCollapsed,
                chatMaximized: state.chatMaximized,
                focusMode: state.focusMode
            }));
        } catch (e) {
            console.error('保存布局偏好失败:', e);
        }
    }

    // 导出公共接口
    return {
        toggleFileTree: toggleFileTree,
        toggleGitPanel: toggleGitPanel,
        toggleChatPanel: toggleChatPanel,
        toggleChatMaximized: toggleChatMaximized,
        toggleFocusMode: toggleFocusMode,
        apply: apply,
        applyFocusMode: applyFocusMode,
        applyChatMaximized: applyChatMaximized,
        initResizers: initResizers,
        loadPreferences: loadPreferences,
        savePreferences: savePreferences
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.toggleFileTree = EditorApp.Layout.toggleFileTree;
window.toggleGitPanel = EditorApp.Layout.toggleGitPanel;
window.toggleChatPanel = EditorApp.Layout.toggleChatPanel;
window.toggleChatMaximized = EditorApp.Layout.toggleChatMaximized;
window.toggleFocusMode = EditorApp.Layout.toggleFocusMode;
window.applyLayout = EditorApp.Layout.apply;
window.applyFocusMode = EditorApp.Layout.applyFocusMode;
window.initResizers = EditorApp.Layout.initResizers;
window.loadLayoutPreferences = EditorApp.Layout.loadPreferences;
window.saveLayoutPreferences = EditorApp.Layout.savePreferences;

// 全屏按钮和遮罩层事件绑定（DOM 就绪后）
document.addEventListener('DOMContentLoaded', function() {
    const maximizeBtn = document.getElementById('chat-maximize-btn');
    const overlay = document.getElementById('chatMaximizeOverlay');

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', function() {
            EditorApp.Layout.toggleChatMaximized();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function() {
            EditorApp.Layout.toggleChatMaximized();
        });
    }

    // 恢复全屏状态
    EditorApp.Layout.applyChatMaximized();
});
