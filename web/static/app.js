// 运维文档生成系统 - 前端逻辑 v6
// 支持 Word 和 PDF 格式输出，支持自定义配置

let documentTypes = [];
let generatedFiles = [];
let availableModules = [];
let availableTemplates = [];
let selectedModules = [];
let currentEditConfig = null; // 当前编辑的配置
let currentClient = null; // 当前选中的客户信息

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
});

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
        
        // 分组：预置配置和自定义配置
        const presetClients = clients.filter(c => !c.isCustom);
        const customClients = clients.filter(c => c.isCustom);
        
        if (presetClients.length > 0) {
            const presetGroup = document.createElement('optgroup');
            presetGroup.label = '预置配置';
            presetClients.forEach(function(c) {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.displayName || c.name;
                opt.dataset.isCustom = 'false';
                presetGroup.appendChild(opt);
            });
            clientSelect.appendChild(presetGroup);
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
    
    // 加载模块和模板列表
    await Promise.all([loadModules(), loadTemplates()]);
    
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
        renderModuleList();
    } catch (e) {
        console.error('加载模块列表失败:', e);
        availableModules = [];
    }
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
        templateSelect.innerHTML = '<option value="">使用默认模板</option>';
        availableTemplates.forEach(function(t) {
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

// 渲染模块列表
function renderModuleList() {
    const moduleList = document.getElementById('moduleList');
    if (!moduleList) return;
    
    if (availableModules.length === 0) {
        moduleList.innerHTML = '<div class="list-empty">没有可用的模块</div>';
        return;
    }
    
    moduleList.innerHTML = '';
    
    // 如果有已选模块，按顺序显示
    const orderedModules = [];
    selectedModules.forEach(function(path) {
        const mod = availableModules.find(m => 'src/' + m.fileName === path || m.fileName === path);
        if (mod) orderedModules.push({ ...mod, selected: true });
    });
    
    // 添加未选中的模块
    availableModules.forEach(function(mod) {
        const path = 'src/' + mod.fileName;
        if (!selectedModules.includes(path) && !selectedModules.includes(mod.fileName)) {
            orderedModules.push({ ...mod, selected: false });
        }
    });
    
    orderedModules.forEach(function(mod, index) {
        const item = document.createElement('div');
        item.className = 'module-item' + (mod.selected ? ' selected' : '');
        item.draggable = true;
        item.dataset.fileName = mod.fileName;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = mod.selected;
        checkbox.onchange = function() { toggleModule(mod.fileName, this.checked); };
        
        const label = document.createElement('span');
        label.className = 'module-label';
        label.textContent = mod.displayName || mod.fileName;
        
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⋮⋮';
        
        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(handle);
        
        // 拖拽事件
        item.ondragstart = function(e) { onDragStart(e, index); };
        item.ondragover = function(e) { onDragOver(e); };
        item.ondrop = function(e) { onDrop(e, index); };
        item.ondragend = function(e) { onDragEnd(e); };
        
        moduleList.appendChild(item);
    });
}

// 切换模块选中状态
function toggleModule(fileName, checked) {
    const path = 'src/' + fileName;
    if (checked) {
        if (!selectedModules.includes(path)) {
            selectedModules.push(path);
        }
    } else {
        selectedModules = selectedModules.filter(m => m !== path && m !== fileName);
    }
    renderModuleList();
}

// 拖拽相关
let draggedIndex = null;

function onDragStart(e, index) {
    draggedIndex = index;
    e.target.classList.add('dragging');
}

function onDragOver(e) {
    e.preventDefault();
}

function onDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    // 重新排序已选模块
    const moduleList = document.getElementById('moduleList');
    const items = moduleList.querySelectorAll('.module-item');
    const newOrder = [];
    
    items.forEach(function(item) {
        if (item.querySelector('input').checked) {
            newOrder.push('src/' + item.dataset.fileName);
        }
    });
    
    // 移动元素
    if (draggedIndex < targetIndex) {
        newOrder.splice(targetIndex + 1, 0, newOrder[draggedIndex]);
        newOrder.splice(draggedIndex, 1);
    } else {
        const item = newOrder.splice(draggedIndex, 1)[0];
        newOrder.splice(targetIndex, 0, item);
    }
    
    selectedModules = newOrder.filter(m => selectedModules.includes(m) || selectedModules.includes(m.replace('src/', '')));
    renderModuleList();
}

function onDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedIndex = null;
}

// 重置配置表单
function resetConfigForm() {
    document.getElementById('cfgClientName').value = '';
    document.getElementById('cfgDocTypeName').value = '';
    document.getElementById('cfgTemplate').value = '';
    document.getElementById('cfgOutputPattern').value = '';
    document.getElementById('argToc').checked = true;
    document.getElementById('argNumberSections').checked = true;
    document.getElementById('argStandalone').checked = true;
    document.getElementById('cfgCustomArgs').value = '';
    selectedModules = [];
    renderModuleList();
}

// 填充配置表单（编辑模式）
function fillConfigForm(config) {
    document.getElementById('cfgClientName').value = config.clientName || '';
    document.getElementById('cfgDocTypeName').value = config.docTypeName || '';
    document.getElementById('cfgTemplate').value = config.template || '';
    document.getElementById('cfgOutputPattern').value = config.outputPattern || '';
    
    // 解析 Pandoc 参数
    const args = config.pandocArgs || [];
    document.getElementById('argToc').checked = args.includes('--toc');
    document.getElementById('argNumberSections').checked = args.includes('--number-sections');
    document.getElementById('argStandalone').checked = args.includes('--standalone');
    
    // 其他参数
    const standardArgs = ['--toc', '--number-sections', '--standalone'];
    const customArgs = args.filter(a => !standardArgs.includes(a));
    document.getElementById('cfgCustomArgs').value = customArgs.join(' ');
    
    // 模块列表
    selectedModules = config.modules || [];
    renderModuleList();
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
    const clientName = document.getElementById('cfgClientName').value.trim();
    const docTypeName = document.getElementById('cfgDocTypeName').value.trim();
    const template = document.getElementById('cfgTemplate').value;
    const outputPattern = document.getElementById('cfgOutputPattern').value.trim();
    
    // 收集 Pandoc 参数
    const pandocArgs = [];
    if (document.getElementById('argToc').checked) pandocArgs.push('--toc');
    if (document.getElementById('argNumberSections').checked) pandocArgs.push('--number-sections');
    if (document.getElementById('argStandalone').checked) pandocArgs.push('--standalone');
    
    const customArgs = document.getElementById('cfgCustomArgs').value.trim();
    if (customArgs) {
        customArgs.split(/\s+/).forEach(function(arg) {
            if (arg && !pandocArgs.includes(arg)) pandocArgs.push(arg);
        });
    }
    
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
    
    const configData = {
        clientName: clientName,
        docTypeName: docTypeName,
        displayName: clientName,
        template: template,
        modules: selectedModules,
        pandocArgs: pandocArgs,
        outputPattern: outputPattern || '{client}_' + docTypeName + '_{date}.docx'
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
        loadClients(); // 刷新客户列表
        
        // 如果当前选中的是这个客户，刷新文档列表
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect && clientSelect.value === clientName) {
            onClientChange();
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