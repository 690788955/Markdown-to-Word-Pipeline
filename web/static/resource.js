// 资源管理功能 - 前端逻辑
// 提供字体和模板文件的管理功能：列表、上传、删除、下载

let resourcePanelOpen = false;
let currentResourceTab = 'fonts';
let cachedFontsList = [];
let cachedTemplatesList = [];

const RESOURCE_DEBUG = false;
function logResource(...args) {
    if (RESOURCE_DEBUG) {
        console.log('[资源]', ...args);
    }
}

// ==================== 面板控制 ====================

// 初始化资源管理面板
function initResourcePanel() {
    logResource('初始化资源管理面板');

    // 绑定事件
    const toggleBtn = document.getElementById('resourceToggleBtn');
    const closeBtn = document.getElementById('resourceSideCloseBtn');
    const overlay = document.getElementById('resourcePanelOverlay');

    if (toggleBtn) toggleBtn.addEventListener('click', toggleResourcePanel);
    if (closeBtn) closeBtn.addEventListener('click', toggleResourcePanel);
    if (overlay) overlay.addEventListener('click', toggleResourcePanel);

    // Tab 切换事件
    const tabButtons = document.querySelectorAll('.resource-tab-btn');
    logResource('找到', tabButtons.length, '个 Tab 按钮');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            switchResourceTab(this.dataset.tab);
        });
    });
}

// 切换资源管理侧边面板
function toggleResourcePanel() {
    const panel = document.getElementById('resourceSidePanel');
    const overlay = document.getElementById('resourcePanelOverlay');

    if (!panel || !overlay) return;

    resourcePanelOpen = !resourcePanelOpen;

    if (resourcePanelOpen) {
        panel.classList.add('show');
        overlay.classList.add('show');
        loadCurrentTabData();
    } else {
        panel.classList.remove('show');
        overlay.classList.remove('show');
    }
}

// 打开资源管理面板
function openResourcePanel() {
    if (!resourcePanelOpen) {
        toggleResourcePanel();
    }
}

// 关闭资源管理面板
function closeResourcePanel() {
    if (resourcePanelOpen) {
        toggleResourcePanel();
    }
}

// 切换 Tab
function switchResourceTab(tab) {
    logResource('切换标签到:', tab);
    currentResourceTab = tab;

    // 更新 Tab 按钮状态
    document.querySelectorAll('.resource-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
    });

    // 更新 Tab 内容
    const expectedId = `${tab}Tab`;
    document.querySelectorAll('.resource-tab-content').forEach(content => {
        const isActive = content.id === expectedId;
        content.classList.toggle('active', isActive);
    });

    // 加载数据
    loadCurrentTabData();
}

// 加载当前 Tab 数据
function loadCurrentTabData() {
    if (currentResourceTab === 'fonts') {
        loadFonts();
    } else if (currentResourceTab === 'templates') {
        if (typeof loadResourceTemplates === 'function') {
            loadResourceTemplates();
        } else {
            console.error('[资源] loadResourceTemplates 不是函数!');
        }
    } else {
        logResource('未知标签:', currentResourceTab);
    }
}

// 显示加载状态
function showResourceLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="resource-loading">加载中...</div>';
    }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
    if (typeof AbortController === 'undefined') {
        const response = await fetch(url, options);
        const data = await response.json();
        return { response, data };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const data = await response.json();
        return { response, data };
    } finally {
        clearTimeout(timer);
    }
}

async function loadResourceList({
    endpoint,
    containerId,
    assignCache,
    renderList,
    errorLabel
}) {
    showResourceLoading(containerId);
    try {
        const { response, data } = await fetchJsonWithTimeout(endpoint);
        logResource('API 响应状态:', response.status);
        if (data.success) {
            assignCache(data.data || {});
            renderList();
        } else {
            showResourceError(containerId, `加载${errorLabel}列表失败: ${data.error}`);
        }
    } catch (e) {
        showResourceError(containerId, `加载失败: ${e.message}`);
    }
}

// ==================== 字体管理 ====================

// 加载字体列表
async function loadFonts() {
    await loadResourceList({
        endpoint: '/api/resources/fonts',
        containerId: 'fontsList',
        assignCache: (data) => {
            cachedFontsList = data.fonts || [];
        },
        renderList: renderFontList,
        errorLabel: '字体'
    });
}

// 渲染字体列表
function renderFontList() {
    const container = document.getElementById('fontsList');
    if (!container) {
        console.error('[资源] 找不到 fontsList 容器!');
        return;
    }

    if (cachedFontsList.length === 0) {
        container.innerHTML = `
            <div class="resource-empty">
                <div class="resource-empty-icon">🔤</div>
                <div class="resource-empty-text">暂无字体文件</div>
                <div class="resource-empty-hint">上传 .ttf, .otf, .woff, .woff2 格式的字体</div>
            </div>
        `;
        return;
    }

    let html = '';
    cachedFontsList.forEach(font => {
        html += `
            <div class="resource-item">
                <div class="resource-item-icon">🔤</div>
                <div class="resource-item-info">
                    <div class="resource-item-name" title="${escapeHtml(font.name)}">${escapeHtml(font.name)}</div>
                    <div class="resource-item-meta">
                        <span>${font.sizeDisplay || formatFileSize(font.size)}</span>
                        <span>•</span>
                        <span>${formatDateTime(font.modTime)}</span>
                    </div>
                </div>
                <div class="resource-item-actions">
                    <button class="resource-btn resource-btn-danger" onclick="deleteFont('${escapeHtml(font.name)}')" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 上传字体
async function uploadFont() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.woff,.woff2';
    input.multiple = true;

    input.onchange = async function () {
        const files = input.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            await uploadSingleFont(file);
        }

        loadFonts();
    };

    input.click();
}

// 上传单个字体文件
async function uploadSingleFont(file) {
    // 验证扩展名
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
        showErrorToast(`不支持的字体格式: ${file.name}`);
        return;
    }

    // 验证大小 (50MB)
    if (file.size > 50 * 1024 * 1024) {
        showErrorToast(`文件过大: ${file.name} (最大 50MB)`);
        return;
    }

    // 检查是否存在同名文件
    const exists = cachedFontsList.some(f => f.name === file.name);
    if (exists) {
        const confirmed = await showOverwriteConfirm(file.name, 'font');
        if (!confirmed) return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/resources/fonts', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showSuccessToast(`字体上传成功: ${file.name}`);
        } else {
            showErrorToast(`上传失败: ${data.error}`);
        }
    } catch (e) {
        showErrorToast(`上传失败: ${e.message}`);
    }
}

// 删除字体
async function deleteFont(name) {
    if (!confirm(`确定要删除字体 "${name}" 吗？`)) {
        return;
    }

    try {
        const response = await fetch(`/api/resources/fonts/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccessToast(`字体已删除: ${name}`);
            loadFonts();
        } else {
            showErrorToast(`删除失败: ${data.error}`);
        }
    } catch (e) {
        showErrorToast(`删除失败: ${e.message}`);
    }
}


// ==================== 模板管理 ====================

// 加载模板列表
async function loadResourceTemplates() {
    await loadResourceList({
        endpoint: '/api/resources/templates',
        containerId: 'templatesList',
        assignCache: (data) => {
            cachedTemplatesList = data.templates || [];
        },
        renderList: renderTemplateList,
        errorLabel: '模板'
    });
}

// 渲染模板列表
// 渲染模板列表
function renderTemplateList() {
    const container = document.getElementById('templatesList');
    if (!container) {
        console.error('[资源] 找不到 templatesList 容器!');
        return;
    }

    if (cachedTemplatesList.length === 0) {
        container.innerHTML = `
            <div class="resource-empty">
                <div class="resource-empty-icon">📄</div>
                <div class="resource-empty-text">暂无模板文件</div>
                <div class="resource-empty-hint">上传 .docx 格式的 Word 模板</div>
            </div>
        `;
        return;
    }

    let html = '';
    cachedTemplatesList.forEach(template => {
        const isDefault = template.name === 'default.docx';
        html += `
            <div class="resource-item ${isDefault ? 'resource-item-default' : ''}">
                <div class="resource-item-icon">📄</div>
                <div class="resource-item-info">
                    <div class="resource-item-name" title="${escapeHtml(template.name)}">
                        ${escapeHtml(template.name)}
                        ${isDefault ? '<span class="resource-badge">默认</span>' : ''}
                    </div>
                    <div class="resource-item-meta">
                        <span>${template.sizeDisplay || formatFileSize(template.size)}</span>
                        <span>•</span>
                        <span>${formatDateTime(template.modTime)}</span>
                    </div>
                </div>
                <div class="resource-item-actions">
                    <button class="resource-btn" onclick="downloadTemplate('${escapeHtml(template.name)}')" title="下载">
                        ⬇️
                    </button>
                    <button class="resource-btn resource-btn-danger" onclick="deleteTemplate('${escapeHtml(template.name)}')" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 上传模板
async function uploadTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.multiple = true;

    input.onchange = async function () {
        const files = input.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            await uploadSingleTemplate(file);
        }

        loadResourceTemplates();
    };

    input.click();
}

// 上传单个模板文件
async function uploadSingleTemplate(file) {
    // 验证扩展名
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx') {
        showErrorToast(`不支持的模板格式: ${file.name}，仅支持 .docx`);
        return;
    }

    // 验证大小 (20MB)
    if (file.size > 20 * 1024 * 1024) {
        showErrorToast(`文件过大: ${file.name} (最大 20MB)`);
        return;
    }

    // 检查是否存在同名文件
    const exists = cachedTemplatesList.some(t => t.name === file.name);
    if (exists) {
        const confirmed = await showOverwriteConfirm(file.name, 'template');
        if (!confirmed) return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/resources/templates', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showSuccessToast(`模板上传成功: ${file.name}`);
        } else {
            showErrorToast(`上传失败: ${data.error}`);
        }
    } catch (e) {
        showErrorToast(`上传失败: ${e.message}`);
    }
}

// 删除模板
async function deleteTemplate(name) {
    // 先检查模板使用情况
    try {
        const response = await fetch(`/api/resources/templates/${encodeURIComponent(name)}/usage`);
        const data = await response.json();

        if (data.success && data.data.usedBy && data.data.usedBy.length > 0) {
            const usedByList = data.data.usedBy.join('\n• ');
            const confirmed = confirm(
                `模板 "${name}" 正在被以下配置使用：\n\n• ${usedByList}\n\n删除后这些配置将使用默认模板。确定要删除吗？`
            );
            if (!confirmed) return;
        } else {
            if (!confirm(`确定要删除模板 "${name}" 吗？`)) {
                return;
            }
        }
    } catch (e) {
        // 如果检查失败，仍然允许删除
        if (!confirm(`确定要删除模板 "${name}" 吗？`)) {
            return;
        }
    }

    try {
        const response = await fetch(`/api/resources/templates/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccessToast(`模板已删除: ${name}`);
            loadResourceTemplates();
        } else {
            showErrorToast(`删除失败: ${data.error}`);
        }
    } catch (e) {
        showErrorToast(`删除失败: ${e.message}`);
    }
}

// 下载模板
function downloadTemplate(name) {
    window.location.href = `/api/resources/templates/${encodeURIComponent(name)}/download`;
}

// ==================== 工具函数 ====================

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期时间
function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示覆盖确认对话框
function showOverwriteConfirm(fileName, type) {
    return new Promise((resolve) => {
        const typeText = type === 'font' ? '字体' : '模板';
        const confirmed = confirm(`${typeText}文件 "${fileName}" 已存在，是否覆盖？`);
        resolve(confirmed);
    });
}

// 显示成功提示
function showSuccessToast(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'success');
    } else {
        console.log('[成功]', message);
    }
}

// 显示错误提示
function showErrorToast(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    } else {
        console.error('[错误]', message);
        alert(message);
    }
}

// 显示错误状态
function showResourceError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="resource-error">${escapeHtml(message)}</div>`;
    }
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function () {
    initResourcePanel();
});
