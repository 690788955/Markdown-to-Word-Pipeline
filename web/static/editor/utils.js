// 知识库编辑器 - 工具函数模块
// 提供 Toast 通知、模态框、HTML 转义、文件大小格式化、路径处理等通用功能

window.EditorApp = window.EditorApp || {};

EditorApp.Utils = (function() {
    'use strict';

    // ==================== Toast 通知 ====================

    /**
     * 显示 Toast 通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型: success, error, warning, info
     * @param {number} duration - 显示时长（毫秒）
     */
    function showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // ==================== 模态框 ====================

    /**
     * 打开模态框
     * @param {HTMLElement} modal - 模态框元素
     */
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }

    /**
     * 关闭模态框
     * @param {HTMLElement} modal - 模态框元素
     */
    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');

        const openModals = document.querySelectorAll('.modal.active');
        if (openModals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    }

    // ==================== HTML 转义 ====================

    /**
     * HTML 属性转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    function escapeHtmlAttr(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ==================== 文件大小格式化 ====================

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小字符串
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes === undefined || bytes === null) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ==================== 路径处理 ====================

    /**
     * 计算图片基础路径
     * @param {string} filePath - 文件路径
     * @returns {string} 基础路径
     */
    function calculateLinkBase(filePath) {
        let linkBase = '/api/src/';
        const normalizedPath = (filePath || '').replace(/\\/g, '/');
        if (normalizedPath.includes('/')) {
            const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
            // 对每一层路径进行 URI 编码，以防中文路径问题
            const encodedDir = dir.split('/').map(encodeURIComponent).join('/');
            linkBase = '/api/src/' + encodedDir + '/';
        }
        return linkBase;
    }

    /**
     * 编码路径段
     * @param {string} value - 路径字符串
     * @returns {string} 编码后的路径
     */
    function encodePathSegments(value) {
        if (!value) return '';
        return value.split('/').map(encodeURIComponent).join('/');
    }

    // 导出公共接口
    return {
        showToast: showToast,
        openModal: openModal,
        closeModal: closeModal,
        escapeHtmlAttr: escapeHtmlAttr,
        formatFileSize: formatFileSize,
        calculateLinkBase: calculateLinkBase,
        encodePathSegments: encodePathSegments
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.showToast = EditorApp.Utils.showToast;
window.openModal = EditorApp.Utils.openModal;
window.closeModal = EditorApp.Utils.closeModal;
window.escapeHtmlAttr = EditorApp.Utils.escapeHtmlAttr;
window.formatFileSize = EditorApp.Utils.formatFileSize;
window.calculateLinkBase = EditorApp.Utils.calculateLinkBase;
window.encodePathSegments = EditorApp.Utils.encodePathSegments;
