// 运维文档生成系统 - 前端逻辑 v8
// 支持 Word 和 PDF 格式输出，支持自定义配置，支持完整 PDF 选项配置

let documentTypes = [];
let generatedFiles = [];
let availableModules = [];
let availableTemplates = [];
let selectedModules = [];
let currentEditConfig = null; // 当前编辑的配置
let currentClient = null; // 当前选中的客户信息
let moduleTree = null; // 模块树形结构
let expandedDirs = new Set(); // 展开的目录
let searchQuery = ''; // 搜索关键词

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadClients();
    
    const clientSelect = document.getElementById('clientSelect');
    const generateAllBtn = document.getElementById('generateAllBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    
    if (clientSelect) {
        clientSelect.addEventListener('change', onClientChange);
    }
    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', generateAll);
    }
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAll);
    }

    // 配置表单事件
    const cfgClientName = document.getElementById('cfgClientName');
    const cfgDocTypeName = document.getElementById('cfgDocTypeName');
    const cfgOutputPattern = document.getElementById('cfgOutputPattern');
    
    if (cfgClientName) cfgClientName.addEventListener('input', updateFilenamePreview);
    if (cfgDocTypeName) cfgDocTypeName.addEventListener('input', updateFilenamePreview);
    if (cfgOutputPattern) cfgOutputPattern.addEventListener('input', updateFilenamePreview);
    
    // Tab 切换事件
    initTabs();
});

// 初始化 Tab 切换
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            // 移除所有 active
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            // 添加 active
            this.classList.add('active');
            const tabContent = document.getElementById(tabId);
            if (tabContent) tabContent.classList.add('active');
        });
    });
}

// 获取当前选择的输出格式
function getSelectedFormat() {
    const formatSelect = document.getElementById('formatSelect');
    return formatSelect ? formatSelect.value : 'word';
}

// 加载客户列表
async function loadClients() {
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect) return;
    
    try {
        const response = await fetch('/api/clients');
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        const clients = data.data.clients || [];
        clientSelect.innerHTML = '<option value="">请选择客户配置</option>';
        
        // 分组：标准文档和自定义配置
        const standardClients = clients.filter(c => !c.isCustom);
        const customClients = clients.filter(c => c.isCustom);
        
        if (standardClients.length > 0) {
            const standardGroup = document.createElement('optgroup');
            standardGroup.label = '标准文档';
            standardClients.forEach(function(c) {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.displayName || c.name;
                opt.dataset.isCustom = 'false';
                standardGroup.appendChild(opt);
            });
            clientSelect.appendChild(standardGroup);
        }
        
        if (customClients.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = '自定义配置';
            customClients.forEach(function(c) {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.displayName || c.name;
                opt.dataset.isCustom = 'true';
                customGroup.appendChild(opt);
            });
            clientSelect.appendChild(customGroup);
        }
        
        // 保存客户信息
        window.clientsData = clients;
    } catch (e) {
        clientSelect.innerHTML = '<option value="">加载失败</option>';
        console.error('加载客户列表失败:', e);
    }
}

// 客户变化
async function onClientChange() {
    const clientSelect = document.getElementById('clientSelect');
    const generateAllBtn = document.getElementById('generateAllBtn');
    const docList = document.getElementById('docList');
    
    const client = clientSelect ? clientSelect.value : '';
    
    // 获取当前客户信息
    currentClient = window.clientsData ? window.clientsData.find(c => c.name === client) : null;
    
    if (generateAllBtn) generateAllBtn.disabled = true;
    hideResult();
    
    if (!client) {
        if (docList) docList.innerHTML = '<div class="list-empty">请先选择客户配置</div>';
        return;
    }
    
    if (docList) docList.innerHTML = '<div class="list-empty">加载中...</div>';
    
    try {
        const url = '/api/clients/' + encodeURIComponent(client) + '/docs';
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        documentTypes = data.data.documentTypes || [];
        renderDocList();
        if (generateAllBtn) generateAllBtn.disabled = documentTypes.length === 0;
    } catch (e) {
        if (docList) docList.innerHTML = '<div class="list-empty">加载失败</div>';
        console.error('加载文档类型失败:', e);
    }
}

// 渲染文档列表
function renderDocList() {
    const docList = document.getElementById('docList');
    if (!docList) return;
    
    if (documentTypes.length === 0) {
        docList.innerHTML = '<div class="list-empty">没有可用的文档类型</div>';
        return;
    }
    
    const isCustomClient = currentClient && currentClient.isCustom;
    
    docList.innerHTML = '';
    documentTypes.forEach(function(doc) {
        const item = document.createElement('div');
        item.className = 'doc-item';
        
        const name = document.createElement('div');
        name.className = 'doc-name';
        name.textContent = doc.displayName || doc.name;
        if (doc.isDefault) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = '(默认)';
            name.appendChild(badge);
        }
        
        const actions = document.createElement('div');
        actions.className = 'doc-actions';
        
        const genBtn = document.createElement('button');
        genBtn.className = 'btn btn-outline btn-sm';
        genBtn.innerHTML = '<span class="btn-text">生成</span><span class="btn-loading" style="display:none;">生成中</span>';
        genBtn.onclick = function() { generateSingle(doc.name, genBtn); };
        actions.appendChild(genBtn);
        
        // 自定义配置显示编辑和删除按钮
        if (isCustomClient) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline btn-sm';
            editBtn.textContent = '编辑';
            editBtn.onclick = function() { editConfig(currentClient.name, doc.name); };
            actions.appendChild(editBtn);
            
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-outline btn-sm btn-danger-outline';
            delBtn.textContent = '删除';
            delBtn.onclick = function() { confirmDeleteConfig(currentClient.name, doc.name); };
            actions.appendChild(delBtn);
        }
        
        item.appendChild(name);
        item.appendChild(actions);
        docList.appendChild(item);
    });
}

// 生成单个文档
async function generateSingle(docType, btn) {
    const clientSelect = document.getElementById('clientSelect');
    const clientNameInput = document.getElementById('clientNameInput');
    
    const client = clientSelect ? clientSelect.value : '';
    const customName = clientNameInput ? clientNameInput.value.trim() : '';
    const format = getSelectedFormat();
    
    if (!client) return;
    
    setLoading(btn, true);
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientConfig: client,
                documentTypes: [docType],
                clientName: customName,
                format: format
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        const files = data.data.files || [];
        if (files.length > 0) {
            addToResult(files);
        }
    } catch (e) {
        alert('生成失败: ' + e.message);
    } finally {
        setLoading(btn, false);
    }
}

// 全部生成
async function generateAll() {
    const clientSelect = document.getElementById('clientSelect');
    const clientNameInput = document.getElementById('clientNameInput');
    const generateAllBtn = document.getElementById('generateAllBtn');
    
    const client = clientSelect ? clientSelect.value : '';
    const customName = clientNameInput ? clientNameInput.value.trim() : '';
    const format = getSelectedFormat();
    const allDocs = documentTypes.map(function(d) { return d.name; });
    
    if (!client || allDocs.length === 0) return;
    
    setLoading(generateAllBtn, true);
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientConfig: client,
                documentTypes: allDocs,
                clientName: customName,
                format: format
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        const files = data.data.files || [];
        if (files.length > 0) {
            generatedFiles = files;
            showResult(files);
        }
    } catch (e) {
        alert('生成失败: ' + e.message);
    } finally {
        setLoading(generateAllBtn, false);
    }
}

// 获取文件图标
function getFileIcon(fileName) {
    if (fileName.endsWith('.pdf')) {
        return '📕';
    }
    return '📄';
}

// 添加到结果
function addToResult(files) {
    files.forEach(function(f) {
        const exists = generatedFiles.find(function(g) { return g.fileName === f.fileName; });
        if (!exists) generatedFiles.push(f);
    });
    showResult(generatedFiles);
}

// 显示结果
function showResult(files) {
    const resultSection = document.getElementById('resultSection');
    const resultList = document.getElementById('resultList');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    
    if (resultSection) resultSection.style.display = 'block';
    if (resultList) {
        resultList.innerHTML = '';
        files.forEach(function(file) {
            const item = document.createElement('div');
            item.className = 'result-item';
            
            const link = document.createElement('a');
            link.href = file.downloadUrl;
            link.download = file.fileName;
            link.textContent = getFileIcon(file.fileName) + ' ' + file.fileName;
            
            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn btn-outline btn-sm';
            dlBtn.textContent = '下载';
            dlBtn.onclick = function() { window.location.href = file.downloadUrl; };
            
            item.appendChild(link);
            item.appendChild(dlBtn);
            resultList.appendChild(item);
        });
    }
    
    if (downloadAllBtn) {
        downloadAllBtn.style.display = files.length > 1 ? 'inline-flex' : 'none';
    }
}

// 隐藏结果
function hideResult() {
    const resultSection = document.getElementById('resultSection');
    if (resultSection) resultSection.style.display = 'none';
    generatedFiles = [];
}

// 打包下载
async function downloadAll() {
    if (generatedFiles.length === 0) return;
    
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = '打包中...';
    }
    
    try {
        const fileNames = generatedFiles.map(function(f) { return f.fileName; });
        const response = await fetch('/api/download-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: fileNames })
        });
        
        if (!response.ok) throw new Error('打包失败');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '文档打包.zip';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('打包下载失败: ' + e.message);
    } finally {
        if (downloadAllBtn) {
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = '打包下载';
        }
    }
}

// 设置加载状态
function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    const text = btn.querySelector('.btn-text');
    const load = btn.querySelector('.btn-loading');
    if (text) text.style.display = loading ? 'none' : 'inline';
    if (load) load.style.display = loading ? 'inline-flex' : 'none';
}

// ==================== 自定义配置功能 ====================

// 显示配置模态框
async function showConfigModal(editMode = false) {
    const modal = document.getElementById('configModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal) return;
    
    // 重置搜索
    searchQuery = '';
    const searchInput = document.getElementById('moduleSearch');
    if (searchInput) searchInput.value = '';
    
    // 加载模块和模板列表
    await Promise.all([loadModules(), loadTemplates()]);
    
    // 初始化搜索事件
    initModuleSearch();
    
    if (editMode && currentEditConfig) {
        modalTitle.textContent = '编辑配置';
        fillConfigForm(currentEditConfig);
        // 编辑模式下禁用客户名称和文档类型名称
        document.getElementById('cfgClientName').disabled = true;
        document.getElementById('cfgDocTypeName').disabled = true;
    } else {
        modalTitle.textContent = '新建配置';
        resetConfigForm();
        document.getElementById('cfgClientName').disabled = false;
        document.getElementById('cfgDocTypeName').disabled = false;
        currentEditConfig = null;
    }
    
    modal.style.display = 'flex';
    updateFilenamePreview();
}

// 隐藏配置模态框
function hideConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) modal.style.display = 'none';
    currentEditConfig = null;
}

// 加载可用模块
async function loadModules() {
    try {
        const response = await fetch('/api/modules');
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        availableModules = data.data.modules || [];
        moduleTree = data.data.tree || { rootModules: [], directories: [] };
        
        // 默认展开所有目录
        expandedDirs = new Set();
        moduleTree.directories.forEach(dir => expandedDirs.add(dir.name));
        
        renderTransferUI();
    } catch (e) {
        console.error('加载模块列表失败:', e);
        availableModules = [];
        moduleTree = { rootModules: [], directories: [] };
    }
}

// 渲染穿梭框 UI
function renderTransferUI() {
    renderAvailableModules();
    renderSelectedModules();
    updateSelectedCount();
    // 模块变化时加载变量
    if (typeof onModulesChanged === 'function') {
        onModulesChanged();
    }
}

// 渲染左侧可选模块列表
function renderAvailableModules() {
    const container = document.getElementById('availableModules');
    if (!container) return;
    
    if (!moduleTree || (moduleTree.rootModules.length === 0 && moduleTree.directories.length === 0)) {
        container.innerHTML = '<div class="list-empty">没有可用的模块</div>';
        return;
    }
    
    container.innerHTML = '';
    const query = searchQuery.toLowerCase();
    
    // 渲染根目录模块
    const rootModules = moduleTree.rootModules.filter(mod => {
        if (selectedModules.includes(mod.path)) return false;
        if (query && !mod.displayName.toLowerCase().includes(query) && !mod.fileName.toLowerCase().includes(query)) return false;
        return true;
    });
    
    if (rootModules.length > 0) {
        const section = document.createElement('div');
        section.className = 'root-modules-section';
        
        const header = document.createElement('div');
        header.className = 'root-modules-header';
        header.textContent = '📁 根目录';
        section.appendChild(header);
        
        rootModules.forEach(mod => {
            section.appendChild(createAvailableModuleItem(mod));
        });
        
        container.appendChild(section);
    }
    
    // 渲染子目录
    moduleTree.directories.forEach(dir => {
        const dirModules = dir.modules.filter(mod => {
            if (selectedModules.includes(mod.path)) return false;
            if (query && !mod.displayName.toLowerCase().includes(query) && !mod.fileName.toLowerCase().includes(query)) return false;
            return true;
        });
        
        if (dirModules.length === 0 && query) return; // 搜索时隐藏空目录
        
        const group = document.createElement('div');
        group.className = 'module-group';
        
        // 目录头部
        const header = document.createElement('div');
        header.className = 'module-group-header' + (expandedDirs.has(dir.name) ? '' : ' collapsed');
        header.onclick = () => toggleDirectory(dir.name);
        
        const toggle = document.createElement('span');
        toggle.className = 'module-group-toggle';
        toggle.textContent = '▼';
        
        const name = document.createElement('span');
        name.className = 'module-group-name';
        name.textContent = '📁 ' + dir.displayName;
        
        const count = document.createElement('span');
        count.className = 'module-group-count';
        count.textContent = dirModules.length + '/' + dir.modules.length;
        
        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'module-group-select';
        selectBtn.textContent = '全选';
        selectBtn.onclick = (e) => { e.stopPropagation(); selectDirectory(dir.name); };
        
        header.appendChild(toggle);
        header.appendChild(name);
        header.appendChild(count);
        header.appendChild(selectBtn);
        group.appendChild(header);
        
        // 目录内容
        const items = document.createElement('div');
        items.className = 'module-group-items';
        
        dirModules.forEach(mod => {
            items.appendChild(createAvailableModuleItem(mod));
        });
        
        group.appendChild(items);
        container.appendChild(group);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = '<div class="list-empty">没有匹配的模块</div>';
    }
}

// 创建可选模块项
function createAvailableModuleItem(mod) {
    const item = document.createElement('div');
    item.className = 'transfer-module-item';
    item.dataset.path = mod.path;
    item.onclick = () => addModule(mod.path);
    
    const label = document.createElement('span');
    label.className = 'module-label';
    label.textContent = mod.displayName || mod.fileName;
    
    item.appendChild(label);
    
    if (mod.directory) {
        const path = document.createElement('span');
        path.className = 'module-path';
        path.textContent = mod.directory;
        item.appendChild(path);
    }
    
    return item;
}

// 渲染右侧已选模块列表
function renderSelectedModules() {
    const container = document.getElementById('selectedModules');
    if (!container) return;
    
    if (selectedModules.length === 0) {
        container.innerHTML = '<div class="list-empty">请从左侧选择模块</div>';
        return;
    }
    
    container.innerHTML = '';
    
    selectedModules.forEach((path, index) => {
        const mod = findModuleByPath(path);
        if (!mod) return;
        
        const item = document.createElement('div');
        item.className = 'transfer-module-item';
        item.draggable = true;
        item.dataset.path = path;
        item.dataset.index = index;
        
        // 序号
        const order = document.createElement('span');
        order.className = 'module-order';
        order.textContent = index + 1;
        
        // 标签
        const label = document.createElement('span');
        label.className = 'module-label';
        label.textContent = mod.displayName || mod.fileName;
        
        // 目录标记
        if (mod.directory) {
            const dirTag = document.createElement('span');
            dirTag.className = 'module-path';
            dirTag.textContent = mod.directory;
            label.appendChild(dirTag);
        }
        
        // 拖拽手柄
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⋮⋮';
        
        item.appendChild(order);
        item.appendChild(label);
        item.appendChild(handle);
        
        // 点击移除
        item.onclick = (e) => {
            if (e.target.classList.contains('drag-handle')) return;
            removeModule(path);
        };
        
        // 拖拽事件
        item.addEventListener('dragstart', onDragStart);
        item.addEventListener('dragend', onDragEnd);
        item.addEventListener('dragover', onDragOver);
        item.addEventListener('dragleave', onDragLeave);
        item.addEventListener('drop', onDrop);
        
        container.appendChild(item);
    });
}

// 根据路径查找模块
function findModuleByPath(path) {
    // 先在扁平列表中查找
    let mod = availableModules.find(m => m.path === path);
    if (mod) return mod;
    
    // 兼容旧格式
    mod = availableModules.find(m => 'src/' + m.fileName === path || m.fileName === path);
    return mod;
}

// 更新已选数量
function updateSelectedCount() {
    const countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = selectedModules.length;
}

// 添加模块到已选
function addModule(path) {
    if (!selectedModules.includes(path)) {
        selectedModules.push(path);
        renderTransferUI();
    }
}

// 从已选移除模块
function removeModule(path) {
    selectedModules = selectedModules.filter(p => p !== path);
    renderTransferUI();
}

// 切换目录展开/折叠
function toggleDirectory(dirName) {
    if (expandedDirs.has(dirName)) {
        expandedDirs.delete(dirName);
    } else {
        expandedDirs.add(dirName);
    }
    renderAvailableModules();
}

// 选择整个目录
function selectDirectory(dirName) {
    const dir = moduleTree.directories.find(d => d.name === dirName);
    if (!dir) return;
    
    dir.modules.forEach(mod => {
        if (!selectedModules.includes(mod.path)) {
            selectedModules.push(mod.path);
        }
    });
    
    renderTransferUI();
}

// 全选所有模块
function selectAllModules() {
    // 添加根目录模块
    moduleTree.rootModules.forEach(mod => {
        if (!selectedModules.includes(mod.path)) {
            selectedModules.push(mod.path);
        }
    });
    
    // 添加所有子目录模块
    moduleTree.directories.forEach(dir => {
        dir.modules.forEach(mod => {
            if (!selectedModules.includes(mod.path)) {
                selectedModules.push(mod.path);
            }
        });
    });
    
    renderTransferUI();
}

// 清空所有已选模块
function clearAllModules() {
    selectedModules = [];
    renderTransferUI();
}

// 搜索模块
function onModuleSearch(e) {
    searchQuery = e.target.value.trim();
    renderAvailableModules();
}

// 初始化搜索事件
function initModuleSearch() {
    const searchInput = document.getElementById('moduleSearch');
    if (searchInput) {
        searchInput.addEventListener('input', onModuleSearch);
    }
}

// 拖拽相关变量
let draggedIndex = null;
let draggedItem = null;

// 拖拽开始
function onDragStart(e) {
    draggedItem = e.target;
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

// 拖拽结束
function onDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItem = null;
    draggedIndex = null;
    
    // 清除所有拖拽指示
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

// 拖拽经过
function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedItem || draggedItem === e.currentTarget) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
    if (e.clientY < midY) {
        e.currentTarget.classList.add('drag-over-top');
    } else {
        e.currentTarget.classList.add('drag-over-bottom');
    }
}

// 拖拽离开
function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
}

// 放置
function onDrop(e) {
    e.preventDefault();
    
    const isTop = e.currentTarget.classList.contains('drag-over-top');
    e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
    
    if (!draggedItem || draggedItem === e.currentTarget) return;
    
    const fromIndex = draggedIndex;
    let toIndex = parseInt(e.currentTarget.dataset.index);
    
    // 调整目标索引
    if (!isTop && fromIndex < toIndex) {
        // 不需要调整
    } else if (isTop && fromIndex > toIndex) {
        // 不需要调整
    } else if (!isTop) {
        toIndex = toIndex + 1;
    }
    
    // 重新排序
    const [moved] = selectedModules.splice(fromIndex, 1);
    selectedModules.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
    
    renderSelectedModules();
    updateSelectedCount();
}

// 移动选中到右侧（批量）
function moveSelectedToRight() {
    // 获取左侧所有可见模块
    const items = document.querySelectorAll('#availableModules .transfer-module-item.selected');
    items.forEach(item => {
        const path = item.dataset.path;
        if (path && !selectedModules.includes(path)) {
            selectedModules.push(path);
        }
    });
    renderTransferUI();
}

// 移动选中到左侧（批量）
function moveSelectedToLeft() {
    const items = document.querySelectorAll('#selectedModules .transfer-module-item.selected');
    const pathsToRemove = [];
    items.forEach(item => {
        const path = item.dataset.path;
        if (path) pathsToRemove.push(path);
    });
    selectedModules = selectedModules.filter(p => !pathsToRemove.includes(p));
    renderTransferUI();
}

// 加载可用模板
async function loadTemplates() {
    const templateSelect = document.getElementById('cfgTemplate');
    if (!templateSelect) return;
    
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        availableTemplates = data.data.templates || [];
        templateSelect.innerHTML = '<option value="">使用默认模板 (default.docx)</option>';
        availableTemplates.forEach(function(t) {
            // 跳过 default.docx，因为已经作为默认选项
            if (t.fileName === 'default.docx') return;
            const opt = document.createElement('option');
            opt.value = t.fileName;
            opt.textContent = t.displayName || t.fileName;
            templateSelect.appendChild(opt);
        });
    } catch (e) {
        console.error('加载模板列表失败:', e);
        templateSelect.innerHTML = '<option value="">加载失败</option>';
    }
}

// 重置配置表单
function resetConfigForm() {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    
    setVal('cfgClientName', '');
    setVal('cfgDocTypeName', '');
    setVal('cfgTemplate', '');
    setVal('cfgOutputPattern', '');
    
    // 基础参数
    setChecked('argToc', true);
    setChecked('argNumberSections', true);
    setChecked('argStandalone', true);
    setChecked('argFileScope', false);
    setChecked('argPreserveTabs', false);
    setChecked('argStripComments', false);
    setChecked('argNoHighlight', false);
    
    // 下拉选项
    setVal('argTocDepth', '');
    setVal('argShiftHeading', '');
    setVal('argTopLevelDiv', '');
    setVal('argHighlightStyle', '');
    setVal('argWrap', '');
    setVal('argColumns', '');
    setVal('argTabStop', '');
    
    // 自定义参数
    setVal('cfgCustomArgs', '');
    
    // PDF 设置重置
    setVal('pdfMainFont', 'Microsoft YaHei');
    setVal('pdfMonoFont', 'Consolas');
    setVal('pdfFontSize', '');
    setVal('pdfLineStretch', '');
    setChecked('pdfTitlePage', true);
    setVal('pdfTitleBgColor', '#2C3E50');
    setVal('pdfTitleTextColor', '#FFFFFF');
    setVal('pdfTitleRuleColor', '#3498DB');
    setVal('pdfGeometry', '');
    setVal('pdfPaperSize', '');
    setChecked('pdfTocOwnPage', true);
    setChecked('pdfColorLinks', true);
    setVal('pdfLinkColor', '#2980B9');
    setVal('pdfUrlColor', '#3498DB');
    setChecked('pdfListings', true);
    setChecked('pdfListingsNoBreak', true);
    setVal('pdfCodeFontSize', '');
    setVal('pdfHeaderLeft', '\\leftmark');
    setVal('pdfHeaderRight', '\\thepage');
    
    selectedModules = [];
    renderTransferUI();
}

// 填充配置表单（编辑模式）
function fillConfigForm(config) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    
    setVal('cfgClientName', config.clientName || '');
    setVal('cfgDocTypeName', config.docTypeName || '');
    setVal('cfgTemplate', config.template || '');
    setVal('cfgOutputPattern', config.outputPattern || '');
    
    // 解析 Pandoc 参数
    const args = config.pandocArgs || [];
    
    // 基础复选框参数
    setChecked('argToc', args.includes('--toc'));
    setChecked('argNumberSections', args.includes('--number-sections'));
    setChecked('argStandalone', args.includes('--standalone'));
    setChecked('argFileScope', args.includes('--file-scope'));
    setChecked('argPreserveTabs', args.includes('--preserve-tabs'));
    setChecked('argStripComments', args.includes('--strip-comments'));
    setChecked('argNoHighlight', args.includes('--no-highlight'));
    
    // 解析带值的参数
    let tocDepth = '', shiftHeading = '', topLevelDiv = '', highlightStyle = '';
    let wrap = '', columns = '', tabStop = '';
    const customArgs = [];
    
    const standardArgs = [
        '--toc', '--number-sections', '--standalone', '--file-scope',
        '--preserve-tabs', '--strip-comments', '--no-highlight'
    ];
    
    args.forEach(function(arg) {
        if (standardArgs.includes(arg)) return;
        
        if (arg.startsWith('--toc-depth=')) {
            tocDepth = arg.split('=')[1];
        } else if (arg.startsWith('--shift-heading-level-by=')) {
            shiftHeading = arg.split('=')[1];
        } else if (arg.startsWith('--top-level-division=')) {
            topLevelDiv = arg.split('=')[1];
        } else if (arg.startsWith('--highlight-style=')) {
            highlightStyle = arg.split('=')[1];
        } else if (arg.startsWith('--wrap=')) {
            wrap = arg.split('=')[1];
        } else if (arg.startsWith('--columns=')) {
            columns = arg.split('=')[1];
        } else if (arg.startsWith('--tab-stop=')) {
            tabStop = arg.split('=')[1];
        } else {
            customArgs.push(arg);
        }
    });
    
    setVal('argTocDepth', tocDepth);
    setVal('argShiftHeading', shiftHeading);
    setVal('argTopLevelDiv', topLevelDiv);
    setVal('argHighlightStyle', highlightStyle);
    setVal('argWrap', wrap);
    setVal('argColumns', columns);
    setVal('argTabStop', tabStop);
    setVal('cfgCustomArgs', customArgs.join(' '));
    
    // PDF 设置
    const pdf = config.pdfOptions || {};
    setVal('pdfMainFont', pdf.mainfont || 'Microsoft YaHei');
    setVal('pdfMonoFont', pdf.monofont || 'Consolas');
    setVal('pdfFontSize', pdf.fontsize || '');
    setVal('pdfLineStretch', pdf.linestretch ? String(pdf.linestretch) : '');
    setChecked('pdfTitlePage', pdf.titlepage !== false);
    setVal('pdfTitleBgColor', '#' + (pdf['titlepage-color'] || '2C3E50'));
    setVal('pdfTitleTextColor', '#' + (pdf['titlepage-text-color'] || 'FFFFFF'));
    setVal('pdfTitleRuleColor', '#' + (pdf['titlepage-rule-color'] || '3498DB'));
    setVal('pdfGeometry', pdf.geometry || '');
    setVal('pdfPaperSize', pdf.papersize || '');
    setChecked('pdfTocOwnPage', pdf['toc-own-page'] !== false);
    setChecked('pdfColorLinks', pdf.colorlinks !== false);
    setVal('pdfLinkColor', '#' + (pdf.linkcolor || '2980B9'));
    setVal('pdfUrlColor', '#' + (pdf.urlcolor || '3498DB'));
    setChecked('pdfListings', pdf.listings !== false);
    setChecked('pdfListingsNoBreak', pdf['listings-no-page-break'] !== false);
    setVal('pdfCodeFontSize', pdf['code-block-font-size'] || '');
    setVal('pdfHeaderLeft', pdf['header-left'] || '\\leftmark');
    setVal('pdfHeaderRight', pdf['header-right'] || '\\thepage');
    
    // 模块列表
    selectedModules = config.modules || [];
    renderTransferUI();
}

// 更新文件名预览
function updateFilenamePreview() {
    const preview = document.getElementById('filenamePreview');
    if (!preview) return;
    
    const clientName = document.getElementById('cfgClientName').value || '客户名';
    const docTypeName = document.getElementById('cfgDocTypeName').value || '文档类型';
    let pattern = document.getElementById('cfgOutputPattern').value || '{client}_{title}_{date}.docx';
    
    const today = new Date();
    const dateStr = today.getFullYear() + 
        String(today.getMonth() + 1).padStart(2, '0') + 
        String(today.getDate()).padStart(2, '0');
    
    let filename = pattern
        .replace('{client}', clientName)
        .replace('{title}', docTypeName)
        .replace('{version}', 'v1.0')
        .replace('{date}', dateStr);
    
    preview.textContent = filename;
}

// 提交配置
async function submitConfig() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const isChecked = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
    const getColor = (id) => { const el = document.getElementById(id); return el ? el.value.replace('#', '') : ''; };
    
    const clientName = getVal('cfgClientName');
    const docTypeName = getVal('cfgDocTypeName');
    const template = getVal('cfgTemplate');
    const outputPattern = getVal('cfgOutputPattern');
    
    // 收集 Pandoc 参数
    const pandocArgs = [];
    
    // 基础复选框参数
    if (isChecked('argToc')) pandocArgs.push('--toc');
    if (isChecked('argNumberSections')) pandocArgs.push('--number-sections');
    if (isChecked('argStandalone')) pandocArgs.push('--standalone');
    if (isChecked('argFileScope')) pandocArgs.push('--file-scope');
    if (isChecked('argPreserveTabs')) pandocArgs.push('--preserve-tabs');
    if (isChecked('argStripComments')) pandocArgs.push('--strip-comments');
    if (isChecked('argNoHighlight')) pandocArgs.push('--no-highlight');
    
    // 带值的参数
    const tocDepth = getVal('argTocDepth');
    if (tocDepth) pandocArgs.push('--toc-depth=' + tocDepth);
    
    const shiftHeading = getVal('argShiftHeading');
    if (shiftHeading) pandocArgs.push('--shift-heading-level-by=' + shiftHeading);
    
    const topLevelDiv = getVal('argTopLevelDiv');
    if (topLevelDiv) pandocArgs.push('--top-level-division=' + topLevelDiv);
    
    const highlightStyle = getVal('argHighlightStyle');
    if (highlightStyle) pandocArgs.push('--highlight-style=' + highlightStyle);
    
    const wrap = getVal('argWrap');
    if (wrap) pandocArgs.push('--wrap=' + wrap);
    
    const columns = getVal('argColumns');
    if (columns) pandocArgs.push('--columns=' + columns);
    
    const tabStop = getVal('argTabStop');
    if (tabStop) pandocArgs.push('--tab-stop=' + tabStop);
    
    // 自定义参数
    const customArgs = getVal('cfgCustomArgs');
    if (customArgs) {
        customArgs.split(/\s+/).forEach(function(arg) {
            if (arg && !pandocArgs.includes(arg)) pandocArgs.push(arg);
        });
    }
    
    // 收集 PDF 选项
    const pdfOptions = {
        mainfont: getVal('pdfMainFont'),
        monofont: getVal('pdfMonoFont'),
        fontsize: getVal('pdfFontSize'),
        linestretch: getVal('pdfLineStretch') ? parseFloat(getVal('pdfLineStretch')) : null,
        titlepage: isChecked('pdfTitlePage'),
        'titlepage-color': getColor('pdfTitleBgColor'),
        'titlepage-text-color': getColor('pdfTitleTextColor'),
        'titlepage-rule-color': getColor('pdfTitleRuleColor'),
        geometry: getVal('pdfGeometry'),
        papersize: getVal('pdfPaperSize'),
        'toc-own-page': isChecked('pdfTocOwnPage'),
        colorlinks: isChecked('pdfColorLinks'),
        linkcolor: getColor('pdfLinkColor'),
        urlcolor: getColor('pdfUrlColor'),
        listings: isChecked('pdfListings'),
        'listings-no-page-break': isChecked('pdfListingsNoBreak'),
        'code-block-font-size': getVal('pdfCodeFontSize'),
        'header-left': getVal('pdfHeaderLeft'),
        'header-right': getVal('pdfHeaderRight')
    };
    
    // 清理空值
    Object.keys(pdfOptions).forEach(key => {
        if (pdfOptions[key] === '' || pdfOptions[key] === null) {
            delete pdfOptions[key];
        }
    });
    
    // 验证
    if (!clientName) {
        alert('请输入客户名称');
        return;
    }
    if (!docTypeName) {
        alert('请输入文档类型名称');
        return;
    }
    if (selectedModules.length === 0) {
        alert('请至少选择一个文档模块');
        return;
    }
    
    // 验证变量
    const varErrors = validateVariables();
    if (varErrors.length > 0) {
        alert('变量验证失败:\n' + varErrors.join('\n'));
        return;
    }
    
    // 获取变量值
    const variables = getVariableValues();
    
    const configData = {
        clientName: clientName,
        docTypeName: docTypeName,
        displayName: clientName,
        template: template,
        modules: selectedModules,
        pandocArgs: pandocArgs,
        outputPattern: outputPattern || '{client}_' + docTypeName + '_{date}.docx',
        pdfOptions: pdfOptions,
        variables: variables
    };
    
    const submitBtn = document.querySelector('.modal-footer .btn-primary');
    setLoading(submitBtn, true);
    
    try {
        let url = '/api/configs';
        let method = 'POST';
        
        if (currentEditConfig) {
            url = '/api/configs/' + encodeURIComponent(clientName) + '/' + encodeURIComponent(docTypeName);
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        alert(currentEditConfig ? '配置更新成功' : '配置创建成功');
        hideConfigModal();
        
        // 保存新建的客户名称（用于后续自动选中）
        const isNewConfig = !currentEditConfig;
        const newClientName = clientName;
        
        // 刷新客户列表，并在完成后自动选中新建的客户
        await loadClients();
        
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect) {
            if (isNewConfig) {
                // 新建配置：自动选中新创建的客户
                clientSelect.value = newClientName;
                await onClientChange();
            } else if (clientSelect.value === clientName) {
                // 编辑配置：如果当前选中的是这个客户，刷新文档列表
                await onClientChange();
            }
        }
    } catch (e) {
        alert('保存失败: ' + e.message);
    } finally {
        setLoading(submitBtn, false);
    }
}

// 编辑配置
async function editConfig(clientName, docTypeName) {
    try {
        const url = '/api/configs/' + encodeURIComponent(clientName) + '/' + encodeURIComponent(docTypeName);
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        currentEditConfig = data.data.config;
        showConfigModal(true);
    } catch (e) {
        alert('加载配置失败: ' + e.message);
    }
}

// 确认删除配置
function confirmDeleteConfig(clientName, docTypeName) {
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    if (!modal) return;
    
    message.textContent = '确定要删除配置 "' + docTypeName + '" 吗？此操作不可恢复。';
    confirmBtn.onclick = function() { deleteConfig(clientName, docTypeName); };
    
    modal.style.display = 'flex';
}

// 隐藏确认对话框
function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
}

// 删除配置
async function deleteConfig(clientName, docTypeName) {
    try {
        const url = '/api/configs/' + encodeURIComponent(clientName) + '/' + encodeURIComponent(docTypeName);
        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        hideConfirmModal();
        alert('配置删除成功');
        loadClients(); // 刷新客户列表
        
        // 刷新文档列表
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect && clientSelect.value === clientName) {
            onClientChange();
        }
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

// 暴露函数到全局作用域（供 HTML onclick 调用）
window.showConfigModal = showConfigModal;
window.hideConfigModal = hideConfigModal;
window.hideConfirmModal = hideConfirmModal;
window.submitConfig = submitConfig;
window.selectAllModules = selectAllModules;
window.clearAllModules = clearAllModules;
window.moveSelectedToRight = moveSelectedToRight;
window.moveSelectedToLeft = moveSelectedToLeft;


// ==================== 变量模板功能 ====================

let currentVariables = []; // 当前模块的变量声明
let variableValues = {}; // 用户填写的变量值

// 加载变量声明
async function loadVariables(modules) {
    if (!modules || modules.length === 0) {
        currentVariables = [];
        renderVariableForm();
        return;
    }
    
    try {
        const response = await fetch('/api/variables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules: modules })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        currentVariables = data.data.variables || [];
        
        // 显示冲突错误
        if (data.data.errors && data.data.errors.length > 0) {
            console.warn('变量冲突:', data.data.errors);
        }
        
        renderVariableForm();
    } catch (e) {
        console.error('加载变量失败:', e);
        currentVariables = [];
        renderVariableForm();
    }
}

// 渲染变量表单
function renderVariableForm() {
    const container = document.getElementById('variableForm');
    if (!container) return;
    
    if (currentVariables.length === 0) {
        container.innerHTML = '<div class="list-empty">所选模块没有定义变量</div>';
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    container.innerHTML = '';
    
    // 标题
    const title = document.createElement('h4');
    title.textContent = '📝 变量设置';
    title.style.marginBottom = '12px';
    container.appendChild(title);
    
    // 变量列表
    currentVariables.forEach(function(varDecl) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        // 标签
        const label = document.createElement('label');
        label.htmlFor = 'var_' + varDecl.name;
        label.textContent = varDecl.description || varDecl.name;
        if (varDecl.required) {
            const required = document.createElement('span');
            required.className = 'required';
            required.textContent = ' *';
            required.style.color = '#e74c3c';
            label.appendChild(required);
        }
        group.appendChild(label);
        
        // 输入控件
        let input;
        switch (varDecl.type) {
            case 'select':
                input = createSelectInput(varDecl);
                break;
            case 'number':
                input = createNumberInput(varDecl);
                break;
            case 'date':
                input = createDateInput(varDecl);
                break;
            default:
                input = createTextInput(varDecl);
        }
        
        input.id = 'var_' + varDecl.name;
        input.name = varDecl.name;
        input.addEventListener('change', function() {
            onVariableChange(varDecl.name, this.value);
        });
        input.addEventListener('input', function() {
            onVariableChange(varDecl.name, this.value);
        });
        
        group.appendChild(input);
        
        // 帮助文本
        if (varDecl.description && varDecl.description !== varDecl.name) {
            const help = document.createElement('small');
            help.className = 'form-help';
            help.textContent = getVariableHelp(varDecl);
            help.style.color = '#7f8c8d';
            help.style.fontSize = '12px';
            group.appendChild(help);
        }
        
        container.appendChild(group);
    });
}

// 创建文本输入
function createTextInput(varDecl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    if (varDecl.default !== undefined && varDecl.default !== null) {
        input.value = String(varDecl.default);
        variableValues[varDecl.name] = varDecl.default;
    }
    if (varDecl.pattern) {
        input.pattern = varDecl.pattern;
    }
    return input;
}

// 创建数字输入
function createNumberInput(varDecl) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'form-control';
    if (varDecl.default !== undefined && varDecl.default !== null) {
        input.value = varDecl.default;
        variableValues[varDecl.name] = varDecl.default;
    }
    if (varDecl.min !== undefined && varDecl.min !== null) {
        input.min = varDecl.min;
    }
    if (varDecl.max !== undefined && varDecl.max !== null) {
        input.max = varDecl.max;
    }
    return input;
}

// 创建日期输入
function createDateInput(varDecl) {
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'form-control';
    if (varDecl.default !== undefined && varDecl.default !== null) {
        input.value = varDecl.default;
        variableValues[varDecl.name] = varDecl.default;
    }
    return input;
}

// 创建选择输入
function createSelectInput(varDecl) {
    const select = document.createElement('select');
    select.className = 'form-control';
    
    // 空选项
    if (!varDecl.required) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '请选择...';
        select.appendChild(emptyOpt);
    }
    
    // 选项
    (varDecl.options || []).forEach(function(opt) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (varDecl.default === opt) {
            option.selected = true;
            variableValues[varDecl.name] = opt;
        }
        select.appendChild(option);
    });
    
    return select;
}

// 获取变量帮助文本
function getVariableHelp(varDecl) {
    const parts = [];
    if (varDecl.type === 'number') {
        if (varDecl.min !== undefined && varDecl.max !== undefined) {
            parts.push('范围: ' + varDecl.min + ' - ' + varDecl.max);
        } else if (varDecl.min !== undefined) {
            parts.push('最小值: ' + varDecl.min);
        } else if (varDecl.max !== undefined) {
            parts.push('最大值: ' + varDecl.max);
        }
    }
    if (varDecl.type === 'date') {
        parts.push('格式: YYYY-MM-DD');
    }
    if (varDecl.pattern) {
        parts.push('格式: ' + varDecl.pattern);
    }
    return parts.join(' | ');
}

// 变量值变化
function onVariableChange(name, value) {
    if (value === '' || value === undefined) {
        delete variableValues[name];
    } else {
        variableValues[name] = value;
    }
}

// 验证变量
function validateVariables() {
    const errors = [];
    
    currentVariables.forEach(function(varDecl) {
        const value = variableValues[varDecl.name];
        
        // 必填检查
        if (varDecl.required && (value === undefined || value === '')) {
            errors.push(varDecl.description || varDecl.name + ' 是必填项');
            return;
        }
        
        if (value === undefined || value === '') return;
        
        // 类型验证
        switch (varDecl.type) {
            case 'number':
                const num = parseFloat(value);
                if (isNaN(num)) {
                    errors.push((varDecl.description || varDecl.name) + ' 必须是数字');
                } else {
                    if (varDecl.min !== undefined && num < varDecl.min) {
                        errors.push((varDecl.description || varDecl.name) + ' 不能小于 ' + varDecl.min);
                    }
                    if (varDecl.max !== undefined && num > varDecl.max) {
                        errors.push((varDecl.description || varDecl.name) + ' 不能大于 ' + varDecl.max);
                    }
                }
                break;
            case 'date':
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    errors.push((varDecl.description || varDecl.name) + ' 格式不正确 (YYYY-MM-DD)');
                }
                break;
            case 'select':
                if (varDecl.options && !varDecl.options.includes(value)) {
                    errors.push((varDecl.description || varDecl.name) + ' 值不在允许的选项中');
                }
                break;
            case 'text':
                if (varDecl.pattern) {
                    try {
                        const re = new RegExp(varDecl.pattern);
                        if (!re.test(value)) {
                            errors.push((varDecl.description || varDecl.name) + ' 格式不正确');
                        }
                    } catch (e) {
                        // 忽略无效的正则
                    }
                }
                break;
        }
    });
    
    return errors;
}

// 获取变量值（用于提交）
function getVariableValues() {
    return { ...variableValues };
}

// 清空变量值
function clearVariableValues() {
    variableValues = {};
    currentVariables = [];
    renderVariableForm();
}

// 监听模块选择变化，自动加载变量
function onModulesChanged() {
    loadVariables(selectedModules);
}

// 暴露函数到全局作用域
window.loadVariables = loadVariables;
window.validateVariables = validateVariables;
window.getVariableValues = getVariableValues;
window.clearVariableValues = clearVariableValues;
window.onModulesChanged = onModulesChanged;
