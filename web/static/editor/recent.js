// 知识库编辑器 - 最近文件管理模块
// 提供最近打开文件的记录、持久化和管理功能

window.EditorApp = window.EditorApp || {};

EditorApp.RecentFiles = (function() {
    'use strict';

    const STORAGE_KEY = 'editorRecentFiles';
    const MAX_SIZE = 20;

    // ==================== 初始化 ====================

    function init() {
        load();
    }

    // ==================== 持久化 ====================

    function load() {
        const state = EditorApp.State.getState();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                state.recentFiles = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('加载最近文件列表失败:', e);
            state.recentFiles = [];
        }
    }

    function save() {
        const state = EditorApp.State.getState();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recentFiles));
        } catch (e) {
            console.warn('保存最近文件列表失败:', e);
        }
    }

    // ==================== 列表操作 ====================

    /**
     * 添加文件到最近列表
     * @param {string} path - 文件路径
     */
    function add(path) {
        if (!path) return;

        const state = EditorApp.State.getState();
        const name = path.split('/').pop();
        const timestamp = Date.now();

        // 移除已存在的相同路径
        state.recentFiles = state.recentFiles.filter(f => f.path !== path);

        // 添加到列表开头
        state.recentFiles.unshift({
            path: path,
            name: name,
            timestamp: timestamp
        });

        // 限制列表大小
        if (state.recentFiles.length > MAX_SIZE) {
            state.recentFiles = state.recentFiles.slice(0, MAX_SIZE);
        }

        save();
    }

    /**
     * 获取最近文件列表
     * @returns {Array} 最近文件列表，按时间戳降序排列
     */
    function getList() {
        const state = EditorApp.State.getState();
        return state.recentFiles.slice().sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 清除最近文件列表
     */
    function clear() {
        const state = EditorApp.State.getState();
        state.recentFiles = [];
        save();
    }

    /**
     * 移除无效条目（文件已不存在）
     * @param {Set<string>} validPaths - 有效文件路径集合
     */
    function removeInvalid(validPaths) {
        const state = EditorApp.State.getState();
        const before = state.recentFiles.length;
        state.recentFiles = state.recentFiles.filter(f => validPaths.has(f.path));
        if (state.recentFiles.length !== before) {
            save();
        }
    }

    /**
     * 移除指定文件
     * @param {string} path - 文件路径
     */
    function remove(path) {
        const state = EditorApp.State.getState();
        state.recentFiles = state.recentFiles.filter(f => f.path !== path);
        save();
    }

    // 导出公共接口
    return {
        init: init,
        add: add,
        getList: getList,
        clear: clear,
        removeInvalid: removeInvalid,
        remove: remove
    };
})();
