// 运维文档生成系统 - 前端交互逻辑

// DOM 元素
const clientSelect = document.getElementById('clientSelect');
const clientNameInput = document.getElementById('clientNameInput');
const docTypeList = document.getElementById('docTypeList');
const generateBtn = document.getElementById('generateBtn');
const refreshClients = document.getElementById('refreshClients');
const selectAll = document.getElementById('selectAll');
const selectNone = document.getElementById('selectNone');
const result = document.getElementById('result');
const resultSuccess = document.getElementById('resultSuccess');
const resultError = document.getElementById('resultError');
const downloadLinks = document.getElementById('downloadLinks');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

// 状态
let clients = [];
let documentTypes = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    bindEvents();
});

// 绑定事件
function bindEvents() {
    clientSelect.addEventListener('change', onClientChange);
    generateBtn.addEventListener('click', onGenerate);
    refreshClients.addEventListener('click', loadClients);
    retryBtn.addEventListener('click', onGenerate);
    selectAll.addEventListener('click', () => toggleAllCheckboxes(true));
    selectNone.addEventListener('click', () => toggleAllCheckboxes(false));
}

// 加载客户列表
async function loadClients() {
    try {
        clientSelect.disabled = true;
        clientSelect.innerHTML = '<option value="">加载中...</option>';
        resetDocTypeList();
        hideResult();

        const response = await fetch('/api/clients');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '加载失败');
        }

        clients = data.data.clients || [];
        
        clientSelect.innerHTML = '<option value="">请选择客户配置</option>';
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.name;
            option.textContent = client.displayName || client.name;
            clientSelect.appendChild(option);
        });

        clientSelect.disabled = false;
    } catch (error) {
        clientSelect.innerHTML = '<option value="">加载失败，请刷新</option>';
        console.error('加载客户列表失败:', error);
    }
}

// 客户选择变化
async function onClientChange() {
    const clientName = clientSelect.value;
    
    resetDocTypeList();
    generateBtn.disabled = true;
    hideResult();

    if (!clientName) {
        return;
    }

    try {
        docTypeList.innerHTML = '<p class="placeholder">加载中...</p>';
        
        const response = await fetch(`/api/clients/${encodeURIComponent(clientName)}/docs`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '加载失败');
        }

        documentTypes = data.data.documentTypes || [];
        renderDocTypeList();
    } catch (error) {
        docTypeList.innerHTML = '<p class="placeholder">加载失败</p>';
        console.error('加载文档类型失败:', error);
    }
}

// 渲染文档类型列表
function renderDocTypeList() {
    if (documentTypes.length === 0) {
        docTypeList.innerHTML = '<p class="placeholder">该客户没有可用的文档类型</p>';
        selectAll.style.display = 'none';
        selectNone.style.display = 'none';
        return;
    }

    docTypeList.innerHTML = '';
    documentTypes.forEach(docType => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `doc-${docType.name}`;
        checkbox.value = docType.name;
        checkbox.addEventListener('change', updateGenerateButton);
        
        const label = document.createElement('label');
        label.htmlFor = `doc-${docType.name}`;
        label.textContent = docType.displayName || docType.name;
        
        if (docType.isDefault) {
            const badge = document.createElement('span');
            badge.className = 'doc-default';
            badge.textContent = '(默认)';
            label.appendChild(badge);
        }
        
        item.appendChild(checkbox);
        item.appendChild(label);
        docTypeList.appendChild(item);
    });

    selectAll.style.display = 'inline';
    selectNone.style.display = 'inline';
}

// 重置文档类型列表
function resetDocTypeList() {
    docTypeList.innerHTML = '<p class="placeholder">请先选择客户配置</p>';
    selectAll.style.display = 'none';
    selectNone.style.display = 'none';
    documentTypes = [];
}

// 切换所有复选框
function toggleAllCheckboxes(checked) {
    const checkboxes = docTypeList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checked);
    updateGenerateButton();
}

// 更新生成按钮状态
function updateGenerateButton() {
    const checkboxes = docTypeList.querySelectorAll('input[type="checkbox"]:checked');
    generateBtn.disabled = checkboxes.length === 0;
}

// 获取选中的文档类型
function getSelectedDocTypes() {
    const checkboxes = docTypeList.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 生成文档
async function onGenerate() {
    const clientConfig = clientSelect.value;
    const selectedDocs = getSelectedDocTypes();
    const customClientName = clientNameInput.value.trim();

    if (!clientConfig || selectedDocs.length === 0) {
        return;
    }

    setLoading(generateBtn, true);
    hideResult();

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientConfig: clientConfig,
                documentTypes: selectedDocs,
                clientName: customClientName || '',
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '生成失败');
        }

        // 显示成功结果和下载链接
        showSuccess(data.data.files || []);
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(generateBtn, false);
    }
}

// 设置按钮加载状态
function setLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    button.disabled = loading;
    if (btnText) btnText.style.display = loading ? 'none' : 'inline';
    if (btnLoading) btnLoading.style.display = loading ? 'inline-flex' : 'none';
}

// 显示成功结果
function showSuccess(files) {
    result.style.display = 'block';
    resultSuccess.style.display = 'block';
    resultError.style.display = 'none';
    
    downloadLinks.innerHTML = '';
    files.forEach(file => {
        const link = document.createElement('a');
        link.href = file.downloadUrl;
        link.className = 'btn btn-success';
        link.download = file.fileName;
        link.textContent = '📥 ' + file.fileName;
        downloadLinks.appendChild(link);
    });
}

// 显示错误结果
function showError(message) {
    result.style.display = 'block';
    resultSuccess.style.display = 'none';
    resultError.style.display = 'block';
    errorMessage.textContent = message;
}

// 隐藏结果
function hideResult() {
    result.style.display = 'none';
    resultSuccess.style.display = 'none';
    resultError.style.display = 'none';
}
