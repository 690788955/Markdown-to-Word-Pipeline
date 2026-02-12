// 知识库编辑器 - 状态管理模块
// 提供全局状态对象和访问接口

window.EditorApp = window.EditorApp || {};

EditorApp.State = (function() {
    'use strict';

    // ==================== 主状态对象 ====================

    const state = {
        // 文件树状态
        fileTree: null,
        expandedDirs: new Set(),
        selectedFile: null,
        searchQuery: '',

        // 标签状态
        tabs: [],
        activeTabId: null,
        editors: new Map(),

        // Git 状态
        gitStatus: null,
        gitChanges: [],
        selectedChanges: new Set(),

        // 布局状态
        fileTreeWidth: 240,
        gitPanelWidth: 320,
        chatPanelWidth: 380,
        fileTreeCollapsed: false,
        gitPanelCollapsed: true,
        chatPanelCollapsed: true,
        chatMaximized: false,
        focusMode: false,

        // 操作状态
        contextMenuTarget: null,
        pendingCloseTabId: null,
        renameTarget: null,

        // 拖拽排序
        draggingPath: null,
        draggingParent: null,

        // 附件面板状态
        attachments: [],
        attachmentExpanded: false,
        attachmentLoading: false,
        attachmentTarget: null,  // 右键菜单目标附件

        // 快速打开状态
        quickOpen: {
            visible: false,
            query: '',
            results: [],
            selectedIndex: 0
        },

        // 命令面板状态
        commandPalette: {
            visible: false,
            query: '',
            filteredCommands: [],
            selectedIndex: 0
        },

        // 自动保存状态
        autoSave: {
            enabled: true,
            interval: 30,
            lastSaveTime: null,
            timerId: null
        },

        // 最近文件
        recentFiles: [],

        // 加载状态
        loading: {
            visible: false,
            message: '',
            progress: 0
        },

        // 版本历史
        versionHistory: {
            visible: false,
            path: null,
            commits: [],
            selectedCommit: null
        },

        // 编辑器缓存
        editorCache: {
            active: new Map(),
            pool: [],
            maxSize: 5
        }
    };

    // ==================== 主题状态对象 ====================

    const themeState = {
        theme: 'light',
        accent: '#1a8fbf',
        contentStyle: 'comfortable',
        contentWidth: 'medium',   // 内容宽度: narrow, medium, wide, full
        codeTheme: 'github',      // 代码块主题 ID
        codeThemeManual: false,   // 是否手动选择
        // 字体设置
        font: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 16,
            lineHeight: 1.6
        },
        // 当前预设 ID
        currentPreset: null
    };

    // ==================== 访问接口 ====================

    /**
     * 获取主状态对象
     * @returns {Object} 状态对象引用
     */
    function getState() {
        return state;
    }

    /**
     * 获取主题状态对象
     * @returns {Object} 主题状态对象引用
     */
    function getThemeState() {
        return themeState;
    }

    // 导出公共接口
    return {
        getState: getState,
        getThemeState: getThemeState
    };
})();

// 为了向后兼容，将状态对象暴露到全局作用域
window.state = EditorApp.State.getState();
window.themeState = EditorApp.State.getThemeState();
