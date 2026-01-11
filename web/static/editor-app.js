// 知识库编辑器 - 主应用逻辑
// 包含文件树、标签管理、编辑器封装、Git 面板

// ==================== 全局状态 ====================

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
    fileTreeWidth: 260,
    gitPanelWidth: 280,
    fileTreeCollapsed: false,
    gitPanelCollapsed: false,
    
    // 操作状态
    contextMenuTarget: null,
    pendingCloseTabId: null,
    renameTarget: null
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    // 加载布局偏好
    loadLayoutPreferences();
    
    // 初始化文件树
    loadFileTree();
    
    // 初始化 Git 面板
    loadGitStatus();
    
    // 绑定事件
    bindEvents();
    
    // 应用布局
    applyLayout();
});

// ==================== 事件绑定 ====================

function bindEvents() {
    // 面板切换按钮
    document.getElementById('toggleFileTree').addEventListener('click', toggleFileTree);
    document.getElementById('toggleGitPanel').addEventListener('click', toggleGitPanel);
    
    // 文件树操作
    document.getElementById('newFileBtn').addEventListener('click', showNewFileModal);
    document.getElementById('refreshTreeBtn').addEventListener('click', loadFileTree);
    document.getElementById('fileSearch').addEventListener('input', onSearchInput);
    
    // Git 操作
    document.getElementById('gitRefreshBtn').addEventListener('click', loadGitStatus);
    
    // 拖拽调整宽度
    initResizers();
    
    // 右键菜单
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('click', hideContextMenu);
    document.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', onContextAction);
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', onKeyDown);
    
    // 离开页面提示
    window.addEventListener('beforeunload', onBeforeUnload);
    
    // 返回按钮
    document.querySelector('.back-btn').addEventListener('click', onBackClick);
}

// ==================== 文件树功能 ====================

async function loadFileTree() {
    const container = document.getElementById('fileTree');
    container.innerHTML = '<div class="tree-loading">加载中...</div>';
    
    try {
        const response = await fetch('/api/editor/tree');
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        state.fileTree = data.data.tree;
        renderFileTree();
    } catch (e) {
        container.innerHTML = '<div class="tree-loading">加载失败: ' + e.message + '</div>';
        console.error('加载文件树失败:', e);
    }
}

function renderFileTree() {
    const container = document.getElementById('fileTree');
    
    if (!state.fileTree || !state.fileTree.children || state.fileTree.children.length === 0) {
        container.innerHTML = '<div class="tree-loading">没有文档</div>';
        return;
    }
    
    container.innerHTML = '';
    renderTreeNode(state.fileTree, container, 0);
}

function renderTreeNode(node, container, level) {
    if (!node.children) return;
    
    // 过滤和排序
    let children = node.children.filter(child => {
        if (!state.searchQuery) return true;
        return matchSearch(child, state.searchQuery);
    });
    
    // 目录在前，文件在后
    children.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
    
    children.forEach(child => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = (16 + level * 16) + 'px';
        item.dataset.path = child.path;
        item.dataset.type = child.type;
        
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
            
            // 名称
            const name = document.createElement('span');
            name.className = 'tree-item-name tree-folder';
            name.textContent = child.displayName || child.name;
            item.appendChild(name);
            
            item.onclick = () => toggleDirectory(child.path);
            item.oncontextmenu = (e) => showContextMenu(e, child);
            
            container.appendChild(item);
            
            // 子节点容器
            if (child.children && child.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children' + (isExpanded ? '' : ' collapsed');
                childContainer.dataset.path = child.path;
                renderTreeNode(child, childContainer, level + 1);
                container.appendChild(childContainer);
            }
        } else {
            // 文件图标
            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = '📄';
            item.appendChild(icon);
            
            // 名称
            const name = document.createElement('span');
            name.className = 'tree-item-name';
            name.textContent = child.displayName || child.name;
            item.appendChild(name);
            
            // 检查是否有未保存更改
            const tab = state.tabs.find(t => t.path === child.path);
            if (tab && tab.isDirty) {
                item.classList.add('modified');
            }
            
            // 选中状态
            if (state.selectedFile === child.path) {
                item.classList.add('selected');
            }
            
            item.onclick = () => openFile(child.path);
            item.oncontextmenu = (e) => showContextMenu(e, child);
            
            container.appendChild(item);
        }
    });
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

function toggleDirectory(path) {
    if (state.expandedDirs.has(path)) {
        state.expandedDirs.delete(path);
    } else {
        state.expandedDirs.add(path);
    }
    renderFileTree();
}

function onSearchInput(e) {
    state.searchQuery = e.target.value.trim();
    
    // 搜索时展开所有目录
    if (state.searchQuery) {
        expandAllDirectories(state.fileTree);
    }
    
    renderFileTree();
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

// ==================== 标签管理 ====================

function openFile(path) {
    // 检查是否已打开
    let tab = state.tabs.find(t => t.path === path);
    
    if (tab) {
        switchTab(tab.id);
        return;
    }
    
    // 创建新标签
    const id = 'tab-' + Date.now();
    tab = {
        id: id,
        path: path,
        title: path.split('/').pop().replace('.md', ''),
        isDirty: false,
        content: null,
        originalContent: null
    };
    
    state.tabs.push(tab);
    state.selectedFile = path;
    
    renderTabs();
    switchTab(id);
    loadFileContent(tab);
}

function switchTab(tabId) {
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
    showEditor(tab);
}

function closeTab(tabId, force = false) {
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
            switchTab(state.tabs[newIndex].id);
        } else {
            state.activeTabId = null;
            state.selectedFile = null;
            showPlaceholder();
        }
    }
    
    renderTabs();
    renderFileTree();
}

function renderTabs() {
    const container = document.getElementById('tabList');
    
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
        
        const close = document.createElement('span');
        close.className = 'tab-close';
        close.textContent = '×';
        close.onclick = (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        };
        item.appendChild(close);
        
        item.onclick = () => switchTab(tab.id);
        
        // 拖拽排序
        item.ondragstart = (e) => onTabDragStart(e, tab.id);
        item.ondragover = (e) => onTabDragOver(e);
        item.ondrop = (e) => onTabDrop(e, tab.id);
        
        container.appendChild(item);
    });
}

// 标签拖拽排序
let draggedTabId = null;

function onTabDragStart(e, tabId) {
    draggedTabId = tabId;
    e.dataTransfer.effectAllowed = 'move';
}

function onTabDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onTabDrop(e, targetTabId) {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) return;
    
    const fromIndex = state.tabs.findIndex(t => t.id === draggedTabId);
    const toIndex = state.tabs.findIndex(t => t.id === targetTabId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const [tab] = state.tabs.splice(fromIndex, 1);
    state.tabs.splice(toIndex, 0, tab);
    
    renderTabs();
    draggedTabId = null;
}

// ==================== 编辑器功能 ====================

async function loadFileContent(tab) {
    try {
        const response = await fetch('/api/editor/module?path=' + encodeURIComponent(tab.path));
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        tab.content = data.data.content;
        tab.originalContent = data.data.content;
        
        if (state.activeTabId === tab.id) {
            showEditor(tab);
        }
    } catch (e) {
        showToast('加载文件失败: ' + e.message, 'error');
        console.error('加载文件失败:', e);
    }
}

function showEditor(tab) {
    const container = document.getElementById('editorContainer');
    
    // 隐藏占位符
    const placeholder = container.querySelector('.editor-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    // 隐藏其他编辑器
    container.querySelectorAll('.vditor-container').forEach(el => {
        el.style.display = 'none';
    });
    
    // 检查是否已有编辑器
    let editorContainer = container.querySelector(`[data-tab-id="${tab.id}"]`);
    
    if (editorContainer) {
        editorContainer.style.display = 'block';
        return;
    }
    
    // 创建新编辑器容器
    editorContainer = document.createElement('div');
    editorContainer.className = 'vditor-container';
    editorContainer.dataset.tabId = tab.id;
    container.appendChild(editorContainer);
    
    // 等待内容加载
    if (tab.content === null) {
        editorContainer.innerHTML = '<div class="tree-loading">加载中...</div>';
        return;
    }
    
    // 创建 Vditor 编辑器
    createVditorEditor(editorContainer, tab);
}

function createVditorEditor(container, tab) {
    const editor = new Vditor(container, {
        height: '100%',
        mode: 'ir',
        value: tab.content || '',
        cache: { enable: false },
        toolbar: [
            'headings', 'bold', 'italic', 'strike', '|',
            'list', 'ordered-list', 'check', '|',
            'quote', 'code', 'inline-code', '|',
            'link', 'upload', 'table', '|',
            'undo', 'redo', '|',
            'edit-mode', 'outline', 'fullscreen'
        ],
        upload: {
            url: '/api/upload',
            accept: 'image/*',
            handler: (files) => {
                // 简单处理：使用 base64
                return null;
            }
        },
        after: () => {
            state.editors.set(tab.id, editor);
        },
        input: (value) => {
            tab.content = value;
            const wasDirty = tab.isDirty;
            tab.isDirty = value !== tab.originalContent;
            
            if (wasDirty !== tab.isDirty) {
                renderTabs();
                renderFileTree();
            }
        }
    });
}

function showPlaceholder() {
    const container = document.getElementById('editorContainer');
    
    // 隐藏所有编辑器
    container.querySelectorAll('.vditor-container').forEach(el => {
        el.style.display = 'none';
    });
    
    // 显示占位符
    let placeholder = container.querySelector('.editor-placeholder');
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'editor-placeholder';
        placeholder.innerHTML = `
            <div class="placeholder-icon">📝</div>
            <div class="placeholder-text">从左侧选择文件开始编辑</div>
        `;
        container.appendChild(placeholder);
    }
    placeholder.style.display = 'flex';
}

async function saveCurrentFile() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || !tab.isDirty) return;
    
    try {
        const response = await fetch('/api/editor/module', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: tab.path,
                content: tab.content
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        tab.originalContent = tab.content;
        tab.isDirty = false;
        
        renderTabs();
        renderFileTree();
        showToast('保存成功', 'success');
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
        console.error('保存失败:', e);
    }
}


// ==================== Git 面板功能 ====================

async function loadGitStatus() {
    const container = document.getElementById('gitContent');
    container.innerHTML = '<div class="git-loading">加载中...</div>';
    
    try {
        const [statusRes, changesRes] = await Promise.all([
            fetch('/api/git/status'),
            fetch('/api/git/changes')
        ]);
        
        const statusData = await statusRes.json();
        const changesData = await changesRes.json();
        
        if (!statusData.success) {
            renderGitNotRepo(container);
            return;
        }
        
        state.gitStatus = statusData.data;
        state.gitChanges = changesData.success ? (changesData.data.changes || []) : [];
        
        // 只显示 src 目录的变更
        state.gitChanges = state.gitChanges.filter(c => c.directory === 'src');
        
        renderGitPanel();
        updateGitBadge();
    } catch (e) {
        container.innerHTML = '<div class="git-loading">加载失败</div>';
        console.error('加载 Git 状态失败:', e);
    }
}

function renderGitNotRepo(container) {
    container.innerHTML = `
        <div class="git-status">
            <p style="color: #999; text-align: center;">当前目录不是 Git 仓库</p>
            <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="initGitRepo()">
                初始化仓库
            </button>
        </div>
    `;
}

function renderGitPanel() {
    const container = document.getElementById('gitContent');
    
    if (!state.gitStatus || !state.gitStatus.isRepository) {
        renderGitNotRepo(container);
        return;
    }
    
    let html = '';
    
    // 分支状态
    html += `
        <div class="git-status">
            <div class="git-branch">
                <span class="git-branch-icon">⎇</span>
                <span>${state.gitStatus.branch || 'main'}</span>
            </div>
        </div>
    `;
    
    // 变更列表
    html += `
        <div class="git-changes-header">
            <span class="git-changes-title">变更文件</span>
            <span class="git-changes-count">${state.gitChanges.length}</span>
        </div>
    `;
    
    if (state.gitChanges.length === 0) {
        html += '<div style="color: #999; font-size: 13px; padding: 8px 0;">没有变更</div>';
    } else {
        state.gitChanges.forEach((change, index) => {
            const statusClass = change.status.toLowerCase();
            const statusText = getStatusText(change.status);
            const checked = state.selectedChanges.has(change.path) ? 'checked' : '';
            
            html += `
                <div class="git-change-item" onclick="toggleChangeSelection('${change.path}')">
                    <input type="checkbox" ${checked} onclick="event.stopPropagation(); toggleChangeSelection('${change.path}')">
                    <span class="git-change-status ${statusClass}">${statusText}</span>
                    <span class="git-change-path" title="${change.path}">${change.path.replace('src/', '')}</span>
                </div>
            `;
        });
    }
    
    // 提交区域
    html += `
        <div class="git-commit-section">
            <textarea id="commitMessage" class="git-commit-input" placeholder="提交信息..."></textarea>
            <div class="git-actions">
                <button class="btn btn-primary" onclick="commitChanges()">提交</button>
                <button class="btn btn-outline" onclick="pushChanges()">推送</button>
                <button class="btn btn-outline" onclick="pullChanges()">拉取</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function getStatusText(status) {
    switch (status.toLowerCase()) {
        case 'added': return 'A';
        case 'modified': return 'M';
        case 'deleted': return 'D';
        case 'untracked': return '?';
        default: return '?';
    }
}

function toggleChangeSelection(path) {
    if (state.selectedChanges.has(path)) {
        state.selectedChanges.delete(path);
    } else {
        state.selectedChanges.add(path);
    }
    renderGitPanel();
}

function updateGitBadge() {
    const badge = document.getElementById('gitBadge');
    const count = state.gitChanges.length;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

async function initGitRepo() {
    try {
        const response = await fetch('/api/git/init', { method: 'POST' });
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        showToast('Git 仓库初始化成功', 'success');
        loadGitStatus();
    } catch (e) {
        showToast('初始化失败: ' + e.message, 'error');
    }
}

async function commitChanges() {
    const message = document.getElementById('commitMessage').value.trim();
    if (!message) {
        showToast('请输入提交信息', 'warning');
        return;
    }
    
    const files = state.selectedChanges.size > 0 
        ? Array.from(state.selectedChanges) 
        : state.gitChanges.map(c => c.path);
    
    try {
        const response = await fetch('/api/git/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, files })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        showToast('提交成功: ' + data.data.hash, 'success');
        document.getElementById('commitMessage').value = '';
        state.selectedChanges.clear();
        loadGitStatus();
    } catch (e) {
        showToast('提交失败: ' + e.message, 'error');
    }
}

async function pushChanges() {
    try {
        const response = await fetch('/api/git/push', { method: 'POST' });
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        showToast('推送成功', 'success');
        loadGitStatus();
    } catch (e) {
        showToast('推送失败: ' + e.message, 'error');
    }
}

async function pullChanges() {
    try {
        const response = await fetch('/api/git/pull', { method: 'POST' });
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        showToast('拉取成功', 'success');
        loadGitStatus();
        loadFileTree();
    } catch (e) {
        showToast('拉取失败: ' + e.message, 'error');
    }
}

// ==================== 文件操作功能 ====================

function showNewFileModal() {
    const modal = document.getElementById('newFileModal');
    document.getElementById('newFilePath').value = '';
    
    // 如果有选中的目录，预填路径
    if (state.contextMenuTarget && state.contextMenuTarget.type === 'directory') {
        document.getElementById('newFilePath').value = state.contextMenuTarget.path + '/';
    }
    
    openModal(modal);
}

function hideNewFileModal() {
    closeModal(document.getElementById('newFileModal'));
}

async function createNewFile() {
    let path = document.getElementById('newFilePath').value.trim();
    
    if (!path) {
        showToast('请输入文件路径', 'warning');
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
        showToast('文件创建成功', 'success');
        
        await loadFileTree();
        openFile(path);
    } catch (e) {
        showToast('创建失败: ' + e.message, 'error');
    }
}

function showRenameModal() {
    if (!state.contextMenuTarget) return;
    
    const modal = document.getElementById('renameModal');
    document.getElementById('newFileName').value = state.contextMenuTarget.name;
    state.renameTarget = state.contextMenuTarget;
    
    openModal(modal);
}

function hideRenameModal() {
    closeModal(document.getElementById('renameModal'));
    state.renameTarget = null;
}

async function confirmRename() {
    if (!state.renameTarget) return;
    
    const newName = document.getElementById('newFileName').value.trim();
    if (!newName) {
        showToast('请输入新文件名', 'warning');
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
        showToast('重命名成功', 'success');
        
        // 更新标签
        const tab = state.tabs.find(t => t.path === oldPath);
        if (tab) {
            tab.path = newPath;
            tab.title = newName.replace('.md', '');
            renderTabs();
        }
        
        await loadFileTree();
    } catch (e) {
        showToast('重命名失败: ' + e.message, 'error');
    }
}

function showDeleteModal() {
    if (!state.contextMenuTarget) return;
    
    const modal = document.getElementById('deleteModal');
    const message = document.getElementById('deleteMessage');
    message.textContent = `确定要删除 "${state.contextMenuTarget.name}" 吗？此操作不可撤销。`;
    
    openModal(modal);
}

function hideDeleteModal() {
    closeModal(document.getElementById('deleteModal'));
}

async function confirmDelete() {
    if (!state.contextMenuTarget) return;
    
    const path = state.contextMenuTarget.path;
    
    try {
        const response = await fetch('/api/editor/module/' + encodeURIComponent(path), {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        hideDeleteModal();
        showToast('删除成功', 'success');
        
        // 关闭相关标签
        const tab = state.tabs.find(t => t.path === path);
        if (tab) {
            closeTab(tab.id, true);
        }
        
        await loadFileTree();
    } catch (e) {
        showToast('删除失败: ' + e.message, 'error');
    }
}

// ==================== 右键菜单 ====================

function showContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();
    
    state.contextMenuTarget = item;
    
    const menu = document.getElementById('contextMenu');
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
            showToast('新建文件夹功能开发中', 'warning');
            break;
        case 'rename':
            showRenameModal();
            break;
        case 'delete':
            showDeleteModal();
            break;
    }
}

// ==================== 布局功能 ====================

function toggleFileTree() {
    state.fileTreeCollapsed = !state.fileTreeCollapsed;
    applyLayout();
    saveLayoutPreferences();
}

function toggleGitPanel() {
    state.gitPanelCollapsed = !state.gitPanelCollapsed;
    applyLayout();
    saveLayoutPreferences();
}

function applyLayout() {
    const fileTreePanel = document.getElementById('fileTreePanel');
    const gitPanel = document.getElementById('gitPanel');
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    
    fileTreePanel.classList.toggle('collapsed', state.fileTreeCollapsed);
    gitPanel.classList.toggle('collapsed', state.gitPanelCollapsed);
    
    leftResizer.style.display = state.fileTreeCollapsed ? 'none' : 'block';
    rightResizer.style.display = state.gitPanelCollapsed ? 'none' : 'block';
    
    if (!state.fileTreeCollapsed) {
        fileTreePanel.style.width = state.fileTreeWidth + 'px';
    }
    if (!state.gitPanelCollapsed) {
        gitPanel.style.width = state.gitPanelWidth + 'px';
    }
}

function initResizers() {
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    
    let isResizing = false;
    let currentResizer = null;
    
    function startResize(e, resizer) {
        isResizing = true;
        currentResizer = resizer;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }
    
    function doResize(e) {
        if (!isResizing) return;
        
        if (currentResizer === leftResizer) {
            const width = Math.max(180, Math.min(400, e.clientX));
            state.fileTreeWidth = width;
            document.getElementById('fileTreePanel').style.width = width + 'px';
        } else if (currentResizer === rightResizer) {
            const width = Math.max(200, Math.min(400, window.innerWidth - e.clientX));
            state.gitPanelWidth = width;
            document.getElementById('gitPanel').style.width = width + 'px';
        }
    }
    
    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        currentResizer.classList.remove('dragging');
        currentResizer = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveLayoutPreferences();
    }
    
    leftResizer.addEventListener('mousedown', (e) => startResize(e, leftResizer));
    rightResizer.addEventListener('mousedown', (e) => startResize(e, rightResizer));
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function loadLayoutPreferences() {
    try {
        const prefs = JSON.parse(localStorage.getItem('editorLayout') || '{}');
        if (prefs.fileTreeWidth) state.fileTreeWidth = prefs.fileTreeWidth;
        if (prefs.gitPanelWidth) state.gitPanelWidth = prefs.gitPanelWidth;
        if (prefs.fileTreeCollapsed !== undefined) state.fileTreeCollapsed = prefs.fileTreeCollapsed;
        if (prefs.gitPanelCollapsed !== undefined) state.gitPanelCollapsed = prefs.gitPanelCollapsed;
    } catch (e) {
        console.error('加载布局偏好失败:', e);
    }
}

function saveLayoutPreferences() {
    try {
        localStorage.setItem('editorLayout', JSON.stringify({
            fileTreeWidth: state.fileTreeWidth,
            gitPanelWidth: state.gitPanelWidth,
            fileTreeCollapsed: state.fileTreeCollapsed,
            gitPanelCollapsed: state.gitPanelCollapsed
        }));
    } catch (e) {
        console.error('保存布局偏好失败:', e);
    }
}

// ==================== 键盘快捷键 ====================

function onKeyDown(e) {
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
    }
    
    // Ctrl+W 关闭标签
    if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (state.activeTabId) {
            closeTab(state.activeTabId);
        }
    }
    
    // Escape 关闭菜单/模态框
    if (e.key === 'Escape') {
        hideContextMenu();
    }
}

// ==================== 未保存提示 ====================

function showUnsavedModal() {
    openModal(document.getElementById('unsavedModal'));
}

function hideUnsavedModal() {
    closeModal(document.getElementById('unsavedModal'));
    state.pendingCloseTabId = null;
}

async function saveAndClose() {
    await saveCurrentFile();
    hideUnsavedModal();
    if (state.pendingCloseTabId) {
        closeTab(state.pendingCloseTabId, true);
    }
}

function discardChanges() {
    hideUnsavedModal();
    if (state.pendingCloseTabId) {
        const tab = state.tabs.find(t => t.id === state.pendingCloseTabId);
        if (tab) {
            tab.isDirty = false;
        }
        closeTab(state.pendingCloseTabId, true);
    }
}

function onBeforeUnload(e) {
    const hasUnsaved = state.tabs.some(t => t.isDirty);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '有未保存的更改，确定要离开吗？';
        return e.returnValue;
    }
}

function onBackClick(e) {
    const hasUnsaved = state.tabs.some(t => t.isDirty);
    if (hasUnsaved) {
        e.preventDefault();
        if (confirm('有未保存的更改，确定要离开吗？')) {
            window.location.href = '/';
        }
    }
}

// ==================== 模态框通用功能 ====================

function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    
    const openModals = document.querySelectorAll('.modal.active');
    if (openModals.length === 0) {
        document.body.classList.remove('modal-open');
    }
}

// ==================== Toast 通知 ====================

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    
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
