// 知识库编辑器 - 文件树模块
// 提供文件树加载、渲染、搜索、拖拽排序等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Tree = (function() {
    'use strict';

    const state = EditorApp.State.getState();

    // ==================== 加载和渲染 ====================

    async function load() {
        const container = document.getElementById('fileTree');
        if (!container) return;
        
        container.innerHTML = '<div class="tree-loading">加载中...</div>';

        try {
            console.log('[FileTree] 开始加载文件树...');
            const response = await fetch('/api/editor/tree');
            console.log('[FileTree] 响应状态:', response.status);
            const data = await response.json();
            console.log('[FileTree] 响应数据:', data);

            if (!data.success) throw new Error(data.error);

            state.fileTree = data.data.tree;
            console.log('[FileTree] 文件树数据:', state.fileTree);
            render();
        } catch (e) {
            container.innerHTML = '<div class="tree-loading">加载失败: ' + e.message + '</div>';
            console.error('加载文件树失败:', e);
        }
    }

    function render() {
        const container = document.getElementById('fileTree');
        if (!container) return;

        if (!state.fileTree || !state.fileTree.children || state.fileTree.children.length === 0) {
            container.innerHTML = '<div class="tree-loading">没有文档</div>';
            return;
        }

        container.innerHTML = '';
        renderNode(state.fileTree, container, 0, '');
    }

    function renderNode(node, container, level, parentPath) {
        if (!node.children) return;

        // 过滤和排序
        let children = node.children.filter(child => {
            if (!state.searchQuery) return true;
            return matchSearch(child, state.searchQuery);
        });

        // 目录在前，文件在后
        children.forEach(child => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.style.paddingLeft = (16 + level * 16) + 'px';
            item.dataset.path = child.path;
            item.dataset.type = child.type;
            item.dataset.parent = parentPath;
            item.draggable = !state.searchQuery;
            item.addEventListener('dragstart', onDragStart);
            item.addEventListener('dragover', onDragOver);
            item.addEventListener('dragleave', onDragLeave);
            item.addEventListener('drop', onDrop);
            item.addEventListener('dragend', onDragEnd);

            if (child.type === 'directory') {
                const isExpanded = state.expandedDirs.has(child.path);

                // 折叠图标
                const toggle = document.createElement('span');
                toggle.className = 'tree-folder-toggle' + (isExpanded ? ' expanded' : '');
                toggle.textContent = '▶';
                toggle.onclick = (e) => {
                    e.stopPropagation();
                    toggleDirectory(child.path);
                };
                item.appendChild(toggle);

                // 文件夹图标
                const icon = document.createElement('span');
                icon.className = 'tree-item-icon';
                icon.textContent = isExpanded ? '📂' : '📁';
                item.appendChild(icon);
                const folderIcon = getFileIconInfo(child, isExpanded);
                icon.className = folderIcon.className;
                icon.textContent = folderIcon.label;

                // 名称
                const name = document.createElement('span');
                name.className = 'tree-item-name tree-folder';
                name.textContent = child.displayName || child.name;
                item.appendChild(name);

                item.onclick = () => toggleDirectory(child.path);
                item.oncontextmenu = (e) => {
                    if (EditorApp.Files) {
                        EditorApp.Files.showContextMenu(e, child);
                    }
                };

                container.appendChild(item);

                // 子节点容器
                if (child.children && child.children.length > 0) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'tree-children' + (isExpanded ? '' : ' collapsed');
                    childContainer.dataset.path = child.path;
                    renderNode(child, childContainer, level + 1, child.path);
                    container.appendChild(childContainer);
                }
            } else {
                // 文件名
                const name = document.createElement('span');
                name.className = 'tree-item-name';
                name.textContent = child.displayName || child.name;
                item.appendChild(name);

                // 文件图标
                const icon = document.createElement('span');
                icon.className = 'tree-item-icon tree-item-badge';
                item.appendChild(icon);
                const fileIcon = getFileIconInfo(child);
                icon.className = fileIcon.className + ' tree-item-badge';
                icon.textContent = fileIcon.label;

                const tab = state.tabs.find(t => t.path === child.path);
                if (tab && tab.isDirty) {
                    item.classList.add('modified');
                }

                // 选中状态
                if (state.selectedFile === child.path) {
                    item.classList.add('selected');
                }

                item.onclick = () => {
                    if (EditorApp.Tabs) {
                        EditorApp.Tabs.open(child.path);
                    }
                };
                item.oncontextmenu = (e) => {
                    if (EditorApp.Files) {
                        EditorApp.Files.showContextMenu(e, child);
                    }
                };

                container.appendChild(item);
            }
        });
    }

    // ==================== 文件图标 ====================

    function getFileIconInfo(node, isExpanded) {
        if (node.type === 'directory') {
            return {
                label: isExpanded ? 'OPEN' : 'DIR',
                className: 'tree-item-icon icon-folder'
            };
        }
        const ext = (node.name.split('.').pop() || '').toLowerCase();
        const mapping = {
            md: { label: 'MD', className: 'tree-item-icon icon-markdown' },
            markdown: { label: 'MD', className: 'tree-item-icon icon-markdown' },
            yml: { label: 'YML', className: 'tree-item-icon icon-config' },
            yaml: { label: 'YML', className: 'tree-item-icon icon-config' },
            json: { label: 'JSON', className: 'tree-item-icon icon-config' },
            txt: { label: 'TXT', className: 'tree-item-icon icon-text' },
            js: { label: 'JS', className: 'tree-item-icon icon-script' },
            ts: { label: 'TS', className: 'tree-item-icon icon-script' },
            css: { label: 'CSS', className: 'tree-item-icon icon-style' },
            html: { label: 'HTML', className: 'tree-item-icon icon-markup' }
        };
        if (mapping[ext]) return mapping[ext];
        return { label: 'FILE', className: 'tree-item-icon icon-file' };
    }

    // ==================== 搜索 ====================

    function onSearchInput(e) {
        state.searchQuery = e.target.value.trim();

        // 搜索时展开所有目录
        if (state.searchQuery) {
            expandAllDirectories(state.fileTree);
        }

        render();
    }

    function matchSearch(node, query) {
        query = query.toLowerCase();
        const name = (node.displayName || node.name).toLowerCase();

        if (name.includes(query)) return true;

        if (node.type === 'directory' && node.children) {
            return node.children.some(child => matchSearch(child, query));
        }

        return false;
    }

    function expandAllDirectories(node) {
        if (!node) return;
        if (node.type === 'directory') {
            state.expandedDirs.add(node.path);
            if (node.children) {
                node.children.forEach(child => expandAllDirectories(child));
            }
        }
    }

    // ==================== 目录操作 ====================

    function toggleDirectory(path) {
        if (state.expandedDirs.has(path)) {
            state.expandedDirs.delete(path);
        } else {
            state.expandedDirs.add(path);
        }
        render();
    }

    // ==================== 拖拽排序 ====================

    function onDragStart(e) {
        if (state.searchQuery) {
            e.preventDefault();
            return;
        }
        const item = e.currentTarget;
        state.draggingPath = item.dataset.path;
        state.draggingParent = item.dataset.parent || '';
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', state.draggingPath || '');
    }

    function onDragOver(e) {
        const target = e.currentTarget;
        const targetParent = target.dataset.parent || '';
        if (!state.draggingPath || targetParent !== state.draggingParent) return;
        if (state.draggingPath === target.dataset.path) return;

        e.preventDefault();
        const rect = target.getBoundingClientRect();
        const placeAfter = e.clientY > rect.top + rect.height / 2;
        clearDropIndicators();
        target.classList.add(placeAfter ? 'drop-after' : 'drop-before');
    }

    function onDragLeave(e) {
        e.currentTarget.classList.remove('drop-before', 'drop-after');
    }

    function onDrop(e) {
        e.preventDefault();
        const target = e.currentTarget;
        const targetParent = target.dataset.parent || '';
        if (!state.draggingPath || targetParent !== state.draggingParent) return;
        if (state.draggingPath === target.dataset.path) return;

        const rect = target.getBoundingClientRect();
        const placeAfter = e.clientY > rect.top + rect.height / 2;
        const parentNode = getParentNode(state.draggingParent);
        if (!parentNode || !parentNode.children) return;

        const draggedIndex = parentNode.children.findIndex(item => item.path === state.draggingPath);
        if (draggedIndex === -1) return;
        const [dragged] = parentNode.children.splice(draggedIndex, 1);

        const targetIndex = parentNode.children.findIndex(item => item.path === target.dataset.path);
        if (targetIndex === -1) return;
        const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
        parentNode.children.splice(insertIndex, 0, dragged);

        clearDropIndicators();
        render();
        saveOrder(state.draggingParent || '', parentNode.children.map(item => item.name));
    }

    function onDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        clearDropIndicators();
        state.draggingPath = null;
        state.draggingParent = null;
    }

    function clearDropIndicators() {
        document.querySelectorAll('.tree-item.drop-before, .tree-item.drop-after').forEach(item => {
            item.classList.remove('drop-before', 'drop-after');
        });
    }

    async function saveOrder(parentPath, order) {
        try {
            const response = await fetch('/api/editor/tree/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentPath, order })
            });
            if (!response.ok) {
                throw new Error('保存排序失败');
            }
        } catch (e) {
            console.error('[FileTree] 保存排序失败:', e);
        }
    }

    // ==================== 工具函数 ====================

    function findNodeByPath(node, path) {
        if (!node) return null;
        if (node.path === path) return node;
        if (!node.children) return null;
        for (const child of node.children) {
            const found = findNodeByPath(child, path);
            if (found) return found;
        }
        return null;
    }

    function getParentNode(parentPath) {
        if (!parentPath) return state.fileTree;
        return findNodeByPath(state.fileTree, parentPath);
    }

    // 导出公共接口
    return {
        load: load,
        render: render,
        renderNode: renderNode,
        onSearchInput: onSearchInput,
        matchSearch: matchSearch,
        expandAllDirectories: expandAllDirectories,
        toggleDirectory: toggleDirectory,
        onDragStart: onDragStart,
        onDragOver: onDragOver,
        onDragLeave: onDragLeave,
        onDrop: onDrop,
        onDragEnd: onDragEnd,
        saveOrder: saveOrder,
        getFileIconInfo: getFileIconInfo,
        findNodeByPath: findNodeByPath,
        getParentNode: getParentNode
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.loadFileTree = EditorApp.Tree.load;
window.renderFileTree = EditorApp.Tree.render;
window.toggleDirectory = EditorApp.Tree.toggleDirectory;
window.onSearchInput = EditorApp.Tree.onSearchInput;
window.getFileIconInfo = EditorApp.Tree.getFileIconInfo;
window.findNodeByPath = EditorApp.Tree.findNodeByPath;
window.getParentNode = EditorApp.Tree.getParentNode;
