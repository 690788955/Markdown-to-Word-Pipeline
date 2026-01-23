// 知识库编辑器 - 虚拟滚动文件树模块
// 优化大型文件树的渲染性能，只渲染可见区域的节点

window.EditorApp = window.EditorApp || {};

EditorApp.VirtualTree = (function() {
    'use strict';

    // 配置
    const CONFIG = {
        itemHeight: 28,        // 每个节点的高度（像素）
        bufferSize: 10,        // 上下缓冲区节点数
        threshold: 100,        // 启用虚拟滚动的节点数阈值
        debounceDelay: 16      // 滚动防抖延迟（毫秒）
    };

    // 内部状态
    let container = null;
    let scrollContainer = null;
    let contentContainer = null;
    let flatNodes = [];
    let visibleRange = { start: 0, end: 0 };
    let totalHeight = 0;
    let scrollTimeout = null;
    let isEnabled = false;
    let renderCallback = null;

    // ==================== 初始化 ====================

    function init(containerEl, options = {}) {
        container = containerEl;
        if (!container) return;

        // 合并配置
        Object.assign(CONFIG, options);

        // 创建滚动容器结构
        setupContainers();

        // 绑定滚动事件
        scrollContainer.addEventListener('scroll', onScroll);

        console.log('[VirtualTree] 初始化完成');
    }

    function setupContainers() {
        // 清空容器
        container.innerHTML = '';

        // 创建滚动容器
        scrollContainer = document.createElement('div');
        scrollContainer.className = 'virtual-tree-scroll';
        scrollContainer.style.cssText = 'height: 100%; overflow-y: auto; position: relative;';

        // 创建内容容器（用于撑开滚动高度）
        contentContainer = document.createElement('div');
        contentContainer.className = 'virtual-tree-content';
        contentContainer.style.cssText = 'position: relative;';

        scrollContainer.appendChild(contentContainer);
        container.appendChild(scrollContainer);
    }

    // ==================== 数据处理 ====================

    function setData(tree, callback) {
        renderCallback = callback;
        
        if (!tree || !tree.children) {
            flatNodes = [];
            totalHeight = 0;
            isEnabled = false;
            renderVisible();
            return;
        }

        // 扁平化树结构
        flatNodes = flattenTree(tree, 0);
        totalHeight = flatNodes.length * CONFIG.itemHeight;

        // 判断是否启用虚拟滚动
        isEnabled = flatNodes.length > CONFIG.threshold;

        console.log('[VirtualTree] 节点数:', flatNodes.length, '启用虚拟滚动:', isEnabled);

        // 设置内容高度
        if (contentContainer) {
            contentContainer.style.height = totalHeight + 'px';
        }

        // 渲染可见区域
        renderVisible();
    }

    function flattenTree(node, level, parentPath = '') {
        const result = [];
        const state = EditorApp.State.getState();

        if (!node.children) return result;

        node.children.forEach(child => {
            // 检查搜索过滤
            if (state.searchQuery && !matchSearch(child, state.searchQuery)) {
                return;
            }

            const flatNode = {
                node: child,
                level: level,
                parentPath: parentPath,
                visible: true
            };

            result.push(flatNode);

            // 如果是展开的目录，递归处理子节点
            if (child.type === 'directory' && state.expandedDirs.has(child.path)) {
                const children = flattenTree(child, level + 1, child.path);
                result.push(...children);
            }
        });

        return result;
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

    // ==================== 渲染 ====================

    function renderVisible() {
        if (!contentContainer) return;

        if (!isEnabled) {
            // 节点数较少，使用传统渲染
            renderAll();
            return;
        }

        // 计算可见范围
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const viewportHeight = scrollContainer ? scrollContainer.clientHeight : 0;

        const startIndex = Math.max(0, Math.floor(scrollTop / CONFIG.itemHeight) - CONFIG.bufferSize);
        const endIndex = Math.min(
            flatNodes.length,
            Math.ceil((scrollTop + viewportHeight) / CONFIG.itemHeight) + CONFIG.bufferSize
        );

        // 如果范围没变，不重新渲染
        if (startIndex === visibleRange.start && endIndex === visibleRange.end) {
            return;
        }

        visibleRange = { start: startIndex, end: endIndex };

        // 清空内容
        contentContainer.innerHTML = '';

        // 渲染可见节点
        const fragment = document.createDocumentFragment();

        for (let i = startIndex; i < endIndex; i++) {
            const flatNode = flatNodes[i];
            if (!flatNode) continue;

            const item = renderNode(flatNode, i);
            if (item) {
                fragment.appendChild(item);
            }
        }

        contentContainer.appendChild(fragment);
    }

    function renderAll() {
        if (!contentContainer) return;

        contentContainer.innerHTML = '';
        contentContainer.style.height = 'auto';

        const fragment = document.createDocumentFragment();

        flatNodes.forEach((flatNode, index) => {
            const item = renderNode(flatNode, index);
            if (item) {
                fragment.appendChild(item);
            }
        });

        contentContainer.appendChild(fragment);
    }

    function renderNode(flatNode, index) {
        const { node, level, parentPath } = flatNode;
        const state = EditorApp.State.getState();

        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.path = node.path;
        item.dataset.type = node.type;
        item.dataset.parent = parentPath;
        item.dataset.index = index;

        // 虚拟滚动时使用绝对定位
        if (isEnabled) {
            item.style.cssText = `
                position: absolute;
                top: ${index * CONFIG.itemHeight}px;
                left: 0;
                right: 0;
                height: ${CONFIG.itemHeight}px;
                padding-left: ${16 + level * 16}px;
            `;
        } else {
            item.style.paddingLeft = (16 + level * 16) + 'px';
        }

        // 拖拽属性
        item.draggable = !state.searchQuery;

        if (node.type === 'directory') {
            renderDirectoryNode(item, node, state);
        } else {
            renderFileNode(item, node, state);
        }

        return item;
    }

    function renderDirectoryNode(item, node, state) {
        const isExpanded = state.expandedDirs.has(node.path);

        // 折叠图标
        const toggle = document.createElement('span');
        toggle.className = 'tree-folder-toggle' + (isExpanded ? ' expanded' : '');
        toggle.textContent = '▶';
        toggle.onclick = (e) => {
            e.stopPropagation();
            toggleDirectory(node.path);
        };
        item.appendChild(toggle);

        // 文件夹图标
        const icon = document.createElement('span');
        const folderIcon = EditorApp.Tree.getFileIconInfo(node, isExpanded);
        icon.className = folderIcon.className;
        icon.textContent = folderIcon.label;
        item.appendChild(icon);

        // 名称
        const name = document.createElement('span');
        name.className = 'tree-item-name tree-folder';
        name.textContent = node.displayName || node.name;
        item.appendChild(name);

        item.onclick = () => toggleDirectory(node.path);
        item.oncontextmenu = (e) => {
            if (EditorApp.Files) {
                EditorApp.Files.showContextMenu(e, node);
            }
        };
    }

    function renderFileNode(item, node, state) {
        // 文件名
        const name = document.createElement('span');
        name.className = 'tree-item-name';
        name.textContent = node.displayName || node.name;
        item.appendChild(name);

        // 文件图标
        const icon = document.createElement('span');
        const fileIcon = EditorApp.Tree.getFileIconInfo(node);
        icon.className = fileIcon.className + ' tree-item-badge';
        icon.textContent = fileIcon.label;
        item.appendChild(icon);

        // 修改状态
        const tab = state.tabs.find(t => t.path === node.path);
        if (tab && tab.isDirty) {
            item.classList.add('modified');
        }

        // 选中状态
        if (state.selectedFile === node.path) {
            item.classList.add('selected');
        }

        item.onclick = () => {
            if (EditorApp.Tabs) {
                EditorApp.Tabs.open(node.path);
            }
        };
        item.oncontextmenu = (e) => {
            if (EditorApp.Files) {
                EditorApp.Files.showContextMenu(e, node);
            }
        };
    }

    function toggleDirectory(path) {
        const state = EditorApp.State.getState();
        
        if (state.expandedDirs.has(path)) {
            state.expandedDirs.delete(path);
        } else {
            state.expandedDirs.add(path);
        }

        // 重新扁平化并渲染
        if (renderCallback) {
            renderCallback();
        } else {
            refresh();
        }
    }

    // ==================== 滚动处理 ====================

    function onScroll() {
        if (!isEnabled) return;

        // 防抖处理
        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }

        scrollTimeout = requestAnimationFrame(() => {
            renderVisible();
        });
    }

    // ==================== 公共方法 ====================

    function refresh() {
        const state = EditorApp.State.getState();
        if (state.fileTree) {
            setData(state.fileTree, renderCallback);
        }
    }

    function getVisibleNodes() {
        return flatNodes.slice(visibleRange.start, visibleRange.end);
    }

    function scrollToNode(path) {
        const index = flatNodes.findIndex(fn => fn.node.path === path);
        if (index === -1) return;

        const scrollTop = index * CONFIG.itemHeight;
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
        }
    }

    function isVirtualScrollEnabled() {
        return isEnabled;
    }

    function getStats() {
        return {
            totalNodes: flatNodes.length,
            visibleNodes: visibleRange.end - visibleRange.start,
            isEnabled: isEnabled,
            threshold: CONFIG.threshold
        };
    }

    function destroy() {
        if (scrollContainer) {
            scrollContainer.removeEventListener('scroll', onScroll);
        }
        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }
        container = null;
        scrollContainer = null;
        contentContainer = null;
        flatNodes = [];
        renderCallback = null;
    }

    // 导出公共接口
    return {
        init: init,
        setData: setData,
        renderVisible: renderVisible,
        refresh: refresh,
        getVisibleNodes: getVisibleNodes,
        scrollToNode: scrollToNode,
        isEnabled: isVirtualScrollEnabled,
        getStats: getStats,
        destroy: destroy,
        CONFIG: CONFIG
    };
})();
