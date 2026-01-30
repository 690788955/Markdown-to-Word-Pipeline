// 知识库编辑器 - 自动保存模块
// 提供定时自动保存功能，支持配置和状态指示

window.EditorApp = window.EditorApp || {};

EditorApp.AutoSave = (function() {
    'use strict';

    const STORAGE_KEY = 'editorAutoSave';
    const DEFAULT_INTERVAL = 30; // 秒

    // ==================== 初始化 ====================

    function init() {
        loadSettings();
        start();
        updateStatusUI();
    }

    function loadSettings() {
        const state = EditorApp.State.getState();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                state.autoSave.enabled = settings.enabled !== false;
                state.autoSave.interval = settings.interval || DEFAULT_INTERVAL;
            }
        } catch (e) {
            console.warn('加载自动保存设置失败:', e);
        }
    }

    function saveSettings() {
        const state = EditorApp.State.getState();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                enabled: state.autoSave.enabled,
                interval: state.autoSave.interval
            }));
        } catch (e) {
            console.warn('保存自动保存设置失败:', e);
        }
    }

    // ==================== 定时器管理 ====================

    function start() {
        const state = EditorApp.State.getState();

        // 清除现有定时器
        if (state.autoSave.timerId) {
            clearInterval(state.autoSave.timerId);
            state.autoSave.timerId = null;
        }

        if (!state.autoSave.enabled) return;

        // 启动新定时器
        state.autoSave.timerId = setInterval(() => {
            save();
        }, state.autoSave.interval * 1000);
    }

    function stop() {
        const state = EditorApp.State.getState();
        if (state.autoSave.timerId) {
            clearInterval(state.autoSave.timerId);
            state.autoSave.timerId = null;
        }
    }

    // ==================== 保存操作 ====================

    async function save() {
        const state = EditorApp.State.getState();

        // 检查是否有未保存的更改
        const dirtyTabs = state.tabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) return;

        try {
            // 保存当前活动文件
            if (state.activeTabId) {
                const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                if (activeTab && activeTab.isDirty) {
                    await EditorApp.Vditor.saveCurrentFile(true); // 静默保存
                    state.autoSave.lastSaveTime = new Date();
                    updateStatusUI();
                }
            }
        } catch (e) {
            console.error('自动保存失败:', e);
            EditorApp.Utils.showToast('自动保存失败', 'error');
        }
    }

    // ==================== 设置管理 ====================

    function getSettings() {
        const state = EditorApp.State.getState();
        return {
            enabled: state.autoSave.enabled,
            interval: state.autoSave.interval
        };
    }

    function updateSettings(settings) {
        const state = EditorApp.State.getState();

        if (typeof settings.enabled === 'boolean') {
            state.autoSave.enabled = settings.enabled;
        }

        if (typeof settings.interval === 'number' && settings.interval > 0) {
            state.autoSave.interval = settings.interval;
        }

        saveSettings();

        // 重启定时器
        stop();
        start();
    }

    function getLastSaveTime() {
        const state = EditorApp.State.getState();
        return state.autoSave.lastSaveTime;
    }

    // ==================== UI 更新 ====================

    function updateStatusUI() {
        const state = EditorApp.State.getState();
        const statusElement = document.getElementById('autoSaveStatus');

        if (!statusElement) return;

        if (!state.autoSave.enabled) {
            statusElement.textContent = '自动保存: 关闭';
            statusElement.classList.remove('active');
            return;
        }

        if (state.autoSave.lastSaveTime) {
            const time = formatTime(state.autoSave.lastSaveTime);
            statusElement.textContent = `上次保存: ${time}`;
        } else {
            statusElement.textContent = `自动保存: ${state.autoSave.interval}秒`;
        }
        statusElement.classList.add('active');
    }

    function formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // 导出公共接口
    return {
        init: init,
        start: start,
        stop: stop,
        save: save,
        getSettings: getSettings,
        updateSettings: updateSettings,
        getLastSaveTime: getLastSaveTime,
        updateStatusUI: updateStatusUI
    };
})();
