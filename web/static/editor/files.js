// 知识库编辑器 - 文件操作模块
// 包含新建、重命名、删除文件和右键菜单功能

(function() {
    'use strict';

    window.EditorApp = window.EditorApp || {};

    // ==================== 文件操作功能 ====================

    function showNewFileModal() {
        const state = EditorApp.State.getState();
        const modal = document.getElementById('newFileModal');
        document.getElementById('newFilePath').value = '';

        // 如果有选中的目录，预填路径
        if (state.contextMenuTarget && state.contextMenuTarget.type === 'directory') {
            document.getElementById('newFilePath').value = state.contextMenuTarget.path + '/';
        }

        EditorApp.Utils.openModal(modal);
    }

    function hideNewFileModal() {
        EditorApp.Utils.closeModal(document.getElementById('newFileModal'));
    }

    async function createNewFile() {
        let path = document.getElementById('newFilePath').value.trim();

        if (!path) {
            EditorApp.Utils.showToast('请输入文件路径', 'warning');
            return;
        }

        if (!path.endsWith('.md')) {
            path += '.md';
        }

        try {
            const response = await fetch('/api/editor/module', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            hideNewFileModal();
            EditorApp.Utils.showToast('文件创建成功', 'success');

            await EditorApp.Tree.load();
            EditorApp.Tabs.open(path);
        } catch (e) {
            EditorApp.Utils.showToast('创建失败: ' + e.message, 'error');
        }
    }

    function showRenameModal() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const modal = document.getElementById('renameModal');
        document.getElementById('newFileName').value = state.contextMenuTarget.name;
        state.renameTarget = state.contextMenuTarget;

        EditorApp.Utils.openModal(modal);
    }

    function hideRenameModal() {
        const state = EditorApp.State.getState();
        EditorApp.Utils.closeModal(document.getElementById('renameModal'));
        state.renameTarget = null;
    }

    async function confirmRename() {
        const state = EditorApp.State.getState();
        if (!state.renameTarget) return;

        const newName = document.getElementById('newFileName').value.trim();
        if (!newName) {
            EditorApp.Utils.showToast('请输入新文件名', 'warning');
            return;
        }

        const oldPath = state.renameTarget.path;
        const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = dir ? dir + '/' + newName : newName;

        try {
            const response = await fetch('/api/editor/module/' + encodeURIComponent(oldPath) + '/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPath })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            hideRenameModal();
            EditorApp.Utils.showToast('重命名成功', 'success');

            // 更新标签
            const tab = state.tabs.find(t => t.path === oldPath);
            if (tab) {
                tab.path = newPath;
                tab.title = newName.replace('.md', '');
                EditorApp.Tabs.render();
            }

            await EditorApp.Tree.load();
        } catch (e) {
            EditorApp.Utils.showToast('重命名失败: ' + e.message, 'error');
        }
    }

    function showDeleteModal() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const modal = document.getElementById('deleteModal');
        const message = document.getElementById('deleteMessage');
        message.textContent = `确定要删除 "${state.contextMenuTarget.name}" 吗？此操作不可撤销。`;

        EditorApp.Utils.openModal(modal);
    }

    function hideDeleteModal() {
        EditorApp.Utils.closeModal(document.getElementById('deleteModal'));
    }

    async function confirmDelete() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const path = state.contextMenuTarget.path;
        const isImage = state.contextMenuTarget.type === 'image';

        try {
            // 根据文件类型选择不同的 API
            const apiUrl = isImage 
                ? '/api/editor/image/' + encodeURIComponent(path)
                : '/api/editor/module/' + encodeURIComponent(path);
            
            const response = await fetch(apiUrl, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            hideDeleteModal();
            EditorApp.Utils.showToast('删除成功', 'success');

            // 关闭相关标签
            const tab = state.tabs.find(t => t.path === path);
            if (tab) {
                EditorApp.Tabs.close(tab.id, true);
            }

            await EditorApp.Tree.load();
        } catch (e) {
            EditorApp.Utils.showToast('删除失败: ' + e.message, 'error');
        }
    }

    // ==================== 右键菜单 ====================

    function showContextMenu(e, item) {
        e.preventDefault();
        e.stopPropagation();

        const state = EditorApp.State.getState();
        state.contextMenuTarget = item;

        const menu = document.getElementById('contextMenu');
        
        // 根据文件类型显示/隐藏菜单项
        const isImage = item.type === 'image';
        const isDirectory = item.type === 'directory';
        const isFile = item.type === 'file';
        
        // 获取菜单项
        const newItem = menu.querySelector('[data-action="new"]');
        const newFolderItem = menu.querySelector('[data-action="newFolder"]');
        const renameItem = menu.querySelector('[data-action="rename"]');
        const deleteItem = menu.querySelector('[data-action="delete"]');
        const historyItem = menu.querySelector('[data-action="history"]');
        const dividers = menu.querySelectorAll('.context-divider');
        
        // 图片文件：只显示删除
        if (isImage) {
            if (newItem) newItem.style.display = 'none';
            if (newFolderItem) newFolderItem.style.display = 'none';
            if (renameItem) renameItem.style.display = 'none';
            if (historyItem) historyItem.style.display = 'none';
            dividers.forEach(d => d.style.display = 'none');
            if (deleteItem) deleteItem.style.display = 'block';
        } else {
            // 其他文件类型：显示所有菜单项
            if (newItem) newItem.style.display = 'block';
            if (newFolderItem) newFolderItem.style.display = 'block';
            if (renameItem) renameItem.style.display = isDirectory ? 'none' : 'block';
            dividers.forEach(d => d.style.display = 'block');
            if (deleteItem) deleteItem.style.display = 'block';
            // 只对文件显示历史选项
            if (historyItem) historyItem.style.display = isFile ? 'block' : 'none';
        }
        
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        // 调整位置防止超出屏幕
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (e.pageX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (e.pageY - rect.height) + 'px';
        }
    }

    function hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    function onContextMenu(e) {
        // 只在文件树区域显示自定义菜单
        if (!e.target.closest('.file-tree')) {
            return;
        }
        e.preventDefault();
    }

    function onContextAction(e) {
        const action = e.target.dataset.action;
        hideContextMenu();

        switch (action) {
            case 'new':
                showNewFileModal();
                break;
            case 'newFolder':
                // TODO: 实现新建文件夹
                EditorApp.Utils.showToast('新建文件夹功能开发中', 'warning');
                break;
            case 'rename':
                showRenameModal();
                break;
            case 'delete':
                showDeleteModal();
                break;
            case 'history':
                showVersionHistory();
                break;
        }
    }

    function showVersionHistory() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        // 只对文件显示历史
        if (state.contextMenuTarget.type === 'directory') {
            EditorApp.Utils.showToast('请选择一个文件查看历史', 'warning');
            return;
        }

        if (EditorApp.VersionHistory) {
            EditorApp.VersionHistory.show(state.contextMenuTarget.path);
        } else {
            EditorApp.Utils.showToast('版本历史功能未加载', 'warning');
        }
    }

    // ==================== 暴露接口 ====================

    EditorApp.Files = {
        showNewModal: showNewFileModal,
        hideNewModal: hideNewFileModal,
        create: createNewFile,
        showRenameModal: showRenameModal,
        hideRenameModal: hideRenameModal,
        confirmRename: confirmRename,
        showDeleteModal: showDeleteModal,
        hideDeleteModal: hideDeleteModal,
        confirmDelete: confirmDelete,
        showContextMenu: showContextMenu,
        hideContextMenu: hideContextMenu,
        onContextMenu: onContextMenu,
        onContextAction: onContextAction
    };

    // 暴露到全局作用域（向后兼容）
    window.showNewFileModal = showNewFileModal;
    window.hideNewFileModal = hideNewFileModal;
    window.createNewFile = createNewFile;
    window.showRenameModal = showRenameModal;
    window.hideRenameModal = hideRenameModal;
    window.confirmRename = confirmRename;
    window.showDeleteModal = showDeleteModal;
    window.hideDeleteModal = hideDeleteModal;
    window.confirmDelete = confirmDelete;
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.onContextMenu = onContextMenu;
    window.onContextAction = onContextAction;

})();
