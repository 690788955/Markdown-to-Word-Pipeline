// 运维文档生成系统 - 前端逻辑 v2

let documentTypes = [];
let generatedFiles = [];

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
});

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
        clients.forEach(function(c) {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.displayName || c.name;
            clientSelect.appendChild(opt);
        });
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
    
    if (!client) return;
    
    setLoading(btn, true);
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientConfig: client,
                documentTypes: [docType],
                clientName: customName
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
                clientName: customName
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
            link.textContent = '📄 ' + file.fileName;
            
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
