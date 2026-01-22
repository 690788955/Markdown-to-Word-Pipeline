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
const themeState = {
    theme: 'light',
    accent: '#1a8fbf'
};

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initThemeControls();

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
    
    // 初始化模态框事件
    initModalEvents();
    
    // 初始化 Git 面板
    if (typeof initGitPanel === 'function') {
        initGitPanel();
    }
});

// ==================== 主题控制 ====================

function initTheme() {
    const savedTheme = localStorage.getItem('uiTheme');
    const savedAccent = localStorage.getItem('uiAccent');
    if (savedTheme) {
        themeState.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        themeState.theme = 'dark';
    }
    if (savedAccent) {
        themeState.accent = savedAccent;
    }
    applyTheme();
}

function initThemeControls() {
    // Utility Panel 控制
    const utilityToggleBtn = document.getElementById('utilityToggleBtn');
    const utilityPanel = document.getElementById('utilityPanel');
    const utilityOverlay = document.getElementById('utilityOverlay');
    const utilityCloseBtn = utilityPanel ? utilityPanel.querySelector('.utility-panel-close') : null;
    const utilityAccentInput = document.getElementById('utilityAccentInput');
    const utilityResourceBtn = document.getElementById('utilityResourceBtn');

    // 打开工具面板
    function openUtilityPanel() {
        if (utilityPanel) {
            utilityPanel.classList.add('is-open');
            utilityPanel.setAttribute('aria-hidden', 'false');
        }
        if (utilityOverlay) {
            utilityOverlay.classList.add('is-open');
        }
    }

    // 关闭工具面板
    function closeUtilityPanel() {
        if (utilityPanel) {
            utilityPanel.classList.remove('is-open');
            utilityPanel.setAttribute('aria-hidden', 'true');
        }
        if (utilityOverlay) {
            utilityOverlay.classList.remove('is-open');
        }
    }

    // 切换工具面板
    function toggleUtilityPanel() {
        if (utilityPanel && utilityPanel.classList.contains('is-open')) {
            closeUtilityPanel();
        } else {
            openUtilityPanel();
        }
    }

    // 绑定工具按钮点击事件
    if (utilityToggleBtn) {
        utilityToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUtilityPanel();
        });
    }

    // 绑定遮罩层点击关闭
    if (utilityOverlay) {
        utilityOverlay.addEventListener('click', closeUtilityPanel);
    }

    // 绑定关闭按钮点击
    if (utilityCloseBtn) {
        utilityCloseBtn.addEventListener('click', closeUtilityPanel);
    }

    // 绑定 Escape 键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && utilityPanel && utilityPanel.classList.contains('is-open')) {
            closeUtilityPanel();
        }
    });

    // 资源管理按钮
    if (utilityResourceBtn) {
        utilityResourceBtn.addEventListener('click', () => {
            closeUtilityPanel();
            if (typeof openResourcePanel === 'function') {
                openResourcePanel();
            } else if (typeof toggleResourcePanel === 'function') {
                toggleResourcePanel();
            }
        });
    }

    // 主题切换按钮
    document.querySelectorAll('[data-theme-option]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextTheme = btn.getAttribute('data-theme-option');
            if (!nextTheme) return;
            themeState.theme = nextTheme;
            localStorage.setItem('uiTheme', themeState.theme);
            applyTheme();
        });
    });

    // 强调色色板
    document.querySelectorAll('[data-accent]').forEach(btn => {
        btn.addEventListener('click', () => {
            const accent = btn.getAttribute('data-accent');
            if (!accent) return;
            setAccent(accent);
        });
    });

    // 强调色输入框
    if (utilityAccentInput) {
        utilityAccentInput.value = themeState.accent;
        utilityAccentInput.addEventListener('input', (e) => {
            setAccent(e.target.value);
        });
    }

    // 暴露函数到全局
    window.openUtilityPanel = openUtilityPanel;
    window.closeUtilityPanel = closeUtilityPanel;
    window.toggleUtilityPanel = toggleUtilityPanel;
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', themeState.theme);
    setAccent(themeState.accent, true);
    updateThemeControls();
}

function updateThemeControls() {
    document.querySelectorAll('[data-theme-option]').forEach(btn => {
        const option = btn.getAttribute('data-theme-option');
        btn.classList.toggle('active', option === themeState.theme);
    });
    const utilityAccentInput = document.getElementById('utilityAccentInput');
    if (utilityAccentInput) utilityAccentInput.value = themeState.accent;
}

function setAccent(color, skipPersist) {
    if (!color) return;
    themeState.accent = color;
    if (!skipPersist) {
        localStorage.setItem('uiAccent', color);
    }
    const root = document.documentElement;
    const hover = adjustLightness(color, themeState.theme === 'dark' ? 0.08 : -0.08);
    const soft = rgba(color, themeState.theme === 'dark' ? 0.22 : 0.12);
    const light = rgba(color, themeState.theme === 'dark' ? 0.28 : 0.16);
    const dark = adjustLightness(color, themeState.theme === 'dark' ? 0.18 : -0.18);
    const ring = rgba(color, themeState.theme === 'dark' ? 0.45 : 0.28);
    root.style.setProperty('--color-primary', color);
    root.style.setProperty('--color-primary-hover', hover);
    root.style.setProperty('--color-primary-soft', soft);
    root.style.setProperty('--color-primary-light', light);
    root.style.setProperty('--color-primary-dark', dark);
    root.style.setProperty('--color-ring', ring);
    updateThemeControls();
}

function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function adjustLightness(hex, delta) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = clamp(hsl.l + delta, 0, 1);
    return hslToHex(hsl.h, hsl.s, hsl.l);
}

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

function hexToRgb(hex) {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length !== 6) return null;
    const num = parseInt(normalized, 16);
    if (Number.isNaN(num)) return null;
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rn:
                h = (gn - bn) / d + (gn < bn ? 6 : 0);
                break;
            case gn:
                h = (bn - rn) / d + 2;
                break;
            default:
                h = (rn - gn) / d + 4;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToHex(h, s, l) {
    const hue2rgb = (p, q, t) => {
        let tVal = t;
        if (tVal < 0) tVal += 1;
        if (tVal > 1) tVal -= 1;
        if (tVal < 1 / 6) return p + (q - p) * 6 * tVal;
        if (tVal < 1 / 2) return q;
        if (tVal < 2 / 3) return p + (q - p) * (2 / 3 - tVal) * 6;
        return p;
    };

    let r;
    let g;
    let b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(val) {
    const hex = Math.round(val * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

// ==================== 模态框通用功能 ====================

// 初始化模态框事件（ESC 键关闭、背景点击关闭）
function initModalEvents() {
    // ESC 键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeTopModal();
        }
    });
    
    // 背景点击关闭模态框
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            // 只有点击背景（modal 本身）时才关闭，点击内容区域不关闭
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
}

// 打开模态框（通用）
function openModal(modal) {
    if (!modal) return;
    
    // 添加 active 类触发动画
    modal.classList.add('active');
    modal.classList.remove('closing');
    
    // 阻止背景滚动
    document.body.classList.add('modal-open');
}

// 关闭模态框（通用，带动画）
function closeModal(modal) {
    if (!modal || !modal.classList.contains('active')) return;
    
    // 添加关闭动画类
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    // 动画结束后隐藏
    setTimeout(function() {
        modal.classList.remove('closing');
        
        // 检查是否还有其他打开的模态框
        const openModals = document.querySelectorAll('.modal.active');
        if (openModals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    }, 250); // 与 CSS transition 时长一致
}

// 关闭最顶层的模态框
function closeTopModal() {
    const modals = document.querySelectorAll('.modal.active');
    if (modals.length > 0) {
        // 关闭最后一个（最顶层）
        closeModal(modals[modals.length - 1]);
    }
}

// ==================== Toast 通知功能 ====================

// 获取或创建 Toast 容器
function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// 显示 Toast 通知
function showToast(message, type = 'success', duration = 3000) {
    const container = getToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // 触发动画
    requestAnimationFrame(function() {
        toast.classList.add('show');
    });
    
    // 自动消失
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
    
    return toast;
}

// 暴露 Toast 函数到全局
window.showToast = showToast;

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

// 显示错误模态框
function showErrorModal(title, message) {
    // 检查是否已存在错误模态框
    let modal = document.getElementById('errorModal');
    if (!modal) {
        // 创建模态框
        modal = document.createElement('div');
        modal.id = 'errorModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 id="errorModalTitle">错误</h3>
                    <button type="button" class="modal-close" onclick="hideErrorModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="errorModalMessage" style="white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; background: #f8f9fa; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="hideErrorModal()">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 添加背景点击关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideErrorModal();
            }
        });
    }
    
    // 设置内容
    document.getElementById('errorModalTitle').textContent = title;
    document.getElementById('errorModalMessage').textContent = message;
    
    // 显示模态框
    openModal(modal);
}

// 隐藏错误模态框
function hideErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) closeModal(modal);
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
    const lockBtn = document.getElementById('lockBtn');
    
    const client = clientSelect ? clientSelect.value : '';
    
    // 获取当前客户信息
    currentClient = window.clientsData ? window.clientsData.find(c => c.name === client) : null;
    
    // 更新锁定按钮状态
    updateLockButton();
    
    // 清除预览缓存
    if (typeof clearPreviewCache === 'function') {
        clearPreviewCache();
    }
    
    if (generateAllBtn) generateAllBtn.disabled = true;
    hideResult();
    
    if (!client) {
        if (docList) docList.innerHTML = '<div class="list-empty">请先选择客户配置</div>';
        return;
    }
    
    if (docList) docList.innerHTML = '<div class="list-empty">加载中...</div>';
    
    try {
        // 加载带预览数据的文档类型列表
        const url = '/api/clients/' + encodeURIComponent(client) + '/docs?preview=true';
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

// 更新锁定按钮状态
function updateLockButton() {
    const lockBtn = document.getElementById('lockBtn');
    const lockIcon = document.getElementById('lockIcon');
    
    if (!lockBtn || !lockIcon) return;
    
    if (!currentClient) {
        lockBtn.style.display = 'none';
        return;
    }
    
    lockBtn.style.display = 'inline-flex';
    
    if (currentClient.locked) {
        lockIcon.textContent = '🔒';
        lockBtn.classList.add('locked');
        lockBtn.title = '点击解锁配置';
    } else {
        lockIcon.textContent = '🔓';
        lockBtn.classList.remove('locked');
        lockBtn.title = '点击锁定配置';
    }
}

// 切换客户锁定状态
async function toggleClientLock() {
    if (!currentClient) return;
    
    const isLocked = currentClient.locked;
    const action = isLocked ? '解锁' : '锁定';
    
    // 弹出密码输入框
    const password = prompt(`请输入管理密码以${action}客户配置 "${currentClient.displayName || currentClient.name}"：`);
    if (password === null) return; // 用户取消
    
    if (!password.trim()) {
        alert('密码不能为空');
        return;
    }
    
    try {
        const url = '/api/lock/' + encodeURIComponent(currentClient.name);
        const method = isLocked ? 'DELETE' : 'POST';
        
        const response = await fetch(url, { 
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error);
        
        // 更新本地状态
        currentClient.locked = !isLocked;
        
        // 更新 clientsData 中的状态
        if (window.clientsData) {
            const client = window.clientsData.find(c => c.name === currentClient.name);
            if (client) client.locked = currentClient.locked;
        }
        
        updateLockButton();
        renderDocList();
        
        alert(`客户配置已${action}`);
    } catch (e) {
        alert(`${action}失败: ` + e.message);
    }
}

// 渲染文档列表
function renderDocList() {
    const docList = document.getElementById('docList');
    if (!docList) return;
    
    if (documentTypes.length === 0) {
        docList.innerHTML = '<div class="list-empty list-empty-guide"><span class="list-empty-icon">📋</span><span class="list-empty-text">没有可用的文档类型</span><span class="list-empty-hint">请选择其他客户配置或新建配置</span></div>';
        return;
    }
    
    const isCustomClient = currentClient && currentClient.isCustom;
    const isLocked = currentClient && currentClient.locked;
    
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
        genBtn.className = 'btn btn-ghost btn-sm';
        genBtn.innerHTML = '<span class="btn-text">生成</span><span class="btn-loading" style="display:none;">生成中</span>';
        genBtn.onclick = function() { generateSingle(doc.name, genBtn); };
        actions.appendChild(genBtn);
        
        // 所有配置都显示编辑按钮（锁定时禁用）
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost btn-sm';
        editBtn.textContent = '编辑';
        if (isLocked) {
            editBtn.disabled = true;
            editBtn.title = '客户配置已锁定';
        } else {
            editBtn.onclick = function() { editConfig(currentClient.name, doc.name); };
        }
        actions.appendChild(editBtn);
        
        // 自定义配置显示删除按钮（锁定时禁用）
        if (isCustomClient) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-ghost btn-sm btn-danger-outline';
            delBtn.textContent = '删除';
            if (isLocked) {
                delBtn.disabled = true;
                delBtn.title = '客户配置已锁定';
            } else {
                delBtn.onclick = function() { confirmDeleteConfig(currentClient.name, doc.name); };
            }
            actions.appendChild(delBtn);
        }
        
        item.appendChild(name);
        item.appendChild(actions);
        docList.appendChild(item);
        
        // 添加悬停预览支持
        if (currentClient && typeof setupDocItemHover === 'function') {
            setupDocItemHover(item, currentClient.name, doc.name);
        }
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
        showErrorModal('生成失败', e.message);
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
        showErrorModal('生成失败', e.message);
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
    
    // 自动滚动到结果区域
    scrollToResult();
}

// 滚动到结果区域
function scrollToResult() {
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    
    openModal(modal);
    updateFilenamePreview();
}

// 隐藏配置模态框
function hideConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) closeModal(modal);
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
        
        // 默认全部折叠
        expandedDirs = new Set();
        
        renderTransferUI();
    } catch (e) {
        console.error('加载模块列表失败:', e);
        availableModules = [];
        moduleTree = { rootModules: [], directories: [] };
    }
}

// 渲染穿梭框 UI
function renderTransferUI() {
    console.log('[模块] renderTransferUI 被调用');
    renderAvailableModules();
    renderSelectedModules();
    updateSelectedCount();
    // 模块变化时加载变量
    console.log('[模块] 检查 onModulesChanged 函数:', typeof onModulesChanged);
    if (typeof onModulesChanged === 'function') {
        console.log('[模块] 调用 onModulesChanged');
        onModulesChanged();
    } else {
        console.warn('[模块] onModulesChanged 函数不存在!');
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
    
    // 渲染根目录模块（可折叠）
    const rootModules = moduleTree.rootModules.filter(mod => {
        if (selectedModules.includes(mod.path)) return false;
        if (query && !mod.displayName.toLowerCase().includes(query) && !mod.fileName.toLowerCase().includes(query)) return false;
        return true;
    });
    
    if (rootModules.length > 0 || moduleTree.rootModules.length > 0) {
        const group = document.createElement('div');
        group.className = 'module-group';
        
        // 根目录头部（可折叠）
        const header = document.createElement('div');
        header.className = 'module-group-header' + (expandedDirs.has('__root__') ? '' : ' collapsed');
        header.onclick = () => toggleDirectory('__root__');
        
        const toggle = document.createElement('span');
        toggle.className = 'module-group-toggle';
        toggle.textContent = '▼';
        
        const name = document.createElement('span');
        name.className = 'module-group-name';
        name.textContent = '📁 根目录';
        
        const count = document.createElement('span');
        count.className = 'module-group-count';
        count.textContent = rootModules.length + '/' + moduleTree.rootModules.length;
        
        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'module-group-select';
        selectBtn.textContent = '全选';
        selectBtn.onclick = (e) => { e.stopPropagation(); selectRootModules(); };
        
        header.appendChild(toggle);
        header.appendChild(name);
        header.appendChild(count);
        header.appendChild(selectBtn);
        group.appendChild(header);
        
        // 根目录内容
        const items = document.createElement('div');
        items.className = 'module-group-items';
        
        rootModules.forEach(mod => {
            items.appendChild(createAvailableModuleItem(mod));
        });
        
        group.appendChild(items);
        container.appendChild(group);
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
    item.onclick = (e) => {
        // 如果点击的是编辑按钮，不触发添加模块
        if (e.target.classList.contains('module-edit-btn')) return;
        addModule(mod.path);
    };
    
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
    
    // 添加查看按钮
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'module-edit-btn';
    editBtn.textContent = '查看';
    editBtn.title = '查看此模块';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof viewModule === 'function') {
            viewModule(mod.path);
        }
    };
    item.appendChild(editBtn);
    
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

// 添加模块到已选（带动画）
function addModule(path) {
    if (!selectedModules.includes(path)) {
        selectedModules.push(path);
        renderTransferUI();
        
        // 添加动画类到新添加的项
        setTimeout(function() {
            const container = document.getElementById('selectedModules');
            if (container) {
                const lastItem = container.querySelector('.transfer-module-item:last-child');
                if (lastItem) {
                    lastItem.classList.add('adding');
                    setTimeout(function() {
                        lastItem.classList.remove('adding');
                    }, 250);
                }
            }
        }, 10);
    }
}

// 从已选移除模块（带动画）
function removeModule(path) {
    const container = document.getElementById('selectedModules');
    if (container) {
        const item = container.querySelector('[data-path="' + path + '"]');
        if (item) {
            item.classList.add('removing');
            setTimeout(function() {
                selectedModules = selectedModules.filter(p => p !== path);
                renderTransferUI();
            }, 150);
            return;
        }
    }
    // 如果找不到元素，直接移除
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

// 选择根目录所有模块
function selectRootModules() {
    moduleTree.rootModules.forEach(mod => {
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
    
    // 元数据重置
    setVal('metaTitle', '');
    setVal('metaSubtitle', '');
    setVal('metaAuthor', '');
    setVal('metaVersion', '');
    setVal('metaDate', '');
    setVal('metaTocTitle', '');
    
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
    
    // PDF 设置重置 - 使用空值让后端根据平台选择合适的字体
    setVal('pdfMainFont', '');
    setVal('pdfMonoFont', '');
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
function fillConfigForm(config) {
    console.log('fillConfigForm 收到配置:', JSON.stringify(config, null, 2));
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    
    // 基本信息 - 编辑模式下显示 displayName，新建模式下显示 clientName
    setVal('cfgClientName', config.displayName || config.clientName || '');
    setVal('cfgDocTypeName', config.docTypeName || '');
    setVal('cfgTemplate', config.template || '');
    setVal('cfgOutputPattern', config.outputPattern || '');
    
    // 填充元数据
    const meta = config.metadata || {};
    console.log('元数据:', JSON.stringify(meta, null, 2));
    setVal('metaTitle', meta.title || '');
    setVal('metaSubtitle', meta.subtitle || '');
    setVal('metaAuthor', meta.author || '');
    setVal('metaVersion', meta.version || '');
    setVal('metaDate', meta.date || '');
    setVal('metaTocTitle', meta.tocTitle || '');
    
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
    
    // PDF 设置 - 使用空值让后端根据平台选择合适的字体
    const pdf = config.pdfOptions || {};
    setVal('pdfMainFont', pdf.mainfont || '');
    setVal('pdfMonoFont', pdf.monofont || '');
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
    
    // 编辑模式下使用原始的 clientName 和 docTypeName
    const clientName = currentEditConfig ? currentEditConfig.clientName : getVal('cfgClientName');
    const docTypeName = currentEditConfig ? currentEditConfig.docTypeName : getVal('cfgDocTypeName');
    const displayName = getVal('cfgClientName'); // 显示名称
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
    
    // 收集元数据
    const metadata = {
        title: getVal('metaTitle'),
        subtitle: getVal('metaSubtitle'),
        author: getVal('metaAuthor'),
        version: getVal('metaVersion'),
        date: getVal('metaDate'),
        tocTitle: getVal('metaTocTitle')
    };
    
    // 清理元数据空值
    Object.keys(metadata).forEach(key => {
        if (metadata[key] === '' || metadata[key] === null) {
            delete metadata[key];
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
        displayName: displayName || clientName,
        template: template,
        modules: selectedModules,
        pandocArgs: pandocArgs,
        outputPattern: outputPattern || '{client}_' + docTypeName + '_{date}.docx',
        pdfOptions: pdfOptions,
        variables: variables,
        metadata: Object.keys(metadata).length > 0 ? metadata : null
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
        
        console.log('加载配置数据:', JSON.stringify(data.data.config, null, 2));
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
    
    openModal(modal);
}

// 隐藏确认对话框
function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) closeModal(modal);
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
window.hideErrorModal = hideErrorModal;
window.submitConfig = submitConfig;
window.selectAllModules = selectAllModules;
window.clearAllModules = clearAllModules;
window.moveSelectedToRight = moveSelectedToRight;
window.moveSelectedToLeft = moveSelectedToLeft;
window.toggleClientLock = toggleClientLock;
window.openModal = openModal;
window.closeModal = closeModal;


// ==================== 变量模板功能 ====================

let currentVariables = []; // 当前模块的变量声明
let variableValues = {}; // 用户填写的变量值

// 加载变量声明
async function loadVariables(modules) {
    console.log('[变量] loadVariables 被调用, 模块数量:', modules ? modules.length : 0);
    console.log('[变量] 模块列表:', modules);
    
    if (!modules || modules.length === 0) {
        console.log('[变量] 没有模块，清空变量');
        currentVariables = [];
        renderVariableForm();
        return;
    }
    
    try {
        console.log('[变量] 请求 /api/variables ...');
        const response = await fetch('/api/variables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules: modules })
        });
        
        const data = await response.json();
        console.log('[变量] API 响应:', data);
        
        if (!data.success) throw new Error(data.error);
        
        currentVariables = data.data.variables || [];
        console.log('[变量] 解析到变量数量:', currentVariables.length);
        console.log('[变量] 变量列表:', currentVariables.map(v => v.name));
        
        // 显示冲突错误
        if (data.data.errors && data.data.errors.length > 0) {
            console.warn('[变量] 变量冲突:', data.data.errors);
        }
        
        renderVariableForm();
    } catch (e) {
        console.error('[变量] 加载变量失败:', e);
        currentVariables = [];
        renderVariableForm();
    }
}

// 渲染变量表单
function renderVariableForm() {
    console.log('[变量] renderVariableForm 被调用, 变量数量:', currentVariables.length);
    
    const container = document.getElementById('variableForm');
    if (!container) {
        console.error('[变量] 找不到 variableForm 容器!');
        return;
    }
    
    if (currentVariables.length === 0) {
        console.log('[变量] 没有变量，隐藏表单');
        container.innerHTML = '<div class="list-empty">所选模块没有定义变量</div>';
        container.style.display = 'none';
        return;
    }
    
    console.log('[变量] 显示变量设置表单');
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
    console.log('[变量] onModulesChanged 被调用, selectedModules:', selectedModules);
    loadVariables(selectedModules);
}

// 暴露函数到全局作用域
window.loadVariables = loadVariables;
window.validateVariables = validateVariables;
window.getVariableValues = getVariableValues;
window.clearVariableValues = clearVariableValues;
window.onModulesChanged = onModulesChanged;

// ==================== 客户元数据管理功能 ====================


// ==================== 文档悬停预览功能 ====================

// 预览配置
const PREVIEW_CONFIG = {
    showDelay: 300,      // 显示延迟 (ms)
    hideDelay: 150,      // 隐藏延迟 (ms)
    maxWidth: 320,       // 最大宽度 (px)
    offset: 10,          // 与触发元素的偏移 (px)
    maxModules: 5        // 显示的最大模块数
};

// 预览数据缓存
const previewCache = new Map(); // key: clientName, value: Map<docType, preview>

// 预览状态
let previewState = {
    visible: false,
    showTimer: null,
    hideTimer: null,
    currentDocType: null,
    tooltipElement: null
};

// 渲染预览内容 HTML
function renderPreviewContent(preview) {
    if (!preview) {
        return '<div class="preview-empty">暂无预览信息</div>';
    }

    let html = '<div class="preview-content">';
    
    // 标题
    html += '<div class="preview-title">' + escapeHtml(preview.title || '未命名文档') + '</div>';
    
    // 元数据行
    const metaItems = [];
    if (preview.author) metaItems.push('作者: ' + escapeHtml(preview.author));
    if (preview.version) metaItems.push('版本: ' + escapeHtml(preview.version));
    if (preview.date) metaItems.push('日期: ' + escapeHtml(preview.date));
    
    if (metaItems.length > 0) {
        html += '<div class="preview-meta">' + metaItems.join(' · ') + '</div>';
    }
    
    // 模块信息
    html += '<div class="preview-modules">';
    html += '<div class="preview-modules-header">📄 包含 ' + preview.moduleCount + ' 个模块</div>';
    
    if (preview.modules && preview.modules.length > 0) {
        html += '<ul class="preview-modules-list">';
        preview.modules.forEach(function(mod) {
            html += '<li>' + escapeHtml(mod) + '</li>';
        });
        html += '</ul>';
        
        if (preview.hasMore) {
            const remaining = preview.moduleCount - preview.modules.length;
            html += '<div class="preview-modules-more">...还有 ' + remaining + ' 个模块</div>';
        }
    }
    html += '</div>';
    
    // 模板信息
    if (preview.template) {
        html += '<div class="preview-template">模板: ' + escapeHtml(preview.template) + '</div>';
    }
    
    html += '</div>';
    return html;
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 计算 Tooltip 位置
function calculateTooltipPosition(triggerElement, tooltipElement) {
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const offset = PREVIEW_CONFIG.offset;
    
    let left, top;
    
    // 优先显示在右侧
    left = triggerRect.right + offset;
    top = triggerRect.top;
    
    // 如果右侧空间不足，显示在左侧
    if (left + tooltipRect.width > viewportWidth - offset) {
        left = triggerRect.left - tooltipRect.width - offset;
    }
    
    // 如果左侧也不够，显示在下方
    if (left < offset) {
        left = triggerRect.left;
        top = triggerRect.bottom + offset;
    }
    
    // 确保不超出底部
    if (top + tooltipRect.height > viewportHeight - offset) {
        top = viewportHeight - tooltipRect.height - offset;
    }
    
    // 确保不超出顶部
    if (top < offset) {
        top = offset;
    }
    
    return { left: left, top: top };
}

// 获取或创建 Tooltip 元素
function getOrCreateTooltip() {
    let tooltip = document.getElementById('previewTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'previewTooltip';
        tooltip.className = 'preview-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltip);
        
        // 鼠标进入 tooltip 时取消隐藏
        tooltip.addEventListener('mouseenter', function() {
            clearTimeout(previewState.hideTimer);
        });
        
        // 鼠标离开 tooltip 时隐藏
        tooltip.addEventListener('mouseleave', function() {
            hidePreviewTooltip();
        });
    }
    return tooltip;
}

// 显示预览 Tooltip
function showPreviewTooltip(triggerElement, preview) {
    const tooltip = getOrCreateTooltip();
    
    // 渲染内容
    tooltip.innerHTML = renderPreviewContent(preview);
    
    // 先显示以获取尺寸
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    tooltip.classList.add('visible');
    
    // 计算位置
    const position = calculateTooltipPosition(triggerElement, tooltip);
    tooltip.style.left = position.left + 'px';
    tooltip.style.top = position.top + 'px';
    
    // 显示
    tooltip.style.visibility = 'visible';
    tooltip.setAttribute('aria-hidden', 'false');
    
    previewState.visible = true;
    previewState.tooltipElement = tooltip;
}

// 隐藏预览 Tooltip
function hidePreviewTooltip() {
    const tooltip = previewState.tooltipElement || document.getElementById('previewTooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
        tooltip.setAttribute('aria-hidden', 'true');
        setTimeout(function() {
            if (!tooltip.classList.contains('visible')) {
                tooltip.style.display = 'none';
            }
        }, 150);
    }
    
    previewState.visible = false;
    previewState.currentDocType = null;
}

// 获取预览数据（带缓存）
async function getPreviewData(clientName, docType) {
    // 检查缓存
    if (previewCache.has(clientName)) {
        const clientCache = previewCache.get(clientName);
        if (clientCache.has(docType)) {
            return clientCache.get(docType);
        }
    }
    
    // 从 documentTypes 中查找（如果已经加载了预览数据）
    const docTypeData = documentTypes.find(d => d.name === docType);
    if (docTypeData && docTypeData.preview) {
        // 缓存数据
        if (!previewCache.has(clientName)) {
            previewCache.set(clientName, new Map());
        }
        previewCache.get(clientName).set(docType, docTypeData.preview);
        return docTypeData.preview;
    }
    
    return null;
}

// 设置文档项的悬停事件
function setupDocItemHover(docItem, clientName, docType) {
    // 鼠标进入
    docItem.addEventListener('mouseenter', function(e) {
        clearTimeout(previewState.hideTimer);
        
        previewState.showTimer = setTimeout(async function() {
            const preview = await getPreviewData(clientName, docType);
            if (preview) {
                showPreviewTooltip(docItem, preview);
                previewState.currentDocType = docType;
            }
        }, PREVIEW_CONFIG.showDelay);
    });
    
    // 鼠标离开
    docItem.addEventListener('mouseleave', function(e) {
        clearTimeout(previewState.showTimer);
        
        previewState.hideTimer = setTimeout(function() {
            hidePreviewTooltip();
        }, PREVIEW_CONFIG.hideDelay);
    });
    
    // 点击时立即关闭
    docItem.addEventListener('click', function() {
        clearTimeout(previewState.showTimer);
        clearTimeout(previewState.hideTimer);
        hidePreviewTooltip();
    });
    
    // 键盘焦点支持
    docItem.setAttribute('tabindex', '0');
    docItem.addEventListener('focus', async function() {
        clearTimeout(previewState.hideTimer);
        const preview = await getPreviewData(clientName, docType);
        if (preview) {
            showPreviewTooltip(docItem, preview);
            previewState.currentDocType = docType;
        }
    });
    
    docItem.addEventListener('blur', function() {
        hidePreviewTooltip();
    });
}

// 清除预览缓存
function clearPreviewCache(clientName) {
    if (clientName) {
        previewCache.delete(clientName);
    } else {
        previewCache.clear();
    }
}

// Escape 键关闭预览
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && previewState.visible) {
        hidePreviewTooltip();
    }
});

// 暴露函数到全局作用域
window.showPreviewTooltip = showPreviewTooltip;
window.hidePreviewTooltip = hidePreviewTooltip;
window.clearPreviewCache = clearPreviewCache;
