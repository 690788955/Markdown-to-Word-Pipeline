// 知识库编辑器 - 加载指示器模块
// 提供加载状态显示、进度条、操作状态反馈等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Loading = (function() {
    'use strict';

    let loadingElement = null;
    let progressBar = null;
    let messageElement = null;

    // ==================== 初始化 ====================

    function init() {
        createLoadingElement();
    }

    function createLoadingElement() {
        if (loadingElement) return;

        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingIndicator';
        loadingElement.className = 'loading-indicator';
        loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <span class="loading-message">加载中...</span>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        document.body.appendChild(loadingElement);

        messageElement = loadingElement.querySelector('.loading-message');
        progressBar = loadingElement.querySelector('.loading-progress-bar');
    }

    // ==================== 显示/隐藏 ====================

    function show(message) {
        const state = EditorApp.State.getState();
        state.loading.visible = true;
        state.loading.message = message || '加载中...';
        state.loading.progress = 0;

        if (!loadingElement) createLoadingElement();

        messageElement.textContent = state.loading.message;
        progressBar.style.width = '0%';
        loadingElement.classList.add('visible');
    }

    function hide() {
        const state = EditorApp.State.getState();
        state.loading.visible = false;
        state.loading.progress = 0;

        if (loadingElement) {
            loadingElement.classList.remove('visible');
        }
    }

    // ==================== 进度更新 ====================

    function setProgress(percent) {
        const state = EditorApp.State.getState();
        state.loading.progress = Math.min(100, Math.max(0, percent));

        if (progressBar) {
            progressBar.style.width = state.loading.progress + '%';
        }
    }

    function setMessage(message) {
        const state = EditorApp.State.getState();
        state.loading.message = message;

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // ==================== 状态提示 ====================

    function showStatus(status, type) {
        type = type || 'info';
        EditorApp.Utils.showToast(status, type);
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        setProgress: setProgress,
        setMessage: setMessage,
        showStatus: showStatus
    };
})();
