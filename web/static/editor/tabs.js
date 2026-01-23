// 知识库编辑器 - 标签管理模块
// 提供标签打开、关闭、切换、拖拽排序、未保存提示等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Tabs = (function() {
    'use strict';

    const state = EditorApp.State.getState();
    let draggedTabId = null;

    // ==================== 标签操作 ====================

    function open(path) {
        // 检查是否已打开
        let tab = state.tabs.find(t => t.path === path);

        if (tab) {
            switchTo(tab.id);
            return;
        }

        // 创建新标签
        const id = 'tab-' + Date.now();
        const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i.test(path);

        tab = {
            id: id,
            path: path,
            title: path.split('/').pop().replace('.md', ''),
            type: isImage ? 'image' : 'markdown',
            isDirty: false,
            content: null,
            originalContent: null
        };

        state.tabs.push(tab);
        state.selectedFile = path;

        render();
        switchTo(id);

        // 如果是图片，不加载文本内容
        if (!isImage && EditorApp.Vditor) {
            EditorApp.Vditor.loadContent(tab);
        }
    }

    function switchTo(tabId) {
        const tab = state.tabs.find(t => t.id === tabId);
        if (!tab) return;

        state.activeTabId = tabId;
        state.selectedFile = tab.path;

        // 更新标签 UI
        document.querySelectorAll('.tab-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === tabId);
        });

        // 更新文件树选中状态
        document.querySelectorAll('.tree-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.path === tab.path);
        });

        // 显示编辑器
        if (EditorApp.Vditor) {
            EditorApp.Vditor.show(tab);
        }

        // 加载附件（仅 Markdown 文件）
        if (tab.type !== 'image' && EditorApp.Attachments) {
            EditorApp.Attachments.load(tab.path);
        } else if (EditorApp.Attachments) {
            state.attachments = [];
            EditorApp.Attachments.render();
        }

        // 更新面包屑导航
        if (EditorApp.Breadcrumb) {
            EditorApp.Breadcrumb.update(tab.path);
        }

        // 添加到最近文件
        if (EditorApp.RecentFiles) {
            EditorApp.RecentFiles.add(tab.path);
        }
    }

    function close(tabId, force = false) {
        const tab = state.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // 检查未保存更改
        if (tab.isDirty && !force) {
            state.pendingCloseTabId = tabId;
            showUnsavedModal();
            return;
        }

        // 销毁编辑器
        if (state.editors.has(tabId)) {
            const editor = state.editors.get(tabId);
            if (editor && editor.destroy) {
                editor.destroy();
            }
            state.editors.delete(tabId);
        }

        // 移除标签
        const index = state.tabs.findIndex(t => t.id === tabId);
        state.tabs.splice(index, 1);

        // 切换到其他标签
        if (state.activeTabId === tabId) {
            if (state.tabs.length > 0) {
                const newIndex = Math.min(index, state.tabs.length - 1);
                switchTo(state.tabs[newIndex].id);
            } else {
                state.activeTabId = null;
                state.selectedFile = null;
                if (EditorApp.Vditor) {
                    EditorApp.Vditor.showPlaceholder();
                }
            }
        }

        render();
        if (EditorApp.Tree) {
            EditorApp.Tree.render();
        }
    }

    function render() {
        const container = document.getElementById('tabList');
        if (!container) return;

        if (state.tabs.length === 0) {
            container.innerHTML = '<div class="tab-empty">打开文件开始编辑</div>';
            return;
        }

        container.innerHTML = '';

        state.tabs.forEach(tab => {
            const item = document.createElement('div');
            item.className = 'tab-item' + (tab.id === state.activeTabId ? ' active' : '') + (tab.isDirty ? ' dirty' : '');
            item.dataset.id = tab.id;
            item.draggable = true;

            const name = document.createElement('span');
            name.className = 'tab-name';
            name.textContent = tab.title;
            item.appendChild(name);

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                close(tab.id);
            };
            item.appendChild(closeBtn);

            item.onclick = () => switchTo(tab.id);

            // 拖拽排序
            item.ondragstart = (e) => onDragStart(e, tab.id);
            item.ondragover = (e) => onDragOver(e);
            item.ondrop = (e) => onDrop(e, tab.id);

            container.appendChild(item);
        });
    }

    // ==================== 拖拽排序 ====================

    function onDragStart(e, tabId) {
        draggedTabId = tabId;
        e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function onDrop(e, targetTabId) {
        e.preventDefault();
        if (!draggedTabId || draggedTabId === targetTabId) return;

        const fromIndex = state.tabs.findIndex(t => t.id === draggedTabId);
        const toIndex = state.tabs.findIndex(t => t.id === targetTabId);

        if (fromIndex === -1 || toIndex === -1) return;

        const [tab] = state.tabs.splice(fromIndex, 1);
        state.tabs.splice(toIndex, 0, tab);

        render();
        draggedTabId = null;
    }

    // ==================== 未保存提示 ====================

    function showUnsavedModal() {
        const modal = document.getElementById('unsavedModal');
        if (modal) {
            EditorApp.Utils.openModal(modal);
        }
    }

    function hideUnsavedModal() {
        const modal = document.getElementById('unsavedModal');
        if (modal) {
            EditorApp.Utils.closeModal(modal);
        }
        state.pendingCloseTabId = null;
    }

    async function saveAndClose() {
        if (EditorApp.Vditor) {
            await EditorApp.Vditor.saveCurrentFile();
        }
        hideUnsavedModal();
        if (state.pendingCloseTabId) {
            close(state.pendingCloseTabId, true);
        }
    }

    function discardChanges() {
        const tabId = state.pendingCloseTabId;
        hideUnsavedModal();

        if (tabId) {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isDirty = false;
            }
            close(tabId, true);
        }
    }

    // 导出公共接口
    return {
        open: open,
        switch: switchTo,
        close: close,
        render: render,
        onDragStart: onDragStart,
        onDragOver: onDragOver,
        onDrop: onDrop,
        showUnsavedModal: showUnsavedModal,
        hideUnsavedModal: hideUnsavedModal,
        saveAndClose: saveAndClose,
        discardChanges: discardChanges
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.openFile = EditorApp.Tabs.open;
window.switchTab = EditorApp.Tabs.switch;
window.closeTab = EditorApp.Tabs.close;
window.renderTabs = EditorApp.Tabs.render;
window.showUnsavedModal = EditorApp.Tabs.showUnsavedModal;
window.hideUnsavedModal = EditorApp.Tabs.hideUnsavedModal;
window.saveAndClose = EditorApp.Tabs.saveAndClose;
window.discardChanges = EditorApp.Tabs.discardChanges;
