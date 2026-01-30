// 知识库编辑器 - 主入口模块
// 负责初始化所有模块和绑定全局事件

(function() {
    'use strict';

    window.EditorApp = window.EditorApp || {};

    // ==================== 初始化 ====================

    function init() {
        // 初始化主题
        EditorApp.Theme.init();

        // 加载布局偏好
        EditorApp.Layout.loadPreferences();

        // 初始化文件树
        EditorApp.Tree.load();

        // 初始化 Git 面板（仅在面板展开时加载）
        const state = EditorApp.State.getState();
        if (!state.gitPanelCollapsed) {
            EditorApp.Git.loadStatus();
        }

        // 初始化默认编辑模式选择
        EditorApp.Vditor.initDefaultMode();

        // 绑定事件
        bindEvents();

        // 应用布局
        EditorApp.Layout.apply();
        EditorApp.Layout.applyFocusMode();

        // 初始化附件面板
        EditorApp.Attachments.init();

        // 初始化新模块
        if (EditorApp.Loading) EditorApp.Loading.init();
        if (EditorApp.RecentFiles) EditorApp.RecentFiles.init();
        if (EditorApp.QuickOpen) EditorApp.QuickOpen.init();
        if (EditorApp.CommandPalette) EditorApp.CommandPalette.init();
        if (EditorApp.AutoSave) EditorApp.AutoSave.init();
        if (EditorApp.Breadcrumb) EditorApp.Breadcrumb.init();
        if (EditorApp.VersionHistory) EditorApp.VersionHistory.init();
    }

    // ==================== 事件绑定 ====================

    function bindEvents() {
        // 面板切换按钮
        document.getElementById('toggleFileTree').addEventListener('click', EditorApp.Layout.toggleFileTree);
        document.getElementById('toggleGitPanel').addEventListener('click', EditorApp.Layout.toggleGitPanel);

        // 文件树操作
        document.getElementById('newFileBtn').addEventListener('click', EditorApp.Files.showNewModal);
        document.getElementById('refreshTreeBtn').addEventListener('click', EditorApp.Tree.load);
        document.getElementById('fileSearch').addEventListener('input', EditorApp.Tree.onSearchInput);

        // Git 操作
        document.getElementById('gitRefreshBtn').addEventListener('click', EditorApp.Git.loadStatus);

        // 默认编辑模式
        const modeSelect = document.getElementById('defaultEditorMode');
        if (modeSelect) {
            modeSelect.addEventListener('change', EditorApp.Vditor.onModeChange);
        }

        // Git 远程标签点击事件（事件委托）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.git-remote-tag')) {
                EditorApp.Git.showRemoteConfig();
            }
        });

        // 拖拽调整宽度
        EditorApp.Layout.initResizers();

        // 右键菜单
        document.addEventListener('contextmenu', EditorApp.Files.onContextMenu);
        document.addEventListener('click', EditorApp.Files.hideContextMenu);
        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', EditorApp.Files.onContextAction);
        });

        // 主题控制
        EditorApp.Theme.initControls();

        // 键盘快捷键
        document.addEventListener('keydown', onKeyDown);

        // 离开页面提示
        window.addEventListener('beforeunload', onBeforeUnload);

        // 返回按钮
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', onBackClick);
        }
    }

    // ==================== 键盘快捷键 ====================

    function onKeyDown(e) {
        const state = EditorApp.State.getState();
        
        // Ctrl+S 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            EditorApp.Vditor.saveCurrentFile();
        }

        // Ctrl+W 关闭标签
        if (e.ctrlKey && e.key === 'w') {
            e.preventDefault();
            if (state.activeTabId) {
                EditorApp.Tabs.close(state.activeTabId);
            }
        }

        // Ctrl+P 快速打开
        if (e.ctrlKey && !e.shiftKey && e.key === 'p') {
            e.preventDefault();
            if (EditorApp.QuickOpen) {
                EditorApp.QuickOpen.show();
            }
        }

        // Ctrl+Shift+P 命令面板
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            if (EditorApp.CommandPalette) {
                EditorApp.CommandPalette.show();
            }
        }

        // Escape 关闭菜单/模态框/对话框
        if (e.key === 'Escape') {
            EditorApp.Files.hideContextMenu();
            if (EditorApp.QuickOpen && state.quickOpen && state.quickOpen.visible) {
                EditorApp.QuickOpen.hide();
            }
            if (EditorApp.CommandPalette && state.commandPalette && state.commandPalette.visible) {
                EditorApp.CommandPalette.hide();
            }
        }
    }

    // ==================== 未保存提示 ====================

    function showUnsavedModal() {
        EditorApp.Utils.openModal(document.getElementById('unsavedModal'));
    }

    function hideUnsavedModal() {
        const state = EditorApp.State.getState();
        EditorApp.Utils.closeModal(document.getElementById('unsavedModal'));
        state.pendingCloseTabId = null;
    }

    async function saveAndClose() {
        const state = EditorApp.State.getState();
        await EditorApp.Vditor.saveCurrentFile();
        hideUnsavedModal();
        if (state.pendingCloseTabId) {
            EditorApp.Tabs.close(state.pendingCloseTabId, true);
        }
    }

    function discardChanges() {
        const state = EditorApp.State.getState();
        const tabId = state.pendingCloseTabId; // 先保存 tabID
        hideUnsavedModal(); // 这会清空 pendingCloseTabId

        if (tabId) {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isDirty = false;
            }
            EditorApp.Tabs.close(tabId, true);
        }
    }

    function onBeforeUnload(e) {
        const state = EditorApp.State.getState();
        const hasUnsaved = state.tabs.some(t => t.isDirty);
        if (hasUnsaved) {
            e.preventDefault();
            e.returnValue = '有未保存的更改，确定要离开吗？';
            return e.returnValue;
        }
    }

    function onBackClick(e) {
        const state = EditorApp.State.getState();
        const hasUnsaved = state.tabs.some(t => t.isDirty);
        if (hasUnsaved) {
            e.preventDefault();
            if (confirm('有未保存的更改，确定要离开吗？')) {
                window.location.href = '/';
            }
        }
    }

    // ==================== 暴露接口 ====================

    EditorApp.init = init;
    EditorApp.Main = {
        init: init,
        bindEvents: bindEvents,
        onKeyDown: onKeyDown,
        showUnsavedModal: showUnsavedModal,
        hideUnsavedModal: hideUnsavedModal,
        saveAndClose: saveAndClose,
        discardChanges: discardChanges
    };

    // 暴露到全局作用域（向后兼容）
    window.showUnsavedModal = showUnsavedModal;
    window.hideUnsavedModal = hideUnsavedModal;
    window.saveAndClose = saveAndClose;
    window.discardChanges = discardChanges;

    // DOM 加载完成后初始化
    document.addEventListener('DOMContentLoaded', init);

})();
