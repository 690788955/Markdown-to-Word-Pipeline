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

document.addEventListener('DOMContentLoaded', function () {
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
        console.log('[FileTree] 开始加载文件树...');
        const response = await fetch('/api/editor/tree');
        console.log('[FileTree] 响应状态:', response.status);
        const data = await response.json();
        console.log('[FileTree] 响应数据:', data);

        if (!data.success) throw new Error(data.error);

        state.fileTree = data.data.tree;
        console.log('[FileTree] 文件树数据:', state.fileTree);
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
        // 如果内容已加载但编辑器还没创建（显示的是"加载中..."）
        if (tab.content !== null && !state.editors.has(tab.id)) {
            editorContainer.innerHTML = '';
            createVditorEditor(editorContainer, tab);
        }
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
    // 计算 linkBase
    let linkBase = '/api/src/';
    if (tab.path && tab.path.includes('/')) {
        const dir = tab.path.substring(0, tab.path.lastIndexOf('/'));
        linkBase = '/api/src/' + dir + '/';
    }

    createVditorEditor(editorContainer, tab, linkBase);
}

function createVditorEditor(container, tab, linkBase = '/api/src/') {
    // 确保容器有正确的尺寸后再初始化编辑器
    // 使用 requestAnimationFrame 等待布局完成
    requestAnimationFrame(() => {
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
            preview: {
                markdown: {
                    linkBase: linkBase
                },
                hljs: {
                    enable: true,
                    style: 'github',
                    lineNumber: true
                }
            },
            upload: {
                url: '/api/editor/upload',
                accept: 'image/*',
                linkToImgUrl: '', // 空值表示不转换
                filename(name) {
                    return name.replace(/[^\w\d\._-]/g, '');
                },
                extraData: {
                    modulePath: tab.path || ''
                }
            },
            customWysiwygToolbar: function () { },
            after: () => {
                state.editors.set(tab.id, editor);

                // 强制触发编辑器布局刷新，解决 ir 模式初始化布局问题
                setTimeout(() => {
                    // 触发窗口 resize 事件让 Vditor 重新计算布局
                    window.dispatchEvent(new Event('resize'));

                    // 监听全屏模式变化
                    const vditorElement = container.querySelector('.vditor');
                    if (vditorElement) {
                        // 使用 MutationObserver 监听 class 变化
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                if (mutation.attributeName === 'class') {
                                    const isFullscreen = vditorElement.classList.contains('vditor--fullscreen');
                                    document.body.classList.toggle('vditor-fullscreen-active', isFullscreen);
                                }
                            });
                        });
                        observer.observe(vditorElement, { attributes: true });
                    }
                }, 50);
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
        showToast('\u4FDD\u5B58\u6210\u529F', 'success');
        
        // 保存后自动刷新 Git 状态
        loadGitStatus();
    } catch (e) {
        showToast('\u4FDD\u5B58\u5931\u8D25: ' + e.message, 'error');
        console.error('\u4FDD\u5B58\u5931\u8D25:', e);
    }
}


// ==================== Git 面板功能（VS Code 风格）====================

// Git 状态数据
let gitStagedChanges = [];
let gitUnstagedChanges = [];

async function loadGitStatus() {
    const container = document.getElementById('gitContent');
    container.innerHTML = '<div class="git-loading">\u52A0\u8F7D\u4E2D...</div>';

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

        // 新的 API 返回 staged 和 unstaged 数组
        if (changesData.success && changesData.data) {
            gitStagedChanges = (changesData.data.staged || []).filter(c => c.directory === 'src');
            gitUnstagedChanges = (changesData.data.unstaged || []).filter(c => c.directory === 'src');
        } else {
            gitStagedChanges = [];
            gitUnstagedChanges = [];
        }

        renderGitPanel();
        updateGitBadge();
    } catch (e) {
        container.innerHTML = '<div class="git-loading">\u52A0\u8F7D\u5931\u8D25</div>';
        console.error('\u52A0\u8F7D Git \u72B6\u6001\u5931\u8D25:', e);
    }
}

function renderGitNotRepo(container) {
    container.innerHTML = `
        <div class="git-status">
            <p style="color: #999; text-align: center;">\u5F53\u524D\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93</p>
            <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="initGitRepo()">
                \u521D\u59CB\u5316\u4ED3\u5E93
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
                <span class="git-branch-icon">\u2387</span>
                <span>${state.gitStatus.branch || 'main'}</span>
            </div>
        </div>
    `;

    // 提交区域（VS Code 风格：输入框 + 提交按钮在顶部）
    html += `
        <div class="git-commit-section" style="margin-bottom: 12px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="commitMessage" class="git-commit-input" placeholder="\u63D0\u4EA4\u4FE1\u606F..." style="flex: 1; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px;">
                <button class="btn btn-primary" onclick="commitChanges()" title="\u63D0\u4EA4\u6682\u5B58\u7684\u66F4\u6539" id="gitCommitBtn" style="padding: 6px 12px;">\u2713</button>
            </div>
            <div class="git-actions" style="display: flex; gap: 6px;">
                <button class="btn btn-outline btn-sm" onclick="pushChanges()" style="flex: 1;">\u2191 \u63A8\u9001</button>
                <button class="btn btn-outline btn-sm" onclick="pullChanges()" style="flex: 1;">\u2193 \u62C9\u53D6</button>
            </div>
        </div>
    `;

    // 暂存的更改区域
    html += renderStagedSection();

    // 更改区域（未暂存）
    html += renderUnstagedSection();

    container.innerHTML = html;

    // 更新提交按钮状态
    updateCommitButtonState();
}

// 渲染暂存区文件列表
function renderStagedSection() {
    const count = gitStagedChanges.length;

    let html = `
        <div class="git-changes-section git-staged-section">
            <div class="git-section-header" onclick="toggleGitSection(this)">
                <span class="git-section-toggle">\u25BC</span>
                <span>\u6682\u5B58\u7684\u66F4\u6539</span>
                <span class="git-section-count">${count}</span>
                <div class="git-section-actions">
                    <button class="git-section-btn" onclick="event.stopPropagation(); unstageAllFiles()" title="\u53D6\u6D88\u6682\u5B58\u5168\u90E8">\u2212</button>
                </div>
            </div>
            <div class="git-section-content">
    `;

    if (count === 0) {
        html += '<div class="git-empty-hint">\u6CA1\u6709\u6682\u5B58\u7684\u66F4\u6539</div>';
    } else {
        for (const file of gitStagedChanges) {
            html += renderGitFileItem(file, true);
        }
    }

    html += '</div></div>';
    return html;
}

// 渲染未暂存文件列表
function renderUnstagedSection() {
    const count = gitUnstagedChanges.length;

    let html = `
        <div class="git-changes-section git-unstaged-section">
            <div class="git-section-header" onclick="toggleGitSection(this)">
                <span class="git-section-toggle">\u25BC</span>
                <span>\u66F4\u6539</span>
                <span class="git-section-count">${count}</span>
                <div class="git-section-actions">
                    <button class="git-section-btn" onclick="event.stopPropagation(); stageAllFiles()" title="\u6682\u5B58\u5168\u90E8">+</button>
                </div>
            </div>
            <div class="git-section-content">
    `;

    if (count === 0) {
        html += '<div class="git-empty-hint">\u6CA1\u6709\u66F4\u6539\u7684\u6587\u4EF6</div>';
    } else {
        for (const file of gitUnstagedChanges) {
            html += renderGitFileItem(file, false);
        }
    }

    html += '</div></div>';
    return html;
}

// 渲染单个文件项
function renderGitFileItem(file, isStaged) {
    const statusLetter = getStatusLetter(file.status);
    const statusClass = getStatusColorClass(file.status);
    const displayPath = file.path.replace('src/', '');

    let actionsHtml = '';
    if (isStaged) {
        actionsHtml = '<button class="git-file-btn" onclick="unstageFile(\'' + escapeHtmlAttr(file.path) + '\')" title="\u53D6\u6D88\u6682\u5B58">\u2212</button>';
    } else {
        actionsHtml = '<button class="git-file-btn git-discard-btn" onclick="discardFile(\'' + escapeHtmlAttr(file.path) + '\')" title="\u653E\u5F03\u66F4\u6539">\u21BA</button>' +
            '<button class="git-file-btn" onclick="stageFile(\'' + escapeHtmlAttr(file.path) + '\')" title="\u6682\u5B58">+</button>';
    }

    return '<div class="git-file-item">' +
        '<span class="git-file-name" title="' + escapeHtmlAttr(file.path) + '">' + escapeHtmlAttr(displayPath) + '</span>' +
        '<div class="git-file-actions">' + actionsHtml + '</div>' +
        '<span class="git-file-status ' + statusClass + '">' + statusLetter + '</span>' +
        '</div>';
}

// 获取状态字母
function getStatusLetter(status) {
    const letters = {
        'M': 'M', 'A': 'A', 'D': 'D', 'U': 'U', 'R': 'R',
        'modified': 'M', 'added': 'A', 'deleted': 'D', 'untracked': 'U', 'renamed': 'R'
    };
    return letters[status] || '?';
}

// 获取状态颜色类
function getStatusColorClass(status) {
    const classes = {
        'M': 'status-modified', 'A': 'status-added', 'D': 'status-deleted', 'U': 'status-untracked', 'R': 'status-renamed',
        'modified': 'status-modified', 'added': 'status-added', 'deleted': 'status-deleted', 'untracked': 'status-untracked', 'renamed': 'status-renamed'
    };
    return classes[status] || 'status-unknown';
}

// 切换区域展开/折叠
function toggleGitSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// 更新提交按钮状态
function updateCommitButtonState() {
    const btn = document.getElementById('gitCommitBtn');
    if (!btn) return;

    if (gitStagedChanges.length === 0) {
        btn.disabled = true;
        btn.title = '\u6682\u5B58\u533A\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u63D0\u4EA4';
    } else {
        btn.disabled = false;
        btn.title = '\u63D0\u4EA4\u6682\u5B58\u7684\u66F4\u6539';
    }
}

// HTML 属性转义
function escapeHtmlAttr(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateGitBadge() {
    const badge = document.getElementById('gitBadge');
    const count = gitStagedChanges.length + gitUnstagedChanges.length;

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== 暂存区操作 ====================

// 暂存单个文件
async function stageFile(filePath) {
    try {
        const response = await fetch('/api/git/stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        const data = await response.json();
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('\u6682\u5B58\u5931\u8D25: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('\u6682\u5B58\u5931\u8D25: ' + e.message, 'error');
    }
}

// 取消暂存单个文件
async function unstageFile(filePath) {
    try {
        const response = await fetch('/api/git/unstage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        const data = await response.json();
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('\u53D6\u6D88\u6682\u5B58\u5931\u8D25: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('\u53D6\u6D88\u6682\u5B58\u5931\u8D25: ' + e.message, 'error');
    }
}

// 暂存所有文件
async function stageAllFiles() {
    try {
        const response = await fetch('/api/git/stage-all', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('\u6682\u5B58\u5168\u90E8\u5931\u8D25: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('\u6682\u5B58\u5168\u90E8\u5931\u8D25: ' + e.message, 'error');
    }
}

// 取消暂存所有文件
async function unstageAllFiles() {
    try {
        const response = await fetch('/api/git/unstage-all', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadGitStatus();
        } else {
            showToast('\u53D6\u6D88\u6682\u5B58\u5168\u90E8\u5931\u8D25: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('\u53D6\u6D88\u6682\u5B58\u5168\u90E8\u5931\u8D25: ' + e.message, 'error');
    }
}

// 放弃单个文件的更改
async function discardFile(filePath) {
    const fileName = filePath.split('/').pop();
    if (!confirm('\u786E\u5B9A\u8981\u653E\u5F03\u5BF9 "' + fileName + '" \u7684\u66F4\u6539\u5417\uFF1F\n\n\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01')) {
        return;
    }

    try {
        const response = await fetch('/api/git/discard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filePath] })
        });
        const data = await response.json();
        if (data.success) {
            showToast('\u5DF2\u653E\u5F03\u66F4\u6539', 'success');
            await loadGitStatus();
        } else {
            showToast('\u653E\u5F03\u66F4\u6539\u5931\u8D25: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('\u653E\u5F03\u66F4\u6539\u5931\u8D25: ' + e.message, 'error');
    }
}

async function initGitRepo() {
    try {
        const response = await fetch('/api/git/init', { method: 'POST' });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        showToast('Git \u4ED3\u5E93\u521D\u59CB\u5316\u6210\u529F', 'success');
        loadGitStatus();
    } catch (e) {
        showToast('\u521D\u59CB\u5316\u5931\u8D25: ' + e.message, 'error');
    }
}

async function commitChanges() {
    const msgInput = document.getElementById('commitMessage');
    let message = msgInput ? msgInput.value.trim() : '';

    // 默认提交信息
    if (!message) {
        const now = new Date();
        message = '\u66F4\u65B0 ' + now.toLocaleString('zh-CN');
    }

    if (gitStagedChanges.length === 0) {
        showToast('\u6682\u5B58\u533A\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u6682\u5B58\u8981\u63D0\u4EA4\u7684\u6587\u4EF6', 'info');
        return;
    }

    try {
        const response = await fetch('/api/git/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        showToast('\u63D0\u4EA4\u6210\u529F: ' + data.data.hash, 'success');
        if (msgInput) msgInput.value = '';
        loadGitStatus();
    } catch (e) {
        showToast('\u63D0\u4EA4\u5931\u8D25: ' + e.message, 'error');
    }
}

async function pushChanges() {
    try {
        const response = await fetch('/api/git/push', { method: 'POST' });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        showToast('\u63A8\u9001\u6210\u529F', 'success');
        loadGitStatus();
    } catch (e) {
        showToast('\u63A8\u9001\u5931\u8D25: ' + e.message, 'error');
    }
}

async function pullChanges() {
    try {
        const response = await fetch('/api/git/pull', { method: 'POST' });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        showToast('\u62C9\u53D6\u6210\u529F', 'success');
        loadGitStatus();
        loadFileTree();
    } catch (e) {
        showToast('\u62C9\u53D6\u5931\u8D25: ' + e.message, 'error');
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
    const tabId = state.pendingCloseTabId; // 先保存 tabID
    hideUnsavedModal(); // 这会清空 pendingCloseTabId

    if (tabId) {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.isDirty = false;
        }
        closeTab(tabId, true);
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
