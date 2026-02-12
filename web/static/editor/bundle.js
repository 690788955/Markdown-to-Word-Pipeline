// 知识库编辑器 - 工具函数模块
// 提供 Toast 通知、模态框、HTML 转义、文件大小格式化、路径处理等通用功能

window.EditorApp = window.EditorApp || {};

EditorApp.Utils = (function() {
    'use strict';

    // ==================== Toast 通知 ====================

    /**
     * 显示 Toast 通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型: success, error, warning, info
     * @param {number} duration - 显示时长（毫秒）
     */
    function showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

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

    // ==================== 模态框 ====================

    /**
     * 打开模态框
     * @param {HTMLElement} modal - 模态框元素
     */
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }

    /**
     * 关闭模态框
     * @param {HTMLElement} modal - 模态框元素
     */
    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');

        const openModals = document.querySelectorAll('.modal.active');
        if (openModals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    }

    // ==================== HTML 转义 ====================

    /**
     * HTML 属性转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    function escapeHtmlAttr(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ==================== 文件大小格式化 ====================

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小字符串
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes === undefined || bytes === null) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ==================== 路径处理 ====================

    /**
     * 计算图片基础路径
     * @param {string} filePath - 文件路径
     * @returns {string} 基础路径
     */
    function calculateLinkBase(filePath) {
        let linkBase = '/api/src/';
        const normalizedPath = (filePath || '').replace(/\\/g, '/');
        if (normalizedPath.includes('/')) {
            const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
            // 对每一层路径进行 URI 编码，以防中文路径问题
            const encodedDir = dir.split('/').map(encodeURIComponent).join('/');
            linkBase = '/api/src/' + encodedDir + '/';
        }
        return linkBase;
    }

    /**
     * 编码路径段
     * @param {string} value - 路径字符串
     * @returns {string} 编码后的路径
     */
    function encodePathSegments(value) {
        if (!value) return '';
        return value.split('/').map(encodeURIComponent).join('/');
    }

    // 导出公共接口
    return {
        showToast: showToast,
        openModal: openModal,
        closeModal: closeModal,
        escapeHtmlAttr: escapeHtmlAttr,
        formatFileSize: formatFileSize,
        calculateLinkBase: calculateLinkBase,
        encodePathSegments: encodePathSegments
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.showToast = EditorApp.Utils.showToast;
window.openModal = EditorApp.Utils.openModal;
window.closeModal = EditorApp.Utils.closeModal;
window.escapeHtmlAttr = EditorApp.Utils.escapeHtmlAttr;
window.formatFileSize = EditorApp.Utils.formatFileSize;
window.calculateLinkBase = EditorApp.Utils.calculateLinkBase;
window.encodePathSegments = EditorApp.Utils.encodePathSegments;
// 知识库编辑器 - 状态管理模块
// 提供全局状态对象和访问接口

window.EditorApp = window.EditorApp || {};

EditorApp.State = (function() {
    'use strict';

    // ==================== 主状态对象 ====================

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
        fileTreeWidth: 240,
        gitPanelWidth: 320,
        chatPanelWidth: 380,
        fileTreeCollapsed: false,
        gitPanelCollapsed: true,
        chatPanelCollapsed: true,
        focusMode: false,

        // 操作状态
        contextMenuTarget: null,
        pendingCloseTabId: null,
        renameTarget: null,

        // 拖拽排序
        draggingPath: null,
        draggingParent: null,

        // 附件面板状态
        attachments: [],
        attachmentExpanded: false,
        attachmentLoading: false,
        attachmentTarget: null,  // 右键菜单目标附件

        // 快速打开状态
        quickOpen: {
            visible: false,
            query: '',
            results: [],
            selectedIndex: 0
        },

        // 命令面板状态
        commandPalette: {
            visible: false,
            query: '',
            filteredCommands: [],
            selectedIndex: 0
        },

        // 自动保存状态
        autoSave: {
            enabled: true,
            interval: 30,
            lastSaveTime: null,
            timerId: null
        },

        // 最近文件
        recentFiles: [],

        // 加载状态
        loading: {
            visible: false,
            message: '',
            progress: 0
        },

        // 版本历史
        versionHistory: {
            visible: false,
            path: null,
            commits: [],
            selectedCommit: null
        },

        // 编辑器缓存
        editorCache: {
            active: new Map(),
            pool: [],
            maxSize: 5
        }
    };

    // ==================== 主题状态对象 ====================

    const themeState = {
        theme: 'light',
        accent: '#1a8fbf',
        contentStyle: 'comfortable',
        contentWidth: 'medium',   // 内容宽度: narrow, medium, wide, full
        codeTheme: 'github',      // 代码块主题 ID
        codeThemeManual: false,   // 是否手动选择
        // 字体设置
        font: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 16,
            lineHeight: 1.6
        },
        // 当前预设 ID
        currentPreset: null
    };

    // ==================== 访问接口 ====================

    /**
     * 获取主状态对象
     * @returns {Object} 状态对象引用
     */
    function getState() {
        return state;
    }

    /**
     * 获取主题状态对象
     * @returns {Object} 主题状态对象引用
     */
    function getThemeState() {
        return themeState;
    }

    // 导出公共接口
    return {
        getState: getState,
        getThemeState: getThemeState
    };
})();

// 为了向后兼容，将状态对象暴露到全局作用域
window.state = EditorApp.State.getState();
window.themeState = EditorApp.State.getThemeState();
// 知识库编辑器 - 加载指示器模块
// 提供加载状态显示、进度条、操作状态反馈等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Loading = (function() {
    'use strict';

    let loadingElement = null;
    let progressBar = null;
    let messageElement = null;

    // ==================== 初始化 ====================

    function init() {
        createLoadingElement();
    }

    function createLoadingElement() {
        if (loadingElement) return;

        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingIndicator';
        loadingElement.className = 'loading-indicator';
        loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <span class="loading-message">加载中...</span>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            </div>
        `;
        document.body.appendChild(loadingElement);

        messageElement = loadingElement.querySelector('.loading-message');
        progressBar = loadingElement.querySelector('.loading-progress-bar');
    }

    // ==================== 显示/隐藏 ====================

    function show(message) {
        const state = EditorApp.State.getState();
        state.loading.visible = true;
        state.loading.message = message || '加载中...';
        state.loading.progress = 0;

        if (!loadingElement) createLoadingElement();

        messageElement.textContent = state.loading.message;
        progressBar.style.width = '0%';
        loadingElement.classList.add('visible');
    }

    function hide() {
        const state = EditorApp.State.getState();
        state.loading.visible = false;
        state.loading.progress = 0;

        if (loadingElement) {
            loadingElement.classList.remove('visible');
        }
    }

    // ==================== 进度更新 ====================

    function setProgress(percent) {
        const state = EditorApp.State.getState();
        state.loading.progress = Math.min(100, Math.max(0, percent));

        if (progressBar) {
            progressBar.style.width = state.loading.progress + '%';
        }
    }

    function setMessage(message) {
        const state = EditorApp.State.getState();
        state.loading.message = message;

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // ==================== 状态提示 ====================

    function showStatus(status, type) {
        type = type || 'info';
        EditorApp.Utils.showToast(status, type);
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        setProgress: setProgress,
        setMessage: setMessage,
        showStatus: showStatus
    };
})();
// 知识库编辑器 - 最近文件管理模块
// 提供最近打开文件的记录、持久化和管理功能

window.EditorApp = window.EditorApp || {};

EditorApp.RecentFiles = (function() {
    'use strict';

    const STORAGE_KEY = 'editorRecentFiles';
    const MAX_SIZE = 20;

    // ==================== 初始化 ====================

    function init() {
        load();
    }

    // ==================== 持久化 ====================

    function load() {
        const state = EditorApp.State.getState();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                state.recentFiles = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('加载最近文件列表失败:', e);
            state.recentFiles = [];
        }
    }

    function save() {
        const state = EditorApp.State.getState();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recentFiles));
        } catch (e) {
            console.warn('保存最近文件列表失败:', e);
        }
    }

    // ==================== 列表操作 ====================

    /**
     * 添加文件到最近列表
     * @param {string} path - 文件路径
     */
    function add(path) {
        if (!path) return;

        const state = EditorApp.State.getState();
        const name = path.split('/').pop();
        const timestamp = Date.now();

        // 移除已存在的相同路径
        state.recentFiles = state.recentFiles.filter(f => f.path !== path);

        // 添加到列表开头
        state.recentFiles.unshift({
            path: path,
            name: name,
            timestamp: timestamp
        });

        // 限制列表大小
        if (state.recentFiles.length > MAX_SIZE) {
            state.recentFiles = state.recentFiles.slice(0, MAX_SIZE);
        }

        save();
    }

    /**
     * 获取最近文件列表
     * @returns {Array} 最近文件列表，按时间戳降序排列
     */
    function getList() {
        const state = EditorApp.State.getState();
        return state.recentFiles.slice().sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * 清除最近文件列表
     */
    function clear() {
        const state = EditorApp.State.getState();
        state.recentFiles = [];
        save();
    }

    /**
     * 移除无效条目（文件已不存在）
     * @param {Set<string>} validPaths - 有效文件路径集合
     */
    function removeInvalid(validPaths) {
        const state = EditorApp.State.getState();
        const before = state.recentFiles.length;
        state.recentFiles = state.recentFiles.filter(f => validPaths.has(f.path));
        if (state.recentFiles.length !== before) {
            save();
        }
    }

    /**
     * 移除指定文件
     * @param {string} path - 文件路径
     */
    function remove(path) {
        const state = EditorApp.State.getState();
        state.recentFiles = state.recentFiles.filter(f => f.path !== path);
        save();
    }

    // 导出公共接口
    return {
        init: init,
        add: add,
        getList: getList,
        clear: clear,
        removeInvalid: removeInvalid,
        remove: remove
    };
})();
// 知识库编辑器 - 主题控制模块
// 提供主题切换、颜色处理、代码块主题、字体设置、主题预设等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Theme = (function() {
    'use strict';

    const themeState = EditorApp.State.getThemeState();

    // ==================== 代码块主题配置 ====================

    const CODE_THEMES = {
        'github': {
            name: 'GitHub',
            description: '经典 GitHub 风格',
            style: 'github',
            darkStyle: 'github-dark',
            previewColors: ['#24292e', '#d73a49', '#6f42c1', '#22863a']
        },
        'atom-one': {
            name: 'One Dark',
            description: 'Atom One Dark 配色',
            style: 'atom-one-light',
            darkStyle: 'atom-one-dark',
            previewColors: ['#282c34', '#e06c75', '#c678dd', '#98c379']
        },
        'vs': {
            name: 'VS Code',
            description: 'Visual Studio Code 风格',
            style: 'vs',
            darkStyle: 'vs2015',
            previewColors: ['#1e1e1e', '#569cd6', '#ce9178', '#4ec9b0']
        },
        'monokai': {
            name: 'Monokai',
            description: '经典 Monokai 配色',
            style: 'monokai',
            darkStyle: 'monokai-sublime',
            previewColors: ['#272822', '#f92672', '#ae81ff', '#a6e22e']
        }
    };

    // ==================== 主题预设配置 ====================

    const THEME_PRESETS = [
        {
            id: 'light-default',
            name: '默认亮色',
            description: '清爽的默认亮色主题',
            theme: 'light',
            accent: '#1a8fbf',
            codeTheme: 'github',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'dark-default',
            name: '默认暗色',
            description: '护眼的默认暗色主题',
            theme: 'dark',
            accent: '#1a8fbf',
            codeTheme: 'github',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'light-warm',
            name: '暖色亮色',
            description: '温暖的橙色调亮色主题',
            theme: 'light',
            accent: '#e67e22',
            codeTheme: 'atom-one',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'dark-purple',
            name: '紫色暗色',
            description: '优雅的紫色调暗色主题',
            theme: 'dark',
            accent: '#9b59b6',
            codeTheme: 'monokai',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'light-green',
            name: '绿色亮色',
            description: '清新的绿色调亮色主题',
            theme: 'light',
            accent: '#27ae60',
            codeTheme: 'vs',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'dark-ocean',
            name: '海洋暗色',
            description: '深邃的蓝色调暗色主题',
            theme: 'dark',
            accent: '#3498db',
            codeTheme: 'atom-one',
            contentStyle: 'normal',
            contentWidth: 'normal'
        },
        {
            id: 'focus-light',
            name: '专注亮色',
            description: '紧凑布局，适合专注写作',
            theme: 'light',
            accent: '#1a8fbf',
            codeTheme: 'github',
            contentStyle: 'compact',
            contentWidth: 'narrow'
        },
        {
            id: 'focus-dark',
            name: '专注暗色',
            description: '紧凑布局，适合夜间写作',
            theme: 'dark',
            accent: '#1a8fbf',
            codeTheme: 'github',
            contentStyle: 'compact',
            contentWidth: 'narrow'
        }
    ];

    // ==================== 字体配置 ====================

    const FONT_FAMILIES = [
        { id: 'system', name: '系统默认', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
        { id: 'serif', name: '衬线字体', value: 'Georgia, "Times New Roman", serif' },
        { id: 'mono', name: '等宽字体', value: '"Fira Code", "Source Code Pro", Consolas, monospace' },
        { id: 'noto', name: 'Noto Sans', value: '"Noto Sans SC", "Noto Sans", sans-serif' },
        { id: 'source', name: '思源黑体', value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' }
    ];

    const FONT_SIZE_MIN = 12;
    const FONT_SIZE_MAX = 24;
    const FONT_SIZE_DEFAULT = 16;
    const LINE_HEIGHT_DEFAULT = 1.6;

    // ==================== 初始化 ====================

    function init() {
        const savedTheme = localStorage.getItem('uiTheme');
        const savedAccent = localStorage.getItem('uiAccent');
        const savedContentStyle = localStorage.getItem('uiContentStyle');
        const savedContentWidth = localStorage.getItem('uiContentWidth');
        const savedCodeTheme = localStorage.getItem('codeTheme');
        const savedCodeThemeManual = localStorage.getItem('codeThemeManual');
        const savedPreset = localStorage.getItem('themePreset');
        
        if (savedTheme) {
            themeState.theme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            themeState.theme = 'dark';
        }
        if (savedAccent) {
            themeState.accent = savedAccent;
        }
        if (savedContentStyle) {
            themeState.contentStyle = savedContentStyle;
        }
        if (savedContentWidth) {
            themeState.contentWidth = savedContentWidth;
        }
        if (savedCodeTheme && CODE_THEMES[savedCodeTheme]) {
            themeState.codeTheme = savedCodeTheme;
        }
        themeState.codeThemeManual = savedCodeThemeManual === '1';
        if (savedPreset) {
            themeState.currentPreset = savedPreset;
        }
        
        // 初始化字体设置
        initFontSettings();
        
        apply();
    }

    function initFontSettings() {
        const savedFont = localStorage.getItem('editorFont');
        if (savedFont) {
            try {
                const fontSettings = JSON.parse(savedFont);
                themeState.font = {
                    fontFamily: fontSettings.fontFamily || FONT_FAMILIES[0].value,
                    fontSize: clampFontSize(fontSettings.fontSize || FONT_SIZE_DEFAULT),
                    lineHeight: fontSettings.lineHeight || LINE_HEIGHT_DEFAULT
                };
            } catch (e) {
                console.warn('[Theme] 解析字体设置失败:', e);
                resetFontToDefault();
            }
        } else {
            resetFontToDefault();
        }
    }

    function resetFontToDefault() {
        themeState.font = {
            fontFamily: FONT_FAMILIES[0].value,
            fontSize: FONT_SIZE_DEFAULT,
            lineHeight: LINE_HEIGHT_DEFAULT
        };
    }

    function clampFontSize(size) {
        return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
    }

    function initControls() {
        const toggleBtn = document.getElementById('themeToggleBtn');
        const panel = document.getElementById('themePanel');
        const accentInput = document.getElementById('themeAccentInput');

        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.toggle('is-open');
            });

            panel.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', () => {
                panel.classList.remove('is-open');
            });
        }

        document.querySelectorAll('[data-theme-option]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextTheme = btn.getAttribute('data-theme-option');
                if (!nextTheme) return;
                themeState.theme = nextTheme;
                themeState.currentPreset = null;
                localStorage.setItem('uiTheme', themeState.theme);
                localStorage.removeItem('themePreset');
                apply();
            });
        });

        document.querySelectorAll('[data-accent]').forEach(btn => {
            btn.addEventListener('click', () => {
                const accent = btn.getAttribute('data-accent');
                if (!accent) return;
                themeState.currentPreset = null;
                localStorage.removeItem('themePreset');
                setAccent(accent);
            });
        });

        document.querySelectorAll('[data-content-style]').forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.getAttribute('data-content-style');
                if (!style) return;
                setContentStyle(style);
            });
        });

        document.querySelectorAll('[data-content-width]').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = btn.getAttribute('data-content-width');
                if (!width) return;
                setContentWidth(width);
            });
        });

        if (accentInput) {
            accentInput.value = themeState.accent;
            accentInput.addEventListener('input', (e) => {
                themeState.currentPreset = null;
                localStorage.removeItem('themePreset');
                setAccent(e.target.value);
            });
        }

        document.querySelectorAll('[data-code-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                const themeId = btn.getAttribute('data-code-theme');
                if (!themeId) return;
                setCodeTheme(themeId, true);
            });
        });

        // 初始化字体设置控件
        initFontControls();

        // 初始化主题预设控件
        initPresetControls();

        // 初始化导入导出按钮
        initImportExportControls();
    }

    function initFontControls() {
        const fontFamilySelect = document.getElementById('fontFamilySelect');
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');

        if (fontFamilySelect) {
            // 设置当前值
            fontFamilySelect.value = themeState.font.fontFamily;
            
            fontFamilySelect.addEventListener('change', (e) => {
                Font.updateSettings({ fontFamily: e.target.value });
            });
        }

        if (fontSizeSlider && fontSizeValue) {
            // 设置当前值
            fontSizeSlider.value = themeState.font.fontSize;
            fontSizeValue.textContent = themeState.font.fontSize + 'px';

            fontSizeSlider.addEventListener('input', (e) => {
                const size = parseInt(e.target.value, 10);
                fontSizeValue.textContent = size + 'px';
                Font.updateSettings({ fontSize: size });
            });
        }
    }

    function initPresetControls() {
        const presetsContainer = document.getElementById('themePresets');
        if (!presetsContainer) return;

        // 清空并重新生成预设按钮
        presetsContainer.innerHTML = '';

        THEME_PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'theme-preset-chip';
            btn.dataset.preset = preset.id;
            btn.title = preset.description;
            btn.innerHTML = `
                <span class="preset-indicator" style="background: ${preset.accent}"></span>
                <span class="preset-name">${preset.name}</span>
            `;

            if (themeState.currentPreset === preset.id) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                Presets.apply(preset.id);
                updatePresetControls();
            });

            presetsContainer.appendChild(btn);
        });
    }

    function updatePresetControls() {
        const presetsContainer = document.getElementById('themePresets');
        if (!presetsContainer) return;

        presetsContainer.querySelectorAll('.theme-preset-chip').forEach(btn => {
            const presetId = btn.dataset.preset;
            btn.classList.toggle('active', presetId === themeState.currentPreset);
        });
    }

    function initImportExportControls() {
        const exportBtn = document.getElementById('exportThemeBtn');
        const importBtn = document.getElementById('importThemeBtn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const json = Presets.exportCurrent();
                
                // 复制到剪贴板
                navigator.clipboard.writeText(json).then(() => {
                    if (EditorApp.Utils) {
                        EditorApp.Utils.showToast('主题配置已复制到剪贴板', 'success');
                    }
                }).catch(() => {
                    // 回退：显示在提示框中
                    prompt('复制以下主题配置：', json);
                });
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const json = prompt('粘贴主题配置 JSON：');
                if (json) {
                    const success = Presets.import(json);
                    if (EditorApp.Utils) {
                        if (success) {
                            EditorApp.Utils.showToast('主题导入成功', 'success');
                        } else {
                            EditorApp.Utils.showToast('主题配置格式无效', 'error');
                        }
                    }
                }
            });
        }
    }

    // ==================== 主题应用 ====================

    function apply() {
        document.documentElement.setAttribute('data-theme', themeState.theme);
        setAccent(themeState.accent, true);
        applyContentStyle();
        applyContentWidth();
        updateControls();
        applyCodeTheme();
        updateCodeThemeControls();
    }

    function updateControls() {
        document.querySelectorAll('[data-theme-option]').forEach(btn => {
            const option = btn.getAttribute('data-theme-option');
            btn.classList.toggle('active', option === themeState.theme);
        });
        document.querySelectorAll('[data-content-style]').forEach(btn => {
            const style = btn.getAttribute('data-content-style');
            btn.classList.toggle('active', style === themeState.contentStyle);
        });
        document.querySelectorAll('[data-content-width]').forEach(btn => {
            const width = btn.getAttribute('data-content-width');
            btn.classList.toggle('active', width === themeState.contentWidth);
        });
        const accentInput = document.getElementById('themeAccentInput');
        if (accentInput) accentInput.value = themeState.accent;
    }

    // ==================== 代码块主题 ====================

    function setCodeTheme(themeId, isManual = true) {
        if (!CODE_THEMES[themeId]) return;
        
        themeState.codeTheme = themeId;
        themeState.codeThemeManual = isManual;
        
        localStorage.setItem('codeTheme', themeId);
        localStorage.setItem('codeThemeManual', isManual ? '1' : '0');
        
        applyCodeTheme();
        updateCodeThemeControls();
    }

    function applyCodeTheme() {
        const theme = CODE_THEMES[themeState.codeTheme];
        if (!theme) return;
        
        const styleName = themeState.theme === 'dark' ? theme.darkStyle : theme.style;
        const hljsLink = document.getElementById('hljsTheme');
        if (hljsLink) {
            hljsLink.href = `/static/vendor/vditor/dist/js/highlight.js/styles/${styleName}.min.css`;
        }
    }

    function updateCodeThemeControls() {
        document.querySelectorAll('[data-code-theme]').forEach(btn => {
            const themeId = btn.getAttribute('data-code-theme');
            btn.classList.toggle('active', themeId === themeState.codeTheme);
        });
    }

    function getHljsStyle() {
        const theme = CODE_THEMES[themeState.codeTheme];
        if (!theme) return 'github';
        return themeState.theme === 'dark' ? theme.darkStyle : theme.style;
    }

    // ==================== 强调色 ====================

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
        updateControls();
    }

    // ==================== 内容样式 ====================

    function setContentStyle(style) {
        themeState.contentStyle = style;
        localStorage.setItem('uiContentStyle', style);
        applyContentStyle();
        updateControls();
    }

    function applyContentStyle() {
        document.body.dataset.contentStyle = themeState.contentStyle;
    }

    function setContentWidth(width) {
        themeState.contentWidth = width;
        localStorage.setItem('uiContentWidth', width);
        applyContentWidth();
        updateControls();
    }

    function applyContentWidth() {
        document.body.dataset.contentWidth = themeState.contentWidth;
    }

    // ==================== 颜色工具函数 ====================

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

        let r, g, b;

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

    // ==================== 字体设置 ====================

    const Font = {
        getSettings: function() {
            return { ...themeState.font };
        },

        updateSettings: function(settings) {
            if (settings.fontFamily !== undefined) {
                themeState.font.fontFamily = settings.fontFamily;
            }
            if (settings.fontSize !== undefined) {
                themeState.font.fontSize = clampFontSize(settings.fontSize);
            }
            if (settings.lineHeight !== undefined) {
                themeState.font.lineHeight = settings.lineHeight;
            }

            // 保存到 localStorage
            localStorage.setItem('editorFont', JSON.stringify(themeState.font));

            // 应用字体设置
            Font.apply();
        },

        apply: function() {
            const root = document.documentElement;
            root.style.setProperty('--editor-font-family', themeState.font.fontFamily);
            root.style.setProperty('--editor-font-size', themeState.font.fontSize + 'px');
            root.style.setProperty('--editor-line-height', themeState.font.lineHeight);
        },

        resetToDefault: function() {
            resetFontToDefault();
            localStorage.removeItem('editorFont');
            Font.apply();
        },

        getFontFamilies: function() {
            return FONT_FAMILIES;
        },

        getSizeRange: function() {
            return { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX, default: FONT_SIZE_DEFAULT };
        }
    };

    // ==================== 主题预设 ====================

    const Presets = {
        getAll: function() {
            return THEME_PRESETS;
        },

        get: function(presetId) {
            return THEME_PRESETS.find(p => p.id === presetId) || null;
        },

        apply: function(presetId) {
            const preset = Presets.get(presetId);
            if (!preset) {
                console.warn('[Theme] 预设不存在:', presetId);
                return false;
            }

            // 应用预设的所有设置
            themeState.theme = preset.theme;
            themeState.accent = preset.accent;
            themeState.codeTheme = preset.codeTheme;
            themeState.contentStyle = preset.contentStyle;
            themeState.contentWidth = preset.contentWidth;
            themeState.currentPreset = presetId;

            // 保存到 localStorage
            localStorage.setItem('uiTheme', preset.theme);
            localStorage.setItem('uiAccent', preset.accent);
            localStorage.setItem('codeTheme', preset.codeTheme);
            localStorage.setItem('uiContentStyle', preset.contentStyle);
            localStorage.setItem('uiContentWidth', preset.contentWidth);
            localStorage.setItem('themePreset', presetId);

            // 应用主题
            apply();

            console.log('[Theme] 应用预设:', preset.name);
            return true;
        },

        getCurrent: function() {
            return themeState.currentPreset;
        },

        exportCurrent: function() {
            const config = {
                name: '自定义主题',
                theme: themeState.theme,
                accent: themeState.accent,
                codeTheme: themeState.codeTheme,
                contentStyle: themeState.contentStyle,
                contentWidth: themeState.contentWidth,
                font: { ...themeState.font }
            };
            return JSON.stringify(config, null, 2);
        },

        import: function(jsonStr) {
            try {
                const config = JSON.parse(jsonStr);

                // 验证必需字段
                if (!config.theme || !config.accent) {
                    console.warn('[Theme] 导入配置缺少必需字段');
                    return false;
                }

                // 验证主题值
                if (!['light', 'dark'].includes(config.theme)) {
                    console.warn('[Theme] 无效的主题值:', config.theme);
                    return false;
                }

                // 应用配置
                themeState.theme = config.theme;
                themeState.accent = config.accent;
                
                if (config.codeTheme && CODE_THEMES[config.codeTheme]) {
                    themeState.codeTheme = config.codeTheme;
                }
                if (config.contentStyle) {
                    themeState.contentStyle = config.contentStyle;
                }
                if (config.contentWidth) {
                    themeState.contentWidth = config.contentWidth;
                }
                if (config.font) {
                    Font.updateSettings(config.font);
                }

                // 清除当前预设（因为是自定义导入）
                themeState.currentPreset = null;
                localStorage.removeItem('themePreset');

                // 保存并应用
                localStorage.setItem('uiTheme', themeState.theme);
                localStorage.setItem('uiAccent', themeState.accent);
                localStorage.setItem('codeTheme', themeState.codeTheme);
                localStorage.setItem('uiContentStyle', themeState.contentStyle);
                localStorage.setItem('uiContentWidth', themeState.contentWidth);

                apply();

                console.log('[Theme] 导入主题成功');
                return true;
            } catch (e) {
                console.error('[Theme] 导入主题失败:', e);
                return false;
            }
        }
    };

    // 导出公共接口
    return {
        CODE_THEMES: CODE_THEMES,
        THEME_PRESETS: THEME_PRESETS,
        FONT_FAMILIES: FONT_FAMILIES,
        init: init,
        initControls: initControls,
        apply: apply,
        setAccent: setAccent,
        setContentStyle: setContentStyle,
        setContentWidth: setContentWidth,
        setCodeTheme: setCodeTheme,
        getHljsStyle: getHljsStyle,
        // 字体设置
        Font: Font,
        // 主题预设
        Presets: Presets,
        // 颜色工具
        hexToRgb: hexToRgb,
        rgbToHsl: rgbToHsl,
        hslToHex: hslToHex,
        rgba: rgba,
        adjustLightness: adjustLightness
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.CODE_THEMES = EditorApp.Theme.CODE_THEMES;
window.THEME_PRESETS = EditorApp.Theme.THEME_PRESETS;
window.initTheme = EditorApp.Theme.init;
window.initThemeControls = EditorApp.Theme.initControls;
window.applyTheme = EditorApp.Theme.apply;
window.setAccent = EditorApp.Theme.setAccent;
window.setContentStyle = EditorApp.Theme.setContentStyle;
window.setContentWidth = EditorApp.Theme.setContentWidth;
window.setCodeTheme = EditorApp.Theme.setCodeTheme;
window.getHljsStyle = EditorApp.Theme.getHljsStyle;
window.updateHljsTheme = EditorApp.Theme.applyCodeTheme;
// 知识库编辑器 - 布局管理模块
// 提供面板折叠、拖拽调整宽度、专注模式、布局偏好持久化等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Layout = (function() {
    'use strict';

    const state = EditorApp.State.getState();

    // ==================== 面板切换 ====================

    function toggleFileTree() {
        state.fileTreeCollapsed = !state.fileTreeCollapsed;
        apply();
        savePreferences();
    }

    function toggleGitPanel() {
        state.gitPanelCollapsed = !state.gitPanelCollapsed;
        apply();
        savePreferences();

        // 展开面板时加载 Git 状态
        if (!state.gitPanelCollapsed && EditorApp.Git) {
            EditorApp.Git.loadStatus();
        }
    }

    function toggleChatPanel() {
        state.chatPanelCollapsed = !state.chatPanelCollapsed;
        apply();
        savePreferences();
    }

    function toggleFocusMode() {
        state.focusMode = !state.focusMode;
        applyFocusMode();
        savePreferences();
    }

    // ==================== 布局应用 ====================

    function apply() {
        const fileTreePanel = document.getElementById('fileTreePanel');
        const gitPanel = document.getElementById('gitPanel');
        const chatPanel = document.getElementById('chatPanel');
        const leftResizer = document.getElementById('leftResizer');
        const rightResizer = document.getElementById('rightResizer');
        const chatResizer = document.getElementById('chatResizer');

        if (fileTreePanel) {
            fileTreePanel.classList.toggle('collapsed', state.fileTreeCollapsed);
            if (!state.fileTreeCollapsed) {
                fileTreePanel.style.width = state.fileTreeWidth + 'px';
            }
        }

        if (gitPanel) {
            gitPanel.classList.toggle('collapsed', state.gitPanelCollapsed);
            if (!state.gitPanelCollapsed) {
                gitPanel.style.width = state.gitPanelWidth + 'px';
            }
        }

        if (chatPanel) {
            chatPanel.classList.toggle('collapsed', state.chatPanelCollapsed);
            if (!state.chatPanelCollapsed) {
                chatPanel.style.width = state.chatPanelWidth + 'px';
            }
        }

        if (leftResizer) {
            leftResizer.style.display = state.fileTreeCollapsed ? 'none' : 'block';
        }

        if (rightResizer) {
            rightResizer.style.display = state.gitPanelCollapsed ? 'none' : 'block';
        }

        if (chatResizer) {
            chatResizer.style.display = state.chatPanelCollapsed ? 'none' : 'block';
        }

        // 更新活动栏按钮状态
        const fileTreeBtn = document.getElementById('toggleFileTree');
        const gitPanelBtn = document.getElementById('toggleGitPanel');
        const chatPanelBtn = document.getElementById('toggleChatPanel');
        if (fileTreeBtn) {
            fileTreeBtn.classList.toggle('is-active', !state.fileTreeCollapsed);
        }
        if (gitPanelBtn) {
            gitPanelBtn.classList.toggle('is-active', !state.gitPanelCollapsed);
        }
        if (chatPanelBtn) {
            chatPanelBtn.classList.toggle('is-active', !state.chatPanelCollapsed);
        }
    }

    function applyFocusMode() {
        const body = document.body;
        const focusBtn = document.getElementById('toggleFocusMode');
        body.classList.toggle('focus-mode', state.focusMode);
        if (focusBtn) {
            focusBtn.classList.toggle('is-active', state.focusMode);
        }
    }

    // ==================== 拖拽调整宽度 ====================

    function initResizers() {
        const leftResizer = document.getElementById('leftResizer');
        const rightResizer = document.getElementById('rightResizer');

        if (!leftResizer || !rightResizer) return;

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
            savePreferences();
        }

        leftResizer.addEventListener('mousedown', (e) => startResize(e, leftResizer));
        rightResizer.addEventListener('mousedown', (e) => startResize(e, rightResizer));
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    // ==================== 偏好持久化 ====================

    function loadPreferences() {
        try {
            const prefs = JSON.parse(localStorage.getItem('editorLayout') || '{}');
            if (prefs.fileTreeWidth) state.fileTreeWidth = prefs.fileTreeWidth;
            if (prefs.gitPanelWidth) state.gitPanelWidth = prefs.gitPanelWidth;
            if (prefs.chatPanelWidth) state.chatPanelWidth = prefs.chatPanelWidth;
            if (prefs.fileTreeCollapsed !== undefined) state.fileTreeCollapsed = prefs.fileTreeCollapsed;
            if (prefs.gitPanelCollapsed !== undefined) state.gitPanelCollapsed = prefs.gitPanelCollapsed;
            if (prefs.chatPanelCollapsed !== undefined) state.chatPanelCollapsed = prefs.chatPanelCollapsed;
            if (prefs.focusMode !== undefined) state.focusMode = prefs.focusMode;
        } catch (e) {
            console.error('加载布局偏好失败:', e);
        }
    }

    function savePreferences() {
        try {
            localStorage.setItem('editorLayout', JSON.stringify({
                fileTreeWidth: state.fileTreeWidth,
                gitPanelWidth: state.gitPanelWidth,
                chatPanelWidth: state.chatPanelWidth,
                fileTreeCollapsed: state.fileTreeCollapsed,
                gitPanelCollapsed: state.gitPanelCollapsed,
                chatPanelCollapsed: state.chatPanelCollapsed,
                focusMode: state.focusMode
            }));
        } catch (e) {
            console.error('保存布局偏好失败:', e);
        }
    }

    // 导出公共接口
    return {
        toggleFileTree: toggleFileTree,
        toggleGitPanel: toggleGitPanel,
        toggleChatPanel: toggleChatPanel,
        toggleFocusMode: toggleFocusMode,
        apply: apply,
        applyFocusMode: applyFocusMode,
        initResizers: initResizers,
        loadPreferences: loadPreferences,
        savePreferences: savePreferences
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.toggleFileTree = EditorApp.Layout.toggleFileTree;
window.toggleGitPanel = EditorApp.Layout.toggleGitPanel;
window.toggleFocusMode = EditorApp.Layout.toggleFocusMode;
window.applyLayout = EditorApp.Layout.apply;
window.applyFocusMode = EditorApp.Layout.applyFocusMode;
window.initResizers = EditorApp.Layout.initResizers;
window.loadLayoutPreferences = EditorApp.Layout.loadPreferences;
window.saveLayoutPreferences = EditorApp.Layout.savePreferences;
// 知识库编辑器 - 文件树模块
// 提供文件树加载、渲染、搜索、拖拽排序等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Tree = (function() {
    'use strict';

    const state = EditorApp.State.getState();

    // 搜索防抖定时器
    let searchDebounceTimer = null;
    const SEARCH_DEBOUNCE_DELAY = 300;

    // 事件委托是否已初始化
    let eventDelegationInitialized = false;

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

            // 初始化事件委托（只执行一次）
            initEventDelegation();
        } catch (e) {
            container.innerHTML = '<div class="tree-loading">加载失败: ' + e.message + '</div>';
            console.error('加载文件树失败:', e);
        }
    }

    // ==================== 事件委托 ====================

    function initEventDelegation() {
        if (eventDelegationInitialized) return;

        const container = document.getElementById('fileTree');
        if (!container) return;

        // 点击事件委托
        container.addEventListener('click', handleTreeClick);

        // 右键菜单事件委托
        container.addEventListener('contextmenu', handleTreeContextMenu);

        // 拖拽事件委托
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);

        eventDelegationInitialized = true;
        console.log('[FileTree] 事件委托已初始化');
    }

    function handleTreeClick(e) {
        const item = e.target.closest('.tree-item');
        if (!item) return;

        const toggle = e.target.closest('.tree-folder-toggle');
        const path = item.dataset.path;
        const type = item.dataset.type;

        if (type === 'directory') {
            toggleDirectory(path);
        } else if (!toggle) {
            // 文件点击
            if (EditorApp.Tabs) {
                EditorApp.Tabs.open(path);
            }
        }
    }

    function handleTreeContextMenu(e) {
        const item = e.target.closest('.tree-item');
        if (!item) return;

        const path = item.dataset.path;
        const node = findNodeByPath(state.fileTree, path);
        if (node && EditorApp.Files) {
            EditorApp.Files.showContextMenu(e, node);
        }
    }

    function handleDragStart(e) {
        const item = e.target.closest('.tree-item');
        if (!item || state.searchQuery) {
            e.preventDefault();
            return;
        }
        state.draggingPath = item.dataset.path;
        state.draggingParent = item.dataset.parent || '';
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', state.draggingPath || '');
    }

    function handleDragOver(e) {
        const target = e.target.closest('.tree-item');
        if (!target) return;

        const targetParent = target.dataset.parent || '';
        if (!state.draggingPath || targetParent !== state.draggingParent) return;
        if (state.draggingPath === target.dataset.path) return;

        e.preventDefault();
        const rect = target.getBoundingClientRect();
        const placeAfter = e.clientY > rect.top + rect.height / 2;
        clearDropIndicators();
        target.classList.add(placeAfter ? 'drop-after' : 'drop-before');
    }

    function handleDragLeave(e) {
        const target = e.target.closest('.tree-item');
        if (target) {
            target.classList.remove('drop-before', 'drop-after');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const target = e.target.closest('.tree-item');
        if (!target) return;

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

    function handleDragEnd(e) {
        const item = e.target.closest('.tree-item');
        if (item) {
            item.classList.remove('dragging');
        }
        clearDropIndicators();
        state.draggingPath = null;
        state.draggingParent = null;
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

            if (child.type === 'directory') {
                const isExpanded = state.expandedDirs.has(child.path);

                // 折叠图标
                const toggle = document.createElement('span');
                toggle.className = 'tree-folder-toggle' + (isExpanded ? ' expanded' : '');
                toggle.textContent = '▶';
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
        const query = e.target.value.trim();

        // 清除之前的防抖定时器
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }

        // 设置新的防抖定时器
        searchDebounceTimer = setTimeout(() => {
            state.searchQuery = query;

            // 搜索时展开所有目录
            if (state.searchQuery) {
                expandAllDirectories(state.fileTree);
            }

            render();
        }, SEARCH_DEBOUNCE_DELAY);
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
        saveOrder: saveOrder,
        getFileIconInfo: getFileIconInfo,
        findNodeByPath: findNodeByPath,
        getParentNode: getParentNode,
        initEventDelegation: initEventDelegation
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
// 知识库编辑器 - 标签管理模块
// 提供标签打开、关闭、切换、拖拽排序、未保存提示等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Tabs = (function() {
    'use strict';

    const state = EditorApp.State.getState();
    let draggedTabId = null;

    // ==================== 标签操作 ====================

    function open(path) {
        // 检查是否已打开
        let tab = state.tabs.find(t => t.path === path);

        if (tab) {
            switchTo(tab.id);
            return;
        }

        // 创建新标签
        const id = 'tab-' + Date.now();
        const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i.test(path);

        tab = {
            id: id,
            path: path,
            title: path.split('/').pop().replace('.md', ''),
            type: isImage ? 'image' : 'markdown',
            isDirty: false,
            content: null,
            originalContent: null
        };

        state.tabs.push(tab);
        state.selectedFile = path;

        render();
        switchTo(id);

        // 如果是图片，不加载文本内容
        if (!isImage && EditorApp.Vditor) {
            EditorApp.Vditor.loadContent(tab);
        }
    }

    function switchTo(tabId) {
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
        if (EditorApp.Vditor) {
            EditorApp.Vditor.show(tab);
        }

        // 加载附件（仅 Markdown 文件）
        if (tab.type !== 'image' && EditorApp.Attachments) {
            EditorApp.Attachments.load(tab.path);
        } else if (EditorApp.Attachments) {
            state.attachments = [];
            EditorApp.Attachments.render();
        }

        // 更新面包屑导航
        if (EditorApp.Breadcrumb) {
            EditorApp.Breadcrumb.update(tab.path);
        }

        // 添加到最近文件
        if (EditorApp.RecentFiles) {
            EditorApp.RecentFiles.add(tab.path);
        }
    }

    function close(tabId, force = false) {
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
                switchTo(state.tabs[newIndex].id);
            } else {
                state.activeTabId = null;
                state.selectedFile = null;
                if (EditorApp.Vditor) {
                    EditorApp.Vditor.showPlaceholder();
                }
            }
        }

        render();
        if (EditorApp.Tree) {
            EditorApp.Tree.render();
        }
    }

    function render() {
        const container = document.getElementById('tabList');
        if (!container) return;

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

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                close(tab.id);
            };
            item.appendChild(closeBtn);

            item.onclick = () => switchTo(tab.id);

            // 拖拽排序
            item.ondragstart = (e) => onDragStart(e, tab.id);
            item.ondragover = (e) => onDragOver(e);
            item.ondrop = (e) => onDrop(e, tab.id);

            container.appendChild(item);
        });
    }

    // ==================== 拖拽排序 ====================

    function onDragStart(e, tabId) {
        draggedTabId = tabId;
        e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function onDrop(e, targetTabId) {
        e.preventDefault();
        if (!draggedTabId || draggedTabId === targetTabId) return;

        const fromIndex = state.tabs.findIndex(t => t.id === draggedTabId);
        const toIndex = state.tabs.findIndex(t => t.id === targetTabId);

        if (fromIndex === -1 || toIndex === -1) return;

        const [tab] = state.tabs.splice(fromIndex, 1);
        state.tabs.splice(toIndex, 0, tab);

        render();
        draggedTabId = null;
    }

    // ==================== 未保存提示 ====================

    function showUnsavedModal() {
        const modal = document.getElementById('unsavedModal');
        if (modal) {
            EditorApp.Utils.openModal(modal);
        }
    }

    function hideUnsavedModal() {
        const modal = document.getElementById('unsavedModal');
        if (modal) {
            EditorApp.Utils.closeModal(modal);
        }
        state.pendingCloseTabId = null;
    }

    async function saveAndClose() {
        if (EditorApp.Vditor) {
            await EditorApp.Vditor.saveCurrentFile();
        }
        hideUnsavedModal();
        if (state.pendingCloseTabId) {
            close(state.pendingCloseTabId, true);
        }
    }

    function discardChanges() {
        const tabId = state.pendingCloseTabId;
        hideUnsavedModal();

        if (tabId) {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isDirty = false;
            }
            close(tabId, true);
        }
    }

    // 导出公共接口
    return {
        open: open,
        switch: switchTo,
        close: close,
        render: render,
        onDragStart: onDragStart,
        onDragOver: onDragOver,
        onDrop: onDrop,
        showUnsavedModal: showUnsavedModal,
        hideUnsavedModal: hideUnsavedModal,
        saveAndClose: saveAndClose,
        discardChanges: discardChanges
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.openFile = EditorApp.Tabs.open;
window.switchTab = EditorApp.Tabs.switch;
window.closeTab = EditorApp.Tabs.close;
window.renderTabs = EditorApp.Tabs.render;
window.showUnsavedModal = EditorApp.Tabs.showUnsavedModal;
window.hideUnsavedModal = EditorApp.Tabs.hideUnsavedModal;
window.saveAndClose = EditorApp.Tabs.saveAndClose;
window.discardChanges = EditorApp.Tabs.discardChanges;
// 知识库编辑器 - Vditor 编辑器核心模块
// 提供 Vditor 编辑器创建、文件内容加载保存、图片查看器等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Vditor = (function() {
    'use strict';

    const state = EditorApp.State.getState();
    
    // ==================== Vditor 懒加载 ====================
    
    let vditorLoading = false;
    let vditorLoaded = false;
    
    async function loadVditor() {
        if (vditorLoaded) return;
        if (vditorLoading) {
            // 等待加载完成
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (vditorLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        vditorLoading = true;
        
        try {
            // 加载 CSS
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/static/vendor/vditor/dist/index.css';
            document.head.appendChild(cssLink);
            
            // 加载 highlight.js 主题
            const hljsLink = document.createElement('link');
            hljsLink.id = 'hljsTheme';
            hljsLink.rel = 'stylesheet';
            hljsLink.href = '/static/vendor/vditor/dist/js/highlight.js/styles/github.min.css';
            document.head.appendChild(hljsLink);
            
            // 加载 JS
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/static/vendor/vditor/dist/index.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            vditorLoaded = true;
            console.log('[Vditor] 懒加载完成');
        } catch (error) {
            console.error('[Vditor] 懒加载失败:', error);
            throw error;
        } finally {
            vditorLoading = false;
        }
    }

    // ==================== 主题支持 ====================

    function getVditorTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' ? 'dark' : 'classic';
    }

    function updateAllEditorsTheme() {
        const vditorTheme = getVditorTheme();
        state.editors.forEach((editor) => {
            if (editor && typeof editor.setTheme === 'function') {
                editor.setTheme(vditorTheme, EditorApp.Theme.getHljsStyle());
            }
        });
    }

    // 监听主题变化
    function initThemeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    updateAllEditorsTheme();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // ==================== 文件内容 ====================

    async function loadContent(tab) {
        try {
            const response = await fetch('/api/editor/module?path=' + encodeURIComponent(tab.path));
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            let content = data.data.content;
            
            // 转换相对路径图片为绝对路径（用于编辑器显示）
            const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
            content = content.replace(
                /!\[([^\]]*)\]\((?!https?:\/\/|\/)(images\/[^)]+)\)/gi,
                (_, alt, src) => {
                    // 移除开头的 ./
                    const cleanSrc = src.replace(/^\.\//, '');
                    return `![${alt}](${linkBase}${cleanSrc})`;
                }
            );

            tab.content = content;
            tab.originalContent = data.data.content;

            if (state.activeTabId === tab.id) {
                show(tab);
            }
        } catch (e) {
            EditorApp.Utils.showToast('加载文件失败: ' + e.message, 'error');
            console.error('加载文件失败:', e);
        }
    }

    async function saveCurrentFile(silent = false) {
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab || !tab.isDirty) return;

        try {
            // 保存前将绝对路径转换回相对路径
            let contentToSave = tab.content;
            const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
            
            // 将绝对路径转换回相对路径
            const escapeRegex = linkBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('!\\[([^\\]]*)\\]\\(' + escapeRegex + '([^)]+)\\)', 'gi');
            contentToSave = contentToSave.replace(regex, '![$1]($2)');

            const response = await fetch('/api/editor/module', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: tab.path,
                    content: contentToSave
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            tab.originalContent = tab.content;
            tab.isDirty = false;

            if (EditorApp.Tabs) {
                EditorApp.Tabs.render();
            }
            if (EditorApp.Tree) {
                EditorApp.Tree.render();
            }
            if (!silent) {
                EditorApp.Utils.showToast('保存成功', 'success');
            }

            // 保存后异步刷新 Git 状态
            if (EditorApp.Git) {
                EditorApp.Git.loadStatus().catch(console.error);
            }
        } catch (e) {
            EditorApp.Utils.showToast('保存失败: ' + e.message, 'error');
            console.error('保存失败:', e);
        }
    }

    // ==================== 编辑器管理 ====================

    function show(tab) {
        const container = document.getElementById('editorContainer');
        if (!container) return;

        // 隐藏占位符
        const placeholder = container.querySelector('.editor-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // 隐藏其他编辑器
        container.querySelectorAll('.vditor-container').forEach(el => {
            el.style.display = 'none';
        });
        // 隐藏其他图片查看器
        container.querySelectorAll('.image-viewer-container').forEach(el => {
            el.style.display = 'none';
        });

        // 如果是图片标签
        if (tab.type === 'image') {
            showImageViewer(tab);
            return;
        }

        // 检查是否已有编辑器
        let editorContainer = container.querySelector(`[data-tab-id="${tab.id}"]`);

        if (editorContainer) {
            // 如果内容已加载但编辑器还没创建
            if (tab.content !== null && !state.editors.has(tab.id)) {
                editorContainer.innerHTML = '';
                const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
                create(editorContainer, tab, linkBase);
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

        // 创建 Vditor 编辑器（异步）
        const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
        create(editorContainer, tab, linkBase).catch(err => {
            console.error('[Vditor] 创建编辑器失败:', err);
            EditorApp.Utils.showToast('编辑器加载失败', 'error');
        });
    }

    async function create(container, tab, linkBase = '/api/src/') {
        // 懒加载 Vditor
        await loadVditor();
        
        requestAnimationFrame(() => {
            const editor = new Vditor(container, {
                cdn: '/static/vendor/vditor',
                height: '100%',
                mode: getDefaultMode(),
                theme: getVditorTheme(),
                lang: 'zh_CN',
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
                        style: EditorApp.Theme.getHljsStyle(),
                        lineNumber: true
                    }
                },
                upload: {
                    url: '/api/editor/upload',
                    accept: 'image/*',
                    linkToImgUrl: '',
                    filename(name) {
                        return name.replace(/[^\w\d\._-]/g, '');
                    },
                    extraData: {
                        modulePath: tab.path || ''
                    },
                    format(_, responseText) {
                        const response = JSON.parse(responseText);
                        if (response.code !== 0) {
                            return JSON.stringify({
                                msg: response.msg || '上传失败',
                                code: 1,
                                data: { errFiles: [], succMap: {} }
                            });
                        }
                        
                        const succMap = response.data.succMap || {};
                        const convertedSuccMap = {};
                        for (const [originalName, relPath] of Object.entries(succMap)) {
                            convertedSuccMap[originalName] = linkBase + relPath;
                        }
                        
                        // 上传成功后刷新附件面板
                        if (Object.keys(convertedSuccMap).length > 0 && EditorApp.Attachments) {
                            setTimeout(() => EditorApp.Attachments.load(tab.path), 100);
                        }
                        
                        return JSON.stringify({
                            msg: '',
                            code: 0,
                            data: {
                                errFiles: response.data.errFiles || [],
                                succMap: convertedSuccMap
                            }
                        });
                    }
                },
                after: () => {
                    state.editors.set(tab.id, editor);
                    ensureIrPadding(container);

                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));

                        const vditorElement = container.querySelector('.vditor');
                        if (vditorElement) {
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

                        observeIrPadding(container);
                    }, 50);
                    setTimeout(() => {
                        ensureIrPadding(container);
                    }, 200);
                },
                input: (value) => {
                    tab.content = value;
                    const wasDirty = tab.isDirty;
                    tab.isDirty = value !== tab.originalContent;

                    if (wasDirty !== tab.isDirty) {
                        if (EditorApp.Tabs) {
                            EditorApp.Tabs.render();
                        }
                        if (EditorApp.Tree) {
                            EditorApp.Tree.render();
                        }
                    }
                }
            });
        });
    }

    function showPlaceholder() {
        const container = document.getElementById('editorContainer');
        if (!container) return;

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

        // 隐藏附件面板
        const attachmentPanel = document.getElementById('attachmentPanel');
        if (attachmentPanel) {
            attachmentPanel.style.display = 'none';
        }
    }

    // ==================== 图片查看器 ====================

    function showImageViewer(tab) {
        const container = document.getElementById('editorContainer');
        if (!container) return;

        let viewerContainer = container.querySelector(`[data-tab-id="${tab.id}"]`);

        if (viewerContainer) {
            viewerContainer.style.display = 'flex';
            return;
        }

        viewerContainer = document.createElement('div');
        viewerContainer.className = 'image-viewer-container';
        viewerContainer.dataset.tabId = tab.id;

        const encodedPath = (tab.path.startsWith('/') ? tab.path.substring(1) : tab.path)
            .split('/').map(encodeURIComponent).join('/');
        const imgUrl = '/api/src/' + encodedPath;

        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = tab.title;

        img.onerror = () => {
            viewerContainer.innerHTML = '<div class="error-message">图片加载失败</div>';
        };

        viewerContainer.appendChild(img);
        container.appendChild(viewerContainer);

        if (typeof Viewer !== 'undefined') {
            img.onload = () => {
                new Viewer(img, {
                    toolbar: {
                        zoomIn: 1,
                        zoomOut: 1,
                        oneToOne: 1,
                        reset: 1,
                        prev: 0,
                        play: { show: 1, size: 'large' },
                        next: 0,
                        rotateLeft: 1,
                        rotateRight: 1,
                        flipHorizontal: 1,
                        flipVertical: 1,
                    },
                    navbar: false,
                    title: false,
                    tooltip: true,
                    movable: true,
                    zoomable: true,
                    rotatable: true,
                    scalable: true,
                    transition: false,
                });
            };
        }
    }

    // ==================== 编辑模式 ====================

    function initDefaultMode() {
        const mode = getDefaultMode();
        const select = document.getElementById('defaultEditorMode');
        if (select) {
            select.value = mode;
        }
    }

    function getDefaultMode() {
        const mode = localStorage.getItem('editorDefaultMode') || 'wysiwyg';
        const validModes = ['ir', 'wysiwyg', 'sv'];
        return validModes.includes(mode) ? mode : 'wysiwyg';
    }

    function onModeChange(e) {
        const mode = e.target.value;
        localStorage.setItem('editorDefaultMode', mode);
        EditorApp.Utils.showToast('默认编辑模式已更新', 'success');
    }

    // ==================== IR 模式修复 ====================

    function ensureIrPadding(container) {
        const preList = container.querySelectorAll('.vditor-ir pre.vditor-reset');
        if (!preList.length) return;
        preList.forEach((pre) => {
            pre.style.setProperty('padding', '28px 48px 60px 48px', 'important');
        });
    }

    function observeIrPadding(container) {
        const target = container.querySelector('.vditor');
        if (!target) return;
        const observer = new MutationObserver(() => {
            ensureIrPadding(container);
        });
        observer.observe(target, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    // 初始化主题观察器
    initThemeObserver();

    // 导出公共接口
    return {
        loadContent: loadContent,
        saveCurrentFile: saveCurrentFile,
        show: show,
        create: create,
        showPlaceholder: showPlaceholder,
        showImageViewer: showImageViewer,
        initDefaultMode: initDefaultMode,
        getDefaultMode: getDefaultMode,
        onModeChange: onModeChange,
        ensureIrPadding: ensureIrPadding,
        observeIrPadding: observeIrPadding,
        getVditorTheme: getVditorTheme,
        updateAllEditorsTheme: updateAllEditorsTheme
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.loadFileContent = EditorApp.Vditor.loadContent;
window.saveCurrentFile = EditorApp.Vditor.saveCurrentFile;
window.showEditor = EditorApp.Vditor.show;
window.createVditorEditor = EditorApp.Vditor.create;
window.showPlaceholder = EditorApp.Vditor.showPlaceholder;
window.showImageViewer = EditorApp.Vditor.showImageViewer;
window.initDefaultEditorMode = EditorApp.Vditor.initDefaultMode;
window.getDefaultEditorMode = EditorApp.Vditor.getDefaultMode;
window.onDefaultEditorModeChange = EditorApp.Vditor.onModeChange;
// 知识库编辑器 - 编辑器实例缓存模块
// 使用 LRU 策略缓存编辑器实例，提升标签切换性能

window.EditorApp = window.EditorApp || {};

EditorApp.EditorCache = (function() {
    'use strict';

    // 配置
    const CONFIG = {
        maxSize: 5,           // 最大缓存实例数
        minIdleTime: 30000    // 最小空闲时间（毫秒）才能被淘汰
    };

    // 缓存数据结构
    // key: tabId, value: { editor, container, lastAccess, content }
    const cache = new Map();

    // 访问顺序队列（最近访问的在末尾）
    let accessOrder = [];

    // ==================== 核心方法 ====================

    /**
     * 获取或创建编辑器实例
     * @param {string} tabId - 标签 ID
     * @param {HTMLElement} container - 编辑器容器
     * @param {Object} options - Vditor 配置选项
     * @param {Function} createFn - 创建编辑器的函数
     * @returns {Object|null} 缓存的编辑器实例或 null（需要新建）
     */
    function acquire(tabId, container, options, createFn) {
        // 检查缓存中是否存在
        if (cache.has(tabId)) {
            const entry = cache.get(tabId);
            
            // 更新访问时间
            entry.lastAccess = Date.now();
            updateAccessOrder(tabId);

            console.log('[EditorCache] 命中缓存:', tabId);
            return entry.editor;
        }

        // 缓存未命中，检查是否需要淘汰
        if (cache.size >= CONFIG.maxSize) {
            evictLRU();
        }

        // 返回 null 表示需要创建新实例
        console.log('[EditorCache] 缓存未命中:', tabId);
        return null;
    }

    /**
     * 将编辑器实例添加到缓存
     * @param {string} tabId - 标签 ID
     * @param {Object} editor - Vditor 编辑器实例
     * @param {HTMLElement} container - 编辑器容器
     */
    function add(tabId, editor, container) {
        if (!tabId || !editor) return;

        // 如果已存在，更新
        if (cache.has(tabId)) {
            const entry = cache.get(tabId);
            entry.editor = editor;
            entry.container = container;
            entry.lastAccess = Date.now();
            updateAccessOrder(tabId);
            return;
        }

        // 检查是否需要淘汰
        if (cache.size >= CONFIG.maxSize) {
            evictLRU();
        }

        // 添加新条目
        cache.set(tabId, {
            editor: editor,
            container: container,
            lastAccess: Date.now(),
            content: null
        });

        accessOrder.push(tabId);
        console.log('[EditorCache] 添加缓存:', tabId, '当前大小:', cache.size);
    }

    /**
     * 释放编辑器实例到缓存池
     * @param {string} tabId - 标签 ID
     * @param {boolean} keepInCache - 是否保留在缓存中
     */
    function release(tabId, keepInCache = true) {
        if (!cache.has(tabId)) return;

        const entry = cache.get(tabId);

        if (keepInCache) {
            // 保存当前内容状态
            if (entry.editor && typeof entry.editor.getValue === 'function') {
                entry.content = entry.editor.getValue();
            }
            entry.lastAccess = Date.now();
            console.log('[EditorCache] 释放到缓存:', tabId);
        } else {
            // 完全移除
            remove(tabId);
        }
    }

    /**
     * 从缓存中移除并销毁编辑器实例
     * @param {string} tabId - 标签 ID
     */
    function remove(tabId) {
        if (!cache.has(tabId)) return;

        const entry = cache.get(tabId);

        // 销毁编辑器实例
        if (entry.editor && typeof entry.editor.destroy === 'function') {
            try {
                entry.editor.destroy();
            } catch (e) {
                console.warn('[EditorCache] 销毁编辑器失败:', e);
            }
        }

        // 移除容器
        if (entry.container && entry.container.parentNode) {
            entry.container.parentNode.removeChild(entry.container);
        }

        cache.delete(tabId);
        accessOrder = accessOrder.filter(id => id !== tabId);

        console.log('[EditorCache] 移除缓存:', tabId, '当前大小:', cache.size);
    }

    /**
     * 淘汰最久未使用的实例
     */
    function evictLRU() {
        if (accessOrder.length === 0) return;

        const now = Date.now();

        // 找到可以淘汰的最旧条目
        for (let i = 0; i < accessOrder.length; i++) {
            const tabId = accessOrder[i];
            const entry = cache.get(tabId);

            if (!entry) continue;

            // 检查是否满足最小空闲时间
            if (now - entry.lastAccess >= CONFIG.minIdleTime) {
                console.log('[EditorCache] LRU 淘汰:', tabId);
                remove(tabId);
                return;
            }
        }

        // 如果没有满足空闲时间的，强制淘汰最旧的
        if (accessOrder.length > 0) {
            const oldestId = accessOrder[0];
            console.log('[EditorCache] 强制淘汰:', oldestId);
            remove(oldestId);
        }
    }

    /**
     * 清空所有缓存
     */
    function clear() {
        const ids = Array.from(cache.keys());
        ids.forEach(id => remove(id));
        accessOrder = [];
        console.log('[EditorCache] 缓存已清空');
    }

    // ==================== 辅助方法 ====================

    function updateAccessOrder(tabId) {
        accessOrder = accessOrder.filter(id => id !== tabId);
        accessOrder.push(tabId);
    }

    function has(tabId) {
        return cache.has(tabId);
    }

    function get(tabId) {
        if (!cache.has(tabId)) return null;
        
        const entry = cache.get(tabId);
        entry.lastAccess = Date.now();
        updateAccessOrder(tabId);
        
        return entry.editor;
    }

    function getEntry(tabId) {
        return cache.get(tabId) || null;
    }

    /**
     * 获取缓存统计信息
     */
    function getStats() {
        return {
            size: cache.size,
            maxSize: CONFIG.maxSize,
            entries: Array.from(cache.entries()).map(([id, entry]) => ({
                tabId: id,
                lastAccess: entry.lastAccess,
                hasEditor: !!entry.editor,
                hasContent: !!entry.content
            })),
            accessOrder: [...accessOrder]
        };
    }

    /**
     * 更新配置
     */
    function configure(options) {
        Object.assign(CONFIG, options);
        
        // 如果新的 maxSize 更小，可能需要淘汰
        while (cache.size > CONFIG.maxSize) {
            evictLRU();
        }
    }

    // 导出公共接口
    return {
        acquire: acquire,
        add: add,
        release: release,
        remove: remove,
        evict: evictLRU,
        clear: clear,
        has: has,
        get: get,
        getEntry: getEntry,
        getStats: getStats,
        configure: configure,
        CONFIG: CONFIG
    };
})();
// 知识库编辑器 - Git 面板模块
// 提供 Git 状态、暂存区操作、提交、推送、拉取、远程配置等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Git = (function() {
    'use strict';

    const state = EditorApp.State.getState();
    
    // 模块私有状态
    let gitStagedChanges = [];
    let gitUnstagedChanges = [];

    // ==================== 状态加载 ====================

    async function loadStatus() {
        const container = document.getElementById('gitContent');
        const refreshBtn = document.getElementById('gitRefreshBtn');

        if (refreshBtn) refreshBtn.classList.add('rotating');

        if (!state.gitStatus && container && container.children.length === 0) {
            container.innerHTML = '<div class="git-loading">加载中...</div>';
        }

        try {
            const [statusRes, changesRes] = await Promise.all([
                fetch('/api/git/status'),
                fetch('/api/git/changes')
            ]);

            const statusData = await statusRes.json();
            const changesData = await changesRes.json();

            if (!statusData.success) {
                renderNotRepo(container);
                return;
            }

            state.gitStatus = statusData.data;

            if (changesData.success && changesData.data) {
                gitStagedChanges = (changesData.data.staged || []).filter(c => c.directory === 'src');
                gitUnstagedChanges = (changesData.data.unstaged || []).filter(c => c.directory === 'src');
            } else {
                gitStagedChanges = [];
                gitUnstagedChanges = [];
            }

            renderPanel();
            updateBadge();
        } catch (e) {
            if (!state.gitStatus) {
                if (container) container.innerHTML = '<div class="git-loading">加载失败</div>';
            } else {
                EditorApp.Utils.showToast('Git 状态刷新失败', 'error');
            }
            console.error('加载 Git 状态失败:', e);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('rotating');
        }
    }

    function updateBadge() {
        const badge = document.getElementById('gitBadge');
        if (!badge) return;
        
        const count = gitStagedChanges.length + gitUnstagedChanges.length;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ==================== 面板渲染 ====================

    function renderNotRepo(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="git-status">
                <p style="color: #999; text-align: center;">当前目录不是 Git 仓库</p>
                <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="EditorApp.Git.initRepo()">
                    初始化仓库
                </button>
            </div>
        `;
    }

    function renderPanel() {
        const container = document.getElementById('gitContent');
        if (!container) return;

        if (!state.gitStatus || !state.gitStatus.isRepository) {
            renderNotRepo(container);
            return;
        }

        let html = '';

        // 分支状态
        const remoteTag = state.gitStatus.hasRemote
            ? '<span class="git-remote-tag" title="点击配置远程仓库">🔗 origin</span>'
            : '<span class="git-remote-tag git-no-remote" title="点击配置远程仓库">⚠️ 未配置远程</span>';
        html += `
            <div class="git-status">
                <div class="git-branch">
                    <span class="git-branch-icon">⎇</span>
                    <span>${state.gitStatus.branch || 'main'}</span>
                </div>
                ${remoteTag}
            </div>
        `;

        // 提交区域
        html += `
            <div class="git-commit-section" style="margin-bottom: 12px;">
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="commitMessage" class="git-commit-input" placeholder="提交信息..." style="flex: 1; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px;">
                    <button class="btn btn-primary" onclick="EditorApp.Git.commit()" title="提交暂存的更改" id="gitCommitBtn" style="padding: 6px 12px;">✓</button>
                </div>
                <div class="git-actions" style="display: flex; gap: 6px;">
                    <button class="btn btn-outline btn-sm" onclick="EditorApp.Git.push()" style="flex: 1;">↑ 推送</button>
                    <button class="btn btn-outline btn-sm" onclick="EditorApp.Git.pull()" style="flex: 1;">↓ 拉取</button>
                </div>
            </div>
        `;

        // 暂存的更改区域
        html += renderStagedSection();

        // 更改区域（未暂存）
        html += renderUnstagedSection();

        container.innerHTML = html;
        updateCommitButtonState();
    }

    function renderStagedSection() {
        const count = gitStagedChanges.length;

        let html = `
            <div class="git-changes-section git-staged-section">
                <div class="git-section-header" onclick="EditorApp.Git.toggleSection(this)">
                    <span class="git-section-toggle">▼</span>
                    <span>暂存的更改</span>
                    <span class="git-section-count">${count}</span>
                    <div class="git-section-actions">
                        <button class="git-section-btn" onclick="event.stopPropagation(); EditorApp.Git.unstageAllFiles()" title="取消暂存全部">−</button>
                    </div>
                </div>
                <div class="git-section-content">
        `;

        if (count === 0) {
            html += '<div class="git-empty-hint">没有暂存的更改</div>';
        } else {
            for (const file of gitStagedChanges) {
                html += renderFileItem(file, true);
            }
        }

        html += '</div></div>';
        return html;
    }

    function renderUnstagedSection() {
        const count = gitUnstagedChanges.length;

        let html = `
            <div class="git-changes-section git-unstaged-section">
                <div class="git-section-header" onclick="EditorApp.Git.toggleSection(this)">
                    <span class="git-section-toggle">▼</span>
                    <span>更改</span>
                    <span class="git-section-count">${count}</span>
                    <div class="git-section-actions">
                        <button class="git-section-btn" onclick="event.stopPropagation(); EditorApp.Git.stageAllFiles()" title="暂存全部">+</button>
                    </div>
                </div>
                <div class="git-section-content">
        `;

        if (count === 0) {
            html += '<div class="git-empty-hint">没有更改的文件</div>';
        } else {
            for (const file of gitUnstagedChanges) {
                html += renderFileItem(file, false);
            }
        }

        html += '</div></div>';
        return html;
    }

    function renderFileItem(file, isStaged) {
        const statusLetter = getStatusLetter(file.status);
        const statusClass = getStatusColorClass(file.status);
        const displayPath = file.path.replace('src/', '');
        const escapedPath = EditorApp.Utils.escapeHtmlAttr(file.path);

        let actionsHtml = '';
        if (isStaged) {
            actionsHtml = `<button class="git-file-btn" onclick="EditorApp.Git.unstageFile('${escapedPath}')" title="取消暂存">−</button>`;
        } else {
            actionsHtml = `<button class="git-file-btn git-discard-btn" onclick="EditorApp.Git.discardFile('${escapedPath}')" title="放弃更改">↺</button>` +
                `<button class="git-file-btn" onclick="EditorApp.Git.stageFile('${escapedPath}')" title="暂存">+</button>`;
        }

        return `<div class="git-file-item">
            <span class="git-file-name" title="${escapedPath}">${EditorApp.Utils.escapeHtmlAttr(displayPath)}</span>
            <div class="git-file-actions">${actionsHtml}</div>
            <span class="git-file-status ${statusClass}">${statusLetter}</span>
        </div>`;
    }

    // ==================== 暂存区操作 ====================

    async function stageFile(filePath) {
        try {
            const response = await fetch('/api/git/stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: [filePath] })
            });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('暂存失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('暂存失败: ' + e.message, 'error');
        }
    }

    async function unstageFile(filePath) {
        try {
            const response = await fetch('/api/git/unstage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: [filePath] })
            });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('取消暂存失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('取消暂存失败: ' + e.message, 'error');
        }
    }

    async function stageAllFiles() {
        try {
            const response = await fetch('/api/git/stage-all', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('暂存全部失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('暂存全部失败: ' + e.message, 'error');
        }
    }

    async function unstageAllFiles() {
        try {
            const response = await fetch('/api/git/unstage-all', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('取消暂存全部失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('取消暂存全部失败: ' + e.message, 'error');
        }
    }

    async function discardFile(filePath) {
        const fileName = filePath.split('/').pop();
        if (!confirm('确定要放弃对 "' + fileName + '" 的更改吗？\n\n此操作不可撤销！')) {
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
                EditorApp.Utils.showToast('已放弃更改', 'success');
                await loadStatus();
            } else {
                EditorApp.Utils.showToast('放弃更改失败: ' + data.error, 'error');
            }
        } catch (e) {
            EditorApp.Utils.showToast('放弃更改失败: ' + e.message, 'error');
        }
    }

    // ==================== Git 操作 ====================

    async function initRepo() {
        try {
            const response = await fetch('/api/git/init', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('Git 仓库初始化成功', 'success');
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('初始化失败: ' + e.message, 'error');
        }
    }

    async function commit() {
        const msgInput = document.getElementById('commitMessage');
        let message = msgInput ? msgInput.value.trim() : '';

        if (!message) {
            const now = new Date();
            message = '更新 ' + now.toLocaleString('zh-CN');
        }

        if (gitStagedChanges.length === 0) {
            EditorApp.Utils.showToast('暂存区为空，请先暂存要提交的文件', 'info');
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

            EditorApp.Utils.showToast('提交成功: ' + data.data.hash, 'success');
            if (msgInput) msgInput.value = '';
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('提交失败: ' + e.message, 'error');
        }
    }

    async function push() {
        try {
            const response = await fetch('/api/git/push', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('推送成功', 'success');
            loadStatus();
        } catch (e) {
            EditorApp.Utils.showToast('推送失败: ' + e.message, 'error');
        }
    }

    async function pull() {
        try {
            const response = await fetch('/api/git/pull', { method: 'POST' });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            EditorApp.Utils.showToast('拉取成功', 'success');
            loadStatus();
            if (EditorApp.Tree) {
                EditorApp.Tree.load();
            }
        } catch (e) {
            EditorApp.Utils.showToast('拉取失败: ' + e.message, 'error');
        }
    }

    // ==================== 远程配置 ====================

    async function showRemoteConfig() {
        let currentUrl = '';
        try {
            const response = await fetch('/api/git/remote');
            const data = await response.json();
            if (data.success && data.data) {
                currentUrl = data.data.url || '';
            }
        } catch (e) {
            console.error('[Git] 获取远程配置失败:', e);
        }

        let modal = document.getElementById('gitRemoteModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gitRemoteModal';
            modal.className = 'modal';
            modal.innerHTML = createRemoteConfigModalHTML();
            document.body.appendChild(modal);
        }

        const urlInput = modal.querySelector('#gitRemoteUrl');
        if (urlInput) urlInput.value = currentUrl;

        EditorApp.Utils.openModal(modal);
    }

    function createRemoteConfigModalHTML() {
        return `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h3>🔗 远程仓库配置</h3>
                    <button type="button" class="modal-close" onclick="EditorApp.Git.closeRemoteConfigModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>远程仓库 URL</label>
                        <input type="text" id="gitRemoteUrl" class="form-control"
                               placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git">
                        <small class="form-hint">支持 HTTPS 和 SSH 格式</small>
                    </div>
                    <div class="git-credentials-section">
                        <h4 style="margin: 16px 0 12px; font-size: 0.95rem;">凭据配置（可选）</h4>
                        <div class="form-group">
                            <label>用户名</label>
                            <input type="text" id="gitUsername" class="form-control" placeholder="Git 用户名">
                        </div>
                        <div class="form-group">
                            <label>密码 / Token</label>
                            <input type="password" id="gitPassword" class="form-control" placeholder="密码或 Personal Access Token">
                            <small class="form-hint">推荐使用 Personal Access Token 代替密码</small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="EditorApp.Git.closeRemoteConfigModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="EditorApp.Git.saveRemoteConfig()">保存</button>
                </div>
            </div>
        `;
    }

    function closeRemoteConfigModal() {
        const modal = document.getElementById('gitRemoteModal');
        if (modal) EditorApp.Utils.closeModal(modal);
    }

    async function saveRemoteConfig() {
        const urlInput = document.getElementById('gitRemoteUrl');
        const usernameInput = document.getElementById('gitUsername');
        const passwordInput = document.getElementById('gitPassword');

        const url = urlInput ? urlInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        let hasError = false;

        try {
            if (url) {
                const response = await fetch('/api/git/remote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                const data = await response.json();
                if (!data.success) {
                    EditorApp.Utils.showToast('设置远程仓库失败: ' + data.error, 'error');
                    hasError = true;
                }
            }

            if ((username || password) && !hasError) {
                const credResponse = await fetch('/api/git/credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password: password,
                        token: password
                    })
                });

                const credData = await credResponse.json();
                if (!credData.success) {
                    EditorApp.Utils.showToast('保存凭据失败: ' + credData.error, 'error');
                    hasError = true;
                }
            }

            if (!hasError) {
                EditorApp.Utils.showToast('配置保存成功', 'success');
                closeRemoteConfigModal();
                await loadStatus();
            }
        } catch (e) {
            EditorApp.Utils.showToast('保存配置失败: ' + e.message, 'error');
        }
    }

    // ==================== 工具函数 ====================

    function getStatusLetter(status) {
        const letters = {
            'M': 'M', 'A': 'A', 'D': 'D', 'U': 'U', 'R': 'R',
            'modified': 'M', 'added': 'A', 'deleted': 'D', 'untracked': 'U', 'renamed': 'R'
        };
        return letters[status] || '?';
    }

    function getStatusColorClass(status) {
        const classes = {
            'M': 'status-modified', 'A': 'status-added', 'D': 'status-deleted', 'U': 'status-untracked', 'R': 'status-renamed',
            'modified': 'status-modified', 'added': 'status-added', 'deleted': 'status-deleted', 'untracked': 'status-untracked', 'renamed': 'status-renamed'
        };
        return classes[status] || 'status-unknown';
    }

    function toggleSection(header) {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    }

    function updateCommitButtonState() {
        const btn = document.getElementById('gitCommitBtn');
        if (!btn) return;

        if (gitStagedChanges.length === 0) {
            btn.disabled = true;
            btn.title = '暂存区为空，无法提交';
        } else {
            btn.disabled = false;
            btn.title = '提交暂存的更改';
        }
    }

    // 导出公共接口
    return {
        loadStatus: loadStatus,
        updateBadge: updateBadge,
        renderPanel: renderPanel,
        renderNotRepo: renderNotRepo,
        stageFile: stageFile,
        unstageFile: unstageFile,
        stageAllFiles: stageAllFiles,
        unstageAllFiles: unstageAllFiles,
        discardFile: discardFile,
        initRepo: initRepo,
        commit: commit,
        push: push,
        pull: pull,
        showRemoteConfig: showRemoteConfig,
        saveRemoteConfig: saveRemoteConfig,
        closeRemoteConfigModal: closeRemoteConfigModal,
        getStatusLetter: getStatusLetter,
        getStatusColorClass: getStatusColorClass,
        toggleSection: toggleSection
    };
})();

// 为了向后兼容，将常用函数暴露到全局作用域
window.loadGitStatus = EditorApp.Git.loadStatus;
window.updateGitBadge = EditorApp.Git.updateBadge;
window.renderGitPanel = EditorApp.Git.renderPanel;
window.stageFile = EditorApp.Git.stageFile;
window.unstageFile = EditorApp.Git.unstageFile;
window.stageAllFiles = EditorApp.Git.stageAllFiles;
window.unstageAllFiles = EditorApp.Git.unstageAllFiles;
window.discardFile = EditorApp.Git.discardFile;
window.initGitRepo = EditorApp.Git.initRepo;
window.commitChanges = EditorApp.Git.commit;
window.pushChanges = EditorApp.Git.push;
window.pullChanges = EditorApp.Git.pull;
window.showRemoteConfig = EditorApp.Git.showRemoteConfig;
window.toggleGitSection = EditorApp.Git.toggleSection;
// 知识库编辑器 - 文件操作模块
// 包含新建、重命名、删除文件和右键菜单功能

(function() {
    'use strict';

    window.EditorApp = window.EditorApp || {};

    // ==================== 文件操作功能 ====================

    function showNewFileModal() {
        const state = EditorApp.State.getState();
        const modal = document.getElementById('newFileModal');
        document.getElementById('newFilePath').value = '';

        // 如果有选中的目录，预填路径
        if (state.contextMenuTarget && state.contextMenuTarget.type === 'directory') {
            document.getElementById('newFilePath').value = state.contextMenuTarget.path + '/';
        }

        EditorApp.Utils.openModal(modal);
    }

    function hideNewFileModal() {
        EditorApp.Utils.closeModal(document.getElementById('newFileModal'));
    }

    async function createNewFile() {
        let path = document.getElementById('newFilePath').value.trim();

        if (!path) {
            EditorApp.Utils.showToast('请输入文件路径', 'warning');
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
            EditorApp.Utils.showToast('文件创建成功', 'success');

            await EditorApp.Tree.load();
            EditorApp.Tabs.open(path);
        } catch (e) {
            EditorApp.Utils.showToast('创建失败: ' + e.message, 'error');
        }
    }

    function showRenameModal() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const modal = document.getElementById('renameModal');
        document.getElementById('newFileName').value = state.contextMenuTarget.name;
        state.renameTarget = state.contextMenuTarget;

        EditorApp.Utils.openModal(modal);
    }

    function hideRenameModal() {
        const state = EditorApp.State.getState();
        EditorApp.Utils.closeModal(document.getElementById('renameModal'));
        state.renameTarget = null;
    }

    async function confirmRename() {
        const state = EditorApp.State.getState();
        if (!state.renameTarget) return;

        const newName = document.getElementById('newFileName').value.trim();
        if (!newName) {
            EditorApp.Utils.showToast('请输入新文件名', 'warning');
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
            EditorApp.Utils.showToast('重命名成功', 'success');

            // 更新标签
            const tab = state.tabs.find(t => t.path === oldPath);
            if (tab) {
                tab.path = newPath;
                tab.title = newName.replace('.md', '');
                EditorApp.Tabs.render();
            }

            await EditorApp.Tree.load();
        } catch (e) {
            EditorApp.Utils.showToast('重命名失败: ' + e.message, 'error');
        }
    }

    function showDeleteModal() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const modal = document.getElementById('deleteModal');
        const message = document.getElementById('deleteMessage');
        message.textContent = `确定要删除 "${state.contextMenuTarget.name}" 吗？此操作不可撤销。`;

        EditorApp.Utils.openModal(modal);
    }

    function hideDeleteModal() {
        EditorApp.Utils.closeModal(document.getElementById('deleteModal'));
    }

    async function confirmDelete() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        const path = state.contextMenuTarget.path;
        const isImage = state.contextMenuTarget.type === 'image';

        try {
            // 根据文件类型选择不同的 API
            const apiUrl = isImage 
                ? '/api/editor/image/' + encodeURIComponent(path)
                : '/api/editor/module/' + encodeURIComponent(path);
            
            const response = await fetch(apiUrl, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            hideDeleteModal();
            EditorApp.Utils.showToast('删除成功', 'success');

            // 关闭相关标签
            const tab = state.tabs.find(t => t.path === path);
            if (tab) {
                EditorApp.Tabs.close(tab.id, true);
            }

            await EditorApp.Tree.load();
        } catch (e) {
            EditorApp.Utils.showToast('删除失败: ' + e.message, 'error');
        }
    }

    // ==================== 右键菜单 ====================

    function showContextMenu(e, item) {
        e.preventDefault();
        e.stopPropagation();

        const state = EditorApp.State.getState();
        state.contextMenuTarget = item;

        const menu = document.getElementById('contextMenu');
        
        // 根据文件类型显示/隐藏菜单项
        const isImage = item.type === 'image';
        const isDirectory = item.type === 'directory';
        const isFile = item.type === 'file';
        
        // 获取菜单项
        const newItem = menu.querySelector('[data-action="new"]');
        const newFolderItem = menu.querySelector('[data-action="newFolder"]');
        const renameItem = menu.querySelector('[data-action="rename"]');
        const deleteItem = menu.querySelector('[data-action="delete"]');
        const historyItem = menu.querySelector('[data-action="history"]');
        const dividers = menu.querySelectorAll('.context-divider');
        
        // 图片文件：只显示删除
        if (isImage) {
            if (newItem) newItem.style.display = 'none';
            if (newFolderItem) newFolderItem.style.display = 'none';
            if (renameItem) renameItem.style.display = 'none';
            if (historyItem) historyItem.style.display = 'none';
            dividers.forEach(d => d.style.display = 'none');
            if (deleteItem) deleteItem.style.display = 'block';
        } else {
            // 其他文件类型：显示所有菜单项
            if (newItem) newItem.style.display = 'block';
            if (newFolderItem) newFolderItem.style.display = 'block';
            if (renameItem) renameItem.style.display = isDirectory ? 'none' : 'block';
            dividers.forEach(d => d.style.display = 'block');
            if (deleteItem) deleteItem.style.display = 'block';
            // 只对文件显示历史选项
            if (historyItem) historyItem.style.display = isFile ? 'block' : 'none';
        }
        
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
                EditorApp.Utils.showToast('新建文件夹功能开发中', 'warning');
                break;
            case 'rename':
                showRenameModal();
                break;
            case 'delete':
                showDeleteModal();
                break;
            case 'history':
                showVersionHistory();
                break;
        }
    }

    function showVersionHistory() {
        const state = EditorApp.State.getState();
        if (!state.contextMenuTarget) return;

        // 只对文件显示历史
        if (state.contextMenuTarget.type === 'directory') {
            EditorApp.Utils.showToast('请选择一个文件查看历史', 'warning');
            return;
        }

        if (EditorApp.VersionHistory) {
            EditorApp.VersionHistory.show(state.contextMenuTarget.path);
        } else {
            EditorApp.Utils.showToast('版本历史功能未加载', 'warning');
        }
    }

    // ==================== 暴露接口 ====================

    EditorApp.Files = {
        showNewModal: showNewFileModal,
        hideNewModal: hideNewFileModal,
        create: createNewFile,
        showRenameModal: showRenameModal,
        hideRenameModal: hideRenameModal,
        confirmRename: confirmRename,
        showDeleteModal: showDeleteModal,
        hideDeleteModal: hideDeleteModal,
        confirmDelete: confirmDelete,
        showContextMenu: showContextMenu,
        hideContextMenu: hideContextMenu,
        onContextMenu: onContextMenu,
        onContextAction: onContextAction
    };

    // 暴露到全局作用域（向后兼容）
    window.showNewFileModal = showNewFileModal;
    window.hideNewFileModal = hideNewFileModal;
    window.createNewFile = createNewFile;
    window.showRenameModal = showRenameModal;
    window.hideRenameModal = hideRenameModal;
    window.confirmRename = confirmRename;
    window.showDeleteModal = showDeleteModal;
    window.hideDeleteModal = hideDeleteModal;
    window.confirmDelete = confirmDelete;
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.onContextMenu = onContextMenu;
    window.onContextAction = onContextAction;

})();
// 知识库编辑器 - 附件面板模块
// 包含附件加载、预览、复制引用、删除等功能

(function() {
    'use strict';

    window.EditorApp = window.EditorApp || {};

    // ==================== 悬停预览功能 ====================

    let hoverPreviewTimer = null;

    // 显示悬停预览
    function showHoverPreview(e, attachment, card) {
        // 清除之前的定时器
        if (hoverPreviewTimer) {
            clearTimeout(hoverPreviewTimer);
        }

        // 延迟显示，避免快速划过时闪烁
        hoverPreviewTimer = setTimeout(() => {
            const state = EditorApp.State.getState();
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (!tab) return;

            const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
            const imgUrl = linkBase + attachment.path;

            // 创建或获取悬停预览元素
            let preview = document.getElementById('attachmentHoverPreview');
            if (!preview) {
                preview = document.createElement('div');
                preview.id = 'attachmentHoverPreview';
                preview.className = 'attachment-hover-preview';
                preview.innerHTML = `
                    <img src="" alt="">
                    <div class="attachment-hover-name"></div>
                `;
                document.body.appendChild(preview);
            }

            const img = preview.querySelector('img');
            const nameEl = preview.querySelector('.attachment-hover-name');
            
            img.src = imgUrl;
            img.alt = attachment.name;
            nameEl.textContent = attachment.name;

            // 定位预览框
            positionHoverPreview(e, preview);
            preview.classList.add('visible');
        }, 300);
    }

    // 隐藏悬停预览
    function hideHoverPreview() {
        if (hoverPreviewTimer) {
            clearTimeout(hoverPreviewTimer);
            hoverPreviewTimer = null;
        }

        const preview = document.getElementById('attachmentHoverPreview');
        if (preview) {
            preview.classList.remove('visible');
        }
    }

    // 更新悬停预览位置
    function updateHoverPreviewPosition(e) {
        const preview = document.getElementById('attachmentHoverPreview');
        if (preview && preview.classList.contains('visible')) {
            positionHoverPreview(e, preview);
        }
    }

    // 计算并设置预览框位置
    function positionHoverPreview(e, preview) {
        const padding = 16;
        const previewWidth = 320;
        const previewHeight = 240;

        let left = e.clientX + padding;
        let top = e.clientY - previewHeight - padding;

        // 确保不超出右边界
        if (left + previewWidth > window.innerWidth) {
            left = e.clientX - previewWidth - padding;
        }

        // 确保不超出上边界，改为显示在下方
        if (top < padding) {
            top = e.clientY + padding;
        }

        // 确保不超出下边界
        if (top + previewHeight > window.innerHeight) {
            top = window.innerHeight - previewHeight - padding;
        }

        preview.style.left = left + 'px';
        preview.style.top = top + 'px';
    }

    // ==================== 附件面板功能 ====================

    // 加载附件列表
    async function loadAttachments(modulePath) {
        const state = EditorApp.State.getState();
        
        if (!modulePath) {
            state.attachments = [];
            renderAttachmentPanel();
            return;
        }

        state.attachmentLoading = true;
        renderAttachmentPanel();

        try {
            const response = await fetch('/api/editor/attachments?path=' + encodeURIComponent(modulePath));
            const data = await response.json();

            if (data.success) {
                state.attachments = data.data?.attachments || [];
            } else {
                state.attachments = [];
                console.error('加载附件失败:', data.error);
            }
        } catch (e) {
            state.attachments = [];
            console.error('加载附件失败:', e);
        } finally {
            state.attachmentLoading = false;
            renderAttachmentPanel();
        }
    }

    // 渲染附件面板
    function renderAttachmentPanel() {
        const state = EditorApp.State.getState();
        const panel = document.getElementById('attachmentPanel');
        const strip = document.getElementById('attachmentStrip');
        const empty = document.getElementById('attachmentEmpty');
        const count = document.getElementById('attachmentCount');

        if (!panel) return;

        // 如果没有打开的标签，隐藏面板
        if (!state.activeTabId) {
            panel.style.display = 'none';
            return;
        }

        // 获取当前标签
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab || tab.type === 'image') {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';

        // 更新计数
        count.textContent = state.attachments.length;

        // 更新折叠状态
        panel.classList.toggle('collapsed', !state.attachmentExpanded);

        // 加载中状态
        if (state.attachmentLoading) {
            strip.innerHTML = '<div class="attachment-loading">加载中...</div>';
            empty.style.display = 'none';
            return;
        }

        // 空状态
        if (state.attachments.length === 0) {
            strip.innerHTML = '';
            empty.style.display = 'flex';
            // 隐藏滚动指示器
            const leftIndicator = document.querySelector('.attachment-scroll-left');
            const rightIndicator = document.querySelector('.attachment-scroll-right');
            if (leftIndicator) leftIndicator.style.display = 'none';
            if (rightIndicator) rightIndicator.style.display = 'none';
            return;
        }

        // 渲染附件缩略图条
        empty.style.display = 'none';
        strip.innerHTML = '';

        state.attachments.forEach(attachment => {
            const card = document.createElement('div');
            card.className = 'attachment-card';
            card.dataset.path = attachment.path;
            card.dataset.name = attachment.name;
            card.title = attachment.name;

            // 缩略图容器
            const thumb = document.createElement('div');
            thumb.className = 'attachment-thumb';
            
            const img = document.createElement('img');
            // 构建图片 URL
            const currentTab = state.tabs.find(t => t.id === state.activeTabId);
            if (currentTab) {
                const linkBase = EditorApp.Utils.calculateLinkBase(currentTab.path);
                img.src = linkBase + attachment.path;
            }
            img.alt = attachment.name;
            img.onerror = () => {
                thumb.innerHTML = '<span class="attachment-thumb-fallback">🖼️</span>';
            };
            thumb.appendChild(img);
            card.appendChild(thumb);

            // 文件信息
            const info = document.createElement('div');
            info.className = 'attachment-info';

            // 文件名
            const name = document.createElement('span');
            name.className = 'attachment-name';
            name.textContent = attachment.name;
            name.title = attachment.name;
            info.appendChild(name);

            // 文件大小
            if (attachment.size !== undefined) {
                const size = document.createElement('span');
                size.className = 'attachment-size';
                size.textContent = EditorApp.Utils.formatFileSize(attachment.size);
                info.appendChild(size);
            }

            card.appendChild(info);

            // 点击复制引用
            card.onclick = () => copyImageReference(attachment);

            // 双击预览
            card.ondblclick = (e) => {
                e.stopPropagation();
                previewAttachment(attachment);
            };

            // 鼠标悬停预览大图
            card.onmouseenter = (e) => showHoverPreview(e, attachment, card);
            card.onmouseleave = hideHoverPreview;
            card.onmousemove = (e) => updateHoverPreviewPosition(e);

            // 右键菜单
            card.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showAttachmentContextMenu(e, attachment);
            };

            strip.appendChild(card);
        });

        // 延迟更新滚动指示器（等待DOM渲染完成）
        setTimeout(updateScrollIndicators, 50);
    }

    // 切换附件面板折叠状态
    function toggleAttachmentPanel() {
        const state = EditorApp.State.getState();
        state.attachmentExpanded = !state.attachmentExpanded;
        localStorage.setItem('attachmentExpanded', state.attachmentExpanded ? '1' : '0');
        renderAttachmentPanel();
    }

    // ==================== 复制引用功能 ====================

    // 复制图片 Markdown 引用
    function copyImageReference(attachment) {
        const state = EditorApp.State.getState();
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        const rawPath = attachment.path || attachment.fullPath || '';
        const normalizedPath = rawPath.replace(/^\/+/, '');
        const encodedPath = EditorApp.Utils.encodePathSegments(normalizedPath);

        let markdownPath = '';
        if (tab && attachment.path) {
            const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
            const encodedRelative = EditorApp.Utils.encodePathSegments(attachment.path.replace(/^\/+/, ''));
            markdownPath = linkBase + encodedRelative;
        } else {
            markdownPath = `/api/src/${encodedPath}`;
        }

        const reference = `![${attachment.name}](${markdownPath})`;
        navigator.clipboard.writeText(reference).then(() => {
            EditorApp.Utils.showToast('已复制: ' + reference, 'success');
        }).catch(e => {
            console.error('复制失败:', e);
            EditorApp.Utils.showToast('复制失败', 'error');
        });
    }

    // 预览附件
    function previewAttachment(attachment) {
        const state = EditorApp.State.getState();
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab) return;

        const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
        const imgUrl = linkBase + attachment.path;

        // 创建预览模态框
        let modal = document.getElementById('attachmentPreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'attachmentPreviewModal';
            modal.className = 'modal attachment-preview-modal';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="EditorApp.Attachments.closePreview()"></div>
                <div class="modal-content attachment-preview-content">
                    <button class="modal-close" onclick="EditorApp.Attachments.closePreview()">×</button>
                    <img id="attachmentPreviewImg" src="" alt="">
                </div>
            `;
            document.body.appendChild(modal);
        }

        const img = document.getElementById('attachmentPreviewImg');
        img.src = imgUrl;
        img.alt = attachment.name;

        EditorApp.Utils.openModal(modal);

        // 初始化 Viewer.js（如果可用）
        if (typeof Viewer !== 'undefined') {
            img.onload = () => {
                if (img._viewer) {
                    img._viewer.destroy();
                }
                img._viewer = new Viewer(img, {
                    toolbar: {
                        zoomIn: 1,
                        zoomOut: 1,
                        oneToOne: 1,
                        reset: 1,
                        rotateLeft: 1,
                        rotateRight: 1,
                        flipHorizontal: 1,
                        flipVertical: 1,
                    },
                    navbar: false,
                    title: false,
                    tooltip: true,
                    transition: false,
                });
            };
        }
    }

    // 关闭附件预览
    function closeAttachmentPreview() {
        const modal = document.getElementById('attachmentPreviewModal');
        if (modal) {
            EditorApp.Utils.closeModal(modal);
        }
    }

    // 显示附件右键菜单
    function showAttachmentContextMenu(e, attachment) {
        const state = EditorApp.State.getState();
        state.attachmentTarget = attachment;

        const menu = document.getElementById('attachmentContextMenu');
        if (!menu) return;

        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        // 确保菜单不超出视口
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (e.pageX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (e.pageY - rect.height) + 'px';
        }
    }

    // 隐藏附件右键菜单
    function hideAttachmentContextMenu() {
        const state = EditorApp.State.getState();
        const menu = document.getElementById('attachmentContextMenu');
        if (menu) {
            menu.style.display = 'none';
        }
        state.attachmentTarget = null;
    }

    // 处理附件右键菜单操作
    function onAttachmentContextAction(action) {
        const state = EditorApp.State.getState();
        const attachment = state.attachmentTarget;
        if (!attachment) return;

        hideAttachmentContextMenu();

        switch (action) {
            case 'copyRef':
                copyImageReference(attachment);
                break;
            case 'preview':
                previewAttachment(attachment);
                break;
            case 'renameAttachment':
                showRenameAttachmentPrompt(attachment);
                break;
            case 'deleteAttachment':
                deleteAttachment(attachment);
                break;
        }
    }

    // 显示重命名附件提示
    function showRenameAttachmentPrompt(attachment) {
        const newName = prompt('请输入新文件名:', attachment.name);
        if (!newName || newName === attachment.name) return;

        renameAttachment(attachment, newName);
    }

    // 重命名附件
    async function renameAttachment(attachment, newName) {
        const state = EditorApp.State.getState();
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab) return;

        try {
            const response = await fetch('/api/editor/attachment/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modulePath: tab.path,
                    oldName: attachment.name,
                    newName: newName
                })
            });
            const data = await response.json();

            if (data.success) {
                EditorApp.Utils.showToast('附件已重命名', 'success');
                loadAttachments(tab.path);
            } else {
                EditorApp.Utils.showToast('重命名失败: ' + data.error, 'error');
            }
        } catch (e) {
            console.error('重命名附件失败:', e);
            EditorApp.Utils.showToast('重命名失败', 'error');
        }
    }

    // 删除附件
    async function deleteAttachment(attachment) {
        if (!confirm(`确定要删除附件 "${attachment.name}" 吗？`)) {
            return;
        }

        const state = EditorApp.State.getState();
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab) return;

        // 构建完整路径
        const dir = tab.path.substring(0, tab.path.lastIndexOf('/'));
        const fullPath = dir ? dir + '/' + attachment.path : attachment.path;

        try {
            const response = await fetch('/api/editor/module?path=' + encodeURIComponent(fullPath), {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                EditorApp.Utils.showToast('附件已删除', 'success');
                loadAttachments(tab.path);
            } else {
                EditorApp.Utils.showToast('删除失败: ' + data.error, 'error');
            }
        } catch (e) {
            console.error('删除附件失败:', e);
            EditorApp.Utils.showToast('删除失败', 'error');
        }
    }

    // 初始化附件面板事件
    function init() {
        const state = EditorApp.State.getState();
        
        // 加载保存的展开状态（默认折叠）
        const savedExpanded = localStorage.getItem('attachmentExpanded');
        state.attachmentExpanded = savedExpanded === '1';

        // 折叠/展开按钮
        const toggleBtn = document.getElementById('attachmentToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleAttachmentPanel);
        }

        // 刷新按钮
        const refreshBtn = document.getElementById('attachmentRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const tab = state.tabs.find(t => t.id === state.activeTabId);
                if (tab) {
                    loadAttachments(tab.path);
                }
            });
        }

        // 附件右键菜单事件
        document.querySelectorAll('#attachmentContextMenu .context-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                onAttachmentContextAction(action);
            });
        });

        // 点击其他地方隐藏附件右键菜单
        document.addEventListener('click', hideAttachmentContextMenu);

        // 初始化横向滚动功能
        initAttachmentScroll();
    }

    // 初始化附件缩略图条横向滚动
    function initAttachmentScroll() {
        const strip = document.getElementById('attachmentStrip');
        if (!strip) return;

        // 鼠标滚轮横向滚动
        strip.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                strip.scrollLeft += e.deltaY;
                updateScrollIndicators();
            }
        }, { passive: false });

        // 监听滚动更新指示器
        strip.addEventListener('scroll', updateScrollIndicators);

        // 滚动指示器点击事件
        const leftIndicator = document.querySelector('.attachment-scroll-left');
        const rightIndicator = document.querySelector('.attachment-scroll-right');

        if (leftIndicator) {
            leftIndicator.addEventListener('click', () => {
                strip.scrollBy({ left: -200, behavior: 'smooth' });
            });
        }

        if (rightIndicator) {
            rightIndicator.addEventListener('click', () => {
                strip.scrollBy({ left: 200, behavior: 'smooth' });
            });
        }
    }

    // 更新滚动指示器显示状态
    function updateScrollIndicators() {
        const strip = document.getElementById('attachmentStrip');
        const leftIndicator = document.querySelector('.attachment-scroll-left');
        const rightIndicator = document.querySelector('.attachment-scroll-right');

        if (!strip || !leftIndicator || !rightIndicator) return;

        const canScrollLeft = strip.scrollLeft > 0;
        const canScrollRight = strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;

        leftIndicator.style.display = canScrollLeft ? 'flex' : 'none';
        rightIndicator.style.display = canScrollRight ? 'flex' : 'none';
    }

    // ==================== 暴露接口 ====================

    EditorApp.Attachments = {
        init: init,
        initScroll: initAttachmentScroll,
        load: loadAttachments,
        render: renderAttachmentPanel,
        toggle: toggleAttachmentPanel,
        copyReference: copyImageReference,
        preview: previewAttachment,
        closePreview: closeAttachmentPreview,
        rename: renameAttachment,
        delete: deleteAttachment,
        showContextMenu: showAttachmentContextMenu,
        hideContextMenu: hideAttachmentContextMenu,
        onContextAction: onAttachmentContextAction,
        updateScrollIndicators: updateScrollIndicators
    };

    // 暴露到全局作用域（向后兼容）
    window.loadAttachments = loadAttachments;
    window.renderAttachmentPanel = renderAttachmentPanel;
    window.toggleAttachmentPanel = toggleAttachmentPanel;
    window.copyImageReference = copyImageReference;
    window.previewAttachment = previewAttachment;
    window.closeAttachmentPreview = closeAttachmentPreview;
    window.showAttachmentContextMenu = showAttachmentContextMenu;
    window.hideAttachmentContextMenu = hideAttachmentContextMenu;
    window.onAttachmentContextAction = onAttachmentContextAction;
    window.initAttachmentPanel = init;

})();
// 知识库编辑器 - 快速打开模块
// 提供 Ctrl+P 快速打开文件功能，支持模糊搜索和最近文件

window.EditorApp = window.EditorApp || {};

EditorApp.QuickOpen = (function() {
    'use strict';

    let dialogElement = null;
    let inputElement = null;
    let resultsElement = null;
    let allFiles = [];

    // ==================== 初始化 ====================

    function init() {
        createDialog();
        bindEvents();
    }

    function createDialog() {
        if (dialogElement) return;

        dialogElement = document.createElement('div');
        dialogElement.id = 'quickOpenDialog';
        dialogElement.className = 'quick-open-dialog';
        dialogElement.innerHTML = `
            <div class="quick-open-content">
                <div class="quick-open-input-wrapper">
                    <span class="quick-open-icon">🔍</span>
                    <input type="text" class="quick-open-input" placeholder="输入文件名搜索...">
                </div>
                <div class="quick-open-results"></div>
            </div>
        `;
        document.body.appendChild(dialogElement);

        inputElement = dialogElement.querySelector('.quick-open-input');
        resultsElement = dialogElement.querySelector('.quick-open-results');
    }

    function bindEvents() {
        if (!dialogElement) return;

        // 点击背景关闭
        dialogElement.addEventListener('click', (e) => {
            if (e.target === dialogElement) {
                hide();
            }
        });

        // 输入搜索
        inputElement.addEventListener('input', () => {
            const query = inputElement.value.trim();
            const results = search(query);
            renderResults(results, query);
        });

        // 键盘导航
        inputElement.addEventListener('keydown', onKeyDown);
    }

    // ==================== 显示/隐藏 ====================

    function show() {
        const state = EditorApp.State.getState();
        state.quickOpen.visible = true;
        state.quickOpen.query = '';
        state.quickOpen.selectedIndex = 0;

        // 收集所有文件
        collectAllFiles();

        if (!dialogElement) createDialog();

        dialogElement.classList.add('visible');
        inputElement.value = '';
        inputElement.focus();

        // 显示最近文件
        const recentFiles = EditorApp.RecentFiles ? EditorApp.RecentFiles.getList() : [];
        renderResults(recentFiles.slice(0, 10), '', true);
    }

    function hide() {
        const state = EditorApp.State.getState();
        state.quickOpen.visible = false;

        if (dialogElement) {
            dialogElement.classList.remove('visible');
        }
    }

    // ==================== 文件收集 ====================

    function collectAllFiles() {
        const state = EditorApp.State.getState();
        allFiles = [];
        if (state.fileTree) {
            flattenTree(state.fileTree, '');
        }
    }

    function flattenTree(node, parentPath) {
        if (!node) return;

        const currentPath = parentPath ? parentPath + '/' + node.name : node.name;

        if (node.type === 'file') {
            allFiles.push({
                path: currentPath,
                name: node.name,
                displayName: currentPath
            });
        }

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => flattenTree(child, currentPath));
        }
    }

    // ==================== 搜索 ====================

    function search(query) {
        if (!query) {
            // 空查询返回最近文件
            const recentFiles = EditorApp.RecentFiles ? EditorApp.RecentFiles.getList() : [];
            return recentFiles.slice(0, 10);
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        allFiles.forEach(file => {
            const lowerName = file.name.toLowerCase();
            const lowerPath = file.path.toLowerCase();

            // 检查是否匹配
            if (lowerName.includes(lowerQuery) || lowerPath.includes(lowerQuery)) {
                const matchRanges = findMatchRanges(file.name, query);
                const score = calculateScore(file, query);
                results.push({
                    ...file,
                    matchRanges: matchRanges,
                    score: score
                });
            }
        });

        // 按分数排序
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, 20);
    }

    function findMatchRanges(text, query) {
        const ranges = [];
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let startIndex = 0;

        while (true) {
            const index = lowerText.indexOf(lowerQuery, startIndex);
            if (index === -1) break;
            ranges.push([index, index + query.length]);
            startIndex = index + 1;
        }

        return ranges;
    }

    function calculateScore(file, query) {
        const lowerName = file.name.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let score = 0;

        // 文件名开头匹配加分
        if (lowerName.startsWith(lowerQuery)) {
            score += 100;
        }

        // 文件名包含匹配加分
        if (lowerName.includes(lowerQuery)) {
            score += 50;
        }

        // 完全匹配加分
        if (lowerName === lowerQuery) {
            score += 200;
        }

        // 最近打开的文件加分
        const recentFiles = EditorApp.RecentFiles ? EditorApp.RecentFiles.getList() : [];
        const recentIndex = recentFiles.findIndex(f => f.path === file.path);
        if (recentIndex !== -1) {
            score += (20 - recentIndex);
        }

        return score;
    }

    // ==================== 渲染 ====================

    function renderResults(results, query, isRecent) {
        const state = EditorApp.State.getState();
        state.quickOpen.results = results;
        state.quickOpen.selectedIndex = 0;

        if (results.length === 0) {
            resultsElement.innerHTML = `
                <div class="quick-open-empty">
                    ${query ? '没有找到匹配的文件' : '没有最近打开的文件'}
                </div>
            `;
            return;
        }

        const html = results.map((file, index) => {
            const isSelected = index === state.quickOpen.selectedIndex;
            const highlightedName = query ? highlightMatches(file.name, query) : file.name;
            const icon = getFileIcon(file.name);

            return `
                <div class="quick-open-item ${isSelected ? 'selected' : ''}" 
                     data-path="${EditorApp.Utils.escapeHtmlAttr(file.path)}"
                     data-index="${index}">
                    <span class="quick-open-item-icon">${icon}</span>
                    <span class="quick-open-item-name">${highlightedName}</span>
                    <span class="quick-open-item-path">${EditorApp.Utils.escapeHtmlAttr(file.path)}</span>
                    ${isRecent ? '<span class="quick-open-item-recent">最近</span>' : ''}
                </div>
            `;
        }).join('');

        resultsElement.innerHTML = html;

        // 绑定点击事件
        resultsElement.querySelectorAll('.quick-open-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                selectFile(path);
            });
        });
    }

    function highlightMatches(text, query) {
        if (!query) return EditorApp.Utils.escapeHtmlAttr(text);

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let result = '';
        let lastIndex = 0;

        let index = lowerText.indexOf(lowerQuery);
        while (index !== -1) {
            result += EditorApp.Utils.escapeHtmlAttr(text.substring(lastIndex, index));
            result += '<mark>' + EditorApp.Utils.escapeHtmlAttr(text.substring(index, index + query.length)) + '</mark>';
            lastIndex = index + query.length;
            index = lowerText.indexOf(lowerQuery, lastIndex);
        }

        result += EditorApp.Utils.escapeHtmlAttr(text.substring(lastIndex));
        return result;
    }

    function getFileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            'md': '📝',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️',
            'yaml': '⚙️',
            'yml': '⚙️',
            'json': '⚙️'
        };
        return icons[ext] || '📄';
    }

    // ==================== 键盘导航 ====================

    function onKeyDown(e) {
        const state = EditorApp.State.getState();
        const results = state.quickOpen.results;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateDown();
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateUp();
                break;
            case 'Enter':
                e.preventDefault();
                if (results.length > 0) {
                    const selected = results[state.quickOpen.selectedIndex];
                    if (selected) {
                        selectFile(selected.path);
                    }
                }
                break;
            case 'Escape':
                e.preventDefault();
                hide();
                break;
        }
    }

    function navigateUp() {
        const state = EditorApp.State.getState();
        if (state.quickOpen.selectedIndex > 0) {
            state.quickOpen.selectedIndex--;
            updateSelection();
        }
    }

    function navigateDown() {
        const state = EditorApp.State.getState();
        if (state.quickOpen.selectedIndex < state.quickOpen.results.length - 1) {
            state.quickOpen.selectedIndex++;
            updateSelection();
        }
    }

    function updateSelection() {
        const state = EditorApp.State.getState();
        const items = resultsElement.querySelectorAll('.quick-open-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === state.quickOpen.selectedIndex);
        });

        // 滚动到可见区域
        const selectedItem = items[state.quickOpen.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    // ==================== 文件选择 ====================

    function selectFile(path) {
        hide();

        // 添加到最近文件
        if (EditorApp.RecentFiles) {
            EditorApp.RecentFiles.add(path);
        }

        // 打开文件
        if (EditorApp.Tabs && EditorApp.Tabs.open) {
            EditorApp.Tabs.open(path);
        }
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        search: search,
        selectFile: selectFile,
        navigateUp: navigateUp,
        navigateDown: navigateDown
    };
})();
// 知识库编辑器 - 命令面板模块
// 提供 Ctrl+Shift+P 命令面板功能，支持命令搜索和执行

window.EditorApp = window.EditorApp || {};

EditorApp.CommandPalette = (function() {
    'use strict';

    let dialogElement = null;
    let inputElement = null;
    let resultsElement = null;
    const commands = [];

    // ==================== 初始化 ====================

    function init() {
        createDialog();
        bindEvents();
        registerDefaultCommands();
    }

    function createDialog() {
        if (dialogElement) return;

        dialogElement = document.createElement('div');
        dialogElement.id = 'commandPaletteDialog';
        dialogElement.className = 'command-palette-dialog';
        dialogElement.innerHTML = `
            <div class="command-palette-content">
                <div class="command-palette-input-wrapper">
                    <span class="command-palette-icon">></span>
                    <input type="text" class="command-palette-input" placeholder="输入命令...">
                </div>
                <div class="command-palette-results"></div>
            </div>
        `;
        document.body.appendChild(dialogElement);

        inputElement = dialogElement.querySelector('.command-palette-input');
        resultsElement = dialogElement.querySelector('.command-palette-results');
    }

    function bindEvents() {
        if (!dialogElement) return;

        // 点击背景关闭
        dialogElement.addEventListener('click', (e) => {
            if (e.target === dialogElement) {
                hide();
            }
        });

        // 输入搜索
        inputElement.addEventListener('input', () => {
            const query = inputElement.value.trim();
            const results = search(query);
            renderResults(results, query);
        });

        // 键盘导航
        inputElement.addEventListener('keydown', onKeyDown);
    }

    // ==================== 命令注册 ====================

    function register(command) {
        if (!command || !command.id || !command.label || !command.action) {
            console.warn('无效的命令配置:', command);
            return;
        }

        // 检查是否已存在
        const existingIndex = commands.findIndex(c => c.id === command.id);
        if (existingIndex !== -1) {
            commands[existingIndex] = command;
        } else {
            commands.push(command);
        }
    }

    function registerDefaultCommands() {
        // 文件操作
        register({
            id: 'file.save',
            label: '保存文件',
            shortcut: 'Ctrl+S',
            category: '文件',
            action: () => EditorApp.Vditor && EditorApp.Vditor.saveCurrentFile()
        });

        register({
            id: 'file.close',
            label: '关闭当前标签',
            shortcut: 'Ctrl+W',
            category: '文件',
            action: () => {
                const state = EditorApp.State.getState();
                if (state.activeTabId && EditorApp.Tabs) {
                    EditorApp.Tabs.close(state.activeTabId);
                }
            }
        });

        register({
            id: 'file.new',
            label: '新建文件',
            category: '文件',
            action: () => EditorApp.Files && EditorApp.Files.showNewModal()
        });

        register({
            id: 'file.refresh',
            label: '刷新文件树',
            category: '文件',
            action: () => EditorApp.Tree && EditorApp.Tree.load()
        });

        // 视图操作
        register({
            id: 'view.toggleFileTree',
            label: '切换文件树面板',
            category: '视图',
            action: () => EditorApp.Layout && EditorApp.Layout.toggleFileTree()
        });

        register({
            id: 'view.toggleGitPanel',
            label: '切换 Git 面板',
            category: '视图',
            action: () => EditorApp.Layout && EditorApp.Layout.toggleGitPanel()
        });

        register({
            id: 'view.toggleFocusMode',
            label: '切换专注模式',
            category: '视图',
            action: () => EditorApp.Layout && EditorApp.Layout.toggleFocusMode()
        });

        // 主题操作
        register({
            id: 'theme.light',
            label: '切换到浅色主题',
            category: '主题',
            action: () => {
                const themeState = EditorApp.State.getThemeState();
                themeState.theme = 'light';
                localStorage.setItem('uiTheme', 'light');
                EditorApp.Theme && EditorApp.Theme.apply();
            }
        });

        register({
            id: 'theme.dark',
            label: '切换到深色主题',
            category: '主题',
            action: () => {
                const themeState = EditorApp.State.getThemeState();
                themeState.theme = 'dark';
                localStorage.setItem('uiTheme', 'dark');
                EditorApp.Theme && EditorApp.Theme.apply();
            }
        });

        // Git 操作
        register({
            id: 'git.refresh',
            label: '刷新 Git 状态',
            category: 'Git',
            action: () => EditorApp.Git && EditorApp.Git.loadStatus()
        });

        // 快速打开
        register({
            id: 'quickOpen.show',
            label: '快速打开文件',
            shortcut: 'Ctrl+P',
            category: '导航',
            action: () => EditorApp.QuickOpen && EditorApp.QuickOpen.show()
        });
    }

    function getCommands() {
        return commands.slice();
    }

    // ==================== 显示/隐藏 ====================

    function show() {
        const state = EditorApp.State.getState();
        state.commandPalette.visible = true;
        state.commandPalette.query = '';
        state.commandPalette.selectedIndex = 0;

        if (!dialogElement) createDialog();

        dialogElement.classList.add('visible');
        inputElement.value = '';
        inputElement.focus();

        // 显示所有命令
        renderResults(commands, '');
    }

    function hide() {
        const state = EditorApp.State.getState();
        state.commandPalette.visible = false;

        if (dialogElement) {
            dialogElement.classList.remove('visible');
        }
    }

    // ==================== 搜索 ====================

    function search(query) {
        if (!query) {
            return commands.slice();
        }

        const lowerQuery = query.toLowerCase();
        return commands.filter(cmd => {
            const lowerLabel = cmd.label.toLowerCase();
            const lowerCategory = (cmd.category || '').toLowerCase();
            return lowerLabel.includes(lowerQuery) || lowerCategory.includes(lowerQuery);
        });
    }

    // ==================== 渲染 ====================

    function renderResults(results, query) {
        const state = EditorApp.State.getState();
        state.commandPalette.filteredCommands = results;
        state.commandPalette.selectedIndex = 0;

        if (results.length === 0) {
            resultsElement.innerHTML = `
                <div class="command-palette-empty">没有找到匹配的命令</div>
            `;
            return;
        }

        const html = results.map((cmd, index) => {
            const isSelected = index === state.commandPalette.selectedIndex;
            const highlightedLabel = query ? highlightMatches(cmd.label, query) : cmd.label;

            return `
                <div class="command-palette-item ${isSelected ? 'selected' : ''}" 
                     data-id="${EditorApp.Utils.escapeHtmlAttr(cmd.id)}"
                     data-index="${index}">
                    <span class="command-palette-item-category">${cmd.category || ''}</span>
                    <span class="command-palette-item-label">${highlightedLabel}</span>
                    ${cmd.shortcut ? `<span class="command-palette-item-shortcut">${cmd.shortcut}</span>` : ''}
                </div>
            `;
        }).join('');

        resultsElement.innerHTML = html;

        // 绑定点击事件
        resultsElement.querySelectorAll('.command-palette-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                execute(id);
            });
        });
    }

    function highlightMatches(text, query) {
        if (!query) return EditorApp.Utils.escapeHtmlAttr(text);

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let result = '';
        let lastIndex = 0;

        let index = lowerText.indexOf(lowerQuery);
        while (index !== -1) {
            result += EditorApp.Utils.escapeHtmlAttr(text.substring(lastIndex, index));
            result += '<mark>' + EditorApp.Utils.escapeHtmlAttr(text.substring(index, index + query.length)) + '</mark>';
            lastIndex = index + query.length;
            index = lowerText.indexOf(lowerQuery, lastIndex);
        }

        result += EditorApp.Utils.escapeHtmlAttr(text.substring(lastIndex));
        return result;
    }

    // ==================== 键盘导航 ====================

    function onKeyDown(e) {
        const state = EditorApp.State.getState();
        const results = state.commandPalette.filteredCommands;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateDown();
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateUp();
                break;
            case 'Enter':
                e.preventDefault();
                if (results.length > 0) {
                    const selected = results[state.commandPalette.selectedIndex];
                    if (selected) {
                        execute(selected.id);
                    }
                }
                break;
            case 'Escape':
                e.preventDefault();
                hide();
                break;
        }
    }

    function navigateUp() {
        const state = EditorApp.State.getState();
        if (state.commandPalette.selectedIndex > 0) {
            state.commandPalette.selectedIndex--;
            updateSelection();
        }
    }

    function navigateDown() {
        const state = EditorApp.State.getState();
        if (state.commandPalette.selectedIndex < state.commandPalette.filteredCommands.length - 1) {
            state.commandPalette.selectedIndex++;
            updateSelection();
        }
    }

    function updateSelection() {
        const state = EditorApp.State.getState();
        const items = resultsElement.querySelectorAll('.command-palette-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === state.commandPalette.selectedIndex);
        });

        // 滚动到可见区域
        const selectedItem = items[state.commandPalette.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    // ==================== 命令执行 ====================

    function execute(commandId) {
        const cmd = commands.find(c => c.id === commandId);
        if (cmd && typeof cmd.action === 'function') {
            hide();
            try {
                cmd.action();
            } catch (e) {
                console.error('命令执行失败:', commandId, e);
                EditorApp.Utils.showToast('命令执行失败', 'error');
            }
        }
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        search: search,
        execute: execute,
        register: register,
        getCommands: getCommands,
        navigateUp: navigateUp,
        navigateDown: navigateDown
    };
})();
// 知识库编辑器 - 自动保存模块
// 提供定时自动保存功能，支持配置和状态指示

window.EditorApp = window.EditorApp || {};

EditorApp.AutoSave = (function() {
    'use strict';

    const STORAGE_KEY = 'editorAutoSave';
    const DEFAULT_INTERVAL = 30; // 秒

    // ==================== 初始化 ====================

    function init() {
        loadSettings();
        start();
        updateStatusUI();
    }

    function loadSettings() {
        const state = EditorApp.State.getState();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                state.autoSave.enabled = settings.enabled !== false;
                state.autoSave.interval = settings.interval || DEFAULT_INTERVAL;
            }
        } catch (e) {
            console.warn('加载自动保存设置失败:', e);
        }
    }

    function saveSettings() {
        const state = EditorApp.State.getState();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                enabled: state.autoSave.enabled,
                interval: state.autoSave.interval
            }));
        } catch (e) {
            console.warn('保存自动保存设置失败:', e);
        }
    }

    // ==================== 定时器管理 ====================

    function start() {
        const state = EditorApp.State.getState();

        // 清除现有定时器
        if (state.autoSave.timerId) {
            clearInterval(state.autoSave.timerId);
            state.autoSave.timerId = null;
        }

        if (!state.autoSave.enabled) return;

        // 启动新定时器
        state.autoSave.timerId = setInterval(() => {
            save();
        }, state.autoSave.interval * 1000);
    }

    function stop() {
        const state = EditorApp.State.getState();
        if (state.autoSave.timerId) {
            clearInterval(state.autoSave.timerId);
            state.autoSave.timerId = null;
        }
    }

    // ==================== 保存操作 ====================

    async function save() {
        const state = EditorApp.State.getState();

        // 检查是否有未保存的更改
        const dirtyTabs = state.tabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) return;

        try {
            // 保存当前活动文件
            if (state.activeTabId) {
                const activeTab = state.tabs.find(t => t.id === state.activeTabId);
                if (activeTab && activeTab.isDirty) {
                    await EditorApp.Vditor.saveCurrentFile(true); // 静默保存
                    state.autoSave.lastSaveTime = new Date();
                    updateStatusUI();
                }
            }
        } catch (e) {
            console.error('自动保存失败:', e);
            EditorApp.Utils.showToast('自动保存失败', 'error');
        }
    }

    // ==================== 设置管理 ====================

    function getSettings() {
        const state = EditorApp.State.getState();
        return {
            enabled: state.autoSave.enabled,
            interval: state.autoSave.interval
        };
    }

    function updateSettings(settings) {
        const state = EditorApp.State.getState();

        if (typeof settings.enabled === 'boolean') {
            state.autoSave.enabled = settings.enabled;
        }

        if (typeof settings.interval === 'number' && settings.interval > 0) {
            state.autoSave.interval = settings.interval;
        }

        saveSettings();

        // 重启定时器
        stop();
        start();
    }

    function getLastSaveTime() {
        const state = EditorApp.State.getState();
        return state.autoSave.lastSaveTime;
    }

    // ==================== UI 更新 ====================

    function updateStatusUI() {
        const state = EditorApp.State.getState();
        const statusElement = document.getElementById('autoSaveStatus');

        if (!statusElement) return;

        if (!state.autoSave.enabled) {
            statusElement.textContent = '自动保存: 关闭';
            statusElement.classList.remove('active');
            return;
        }

        if (state.autoSave.lastSaveTime) {
            const time = formatTime(state.autoSave.lastSaveTime);
            statusElement.textContent = `上次保存: ${time}`;
        } else {
            statusElement.textContent = `自动保存: ${state.autoSave.interval}秒`;
        }
        statusElement.classList.add('active');
    }

    function formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // 导出公共接口
    return {
        init: init,
        start: start,
        stop: stop,
        save: save,
        getSettings: getSettings,
        updateSettings: updateSettings,
        getLastSaveTime: getLastSaveTime,
        updateStatusUI: updateStatusUI
    };
})();
// 知识库编辑器 - 面包屑导航模块
// 提供文件路径面包屑导航功能

window.EditorApp = window.EditorApp || {};

EditorApp.Breadcrumb = (function() {
    'use strict';

    const MAX_VISIBLE_ITEMS = 4;
    let containerElement = null;

    // ==================== 初始化 ====================

    function init() {
        containerElement = document.getElementById('breadcrumbNav');
    }

    // ==================== 路径解析 ====================

    function parsePath(path) {
        if (!path) return [];

        const segments = path.split('/').filter(s => s);
        const items = [];
        let currentPath = '';

        segments.forEach((segment, index) => {
            currentPath = currentPath ? currentPath + '/' + segment : segment;
            items.push({
                name: segment,
                path: currentPath,
                isLast: index === segments.length - 1
            });
        });

        return items;
    }

    // ==================== 更新和渲染 ====================

    function update(path) {
        if (!containerElement) {
            containerElement = document.getElementById('breadcrumbNav');
        }
        if (!containerElement) return;

        const items = parsePath(path);
        render(items);
    }


    function render(items) {
        if (!containerElement) return;

        if (items.length === 0) {
            containerElement.innerHTML = '';
            containerElement.style.display = 'none';
            return;
        }

        containerElement.style.display = 'flex';

        // 处理长路径折叠
        let displayItems = items;
        let hasEllipsis = false;

        if (items.length > MAX_VISIBLE_ITEMS) {
            // 保留第一个和最后几个
            const firstItem = items[0];
            const lastItems = items.slice(-(MAX_VISIBLE_ITEMS - 1));
            displayItems = [firstItem, { name: '...', path: '', isEllipsis: true }, ...lastItems];
            hasEllipsis = true;
        }

        const html = displayItems.map((item, index) => {
            if (item.isEllipsis) {
                return `<span class="breadcrumb-ellipsis">...</span>`;
            }

            const isClickable = !item.isLast;
            const itemClass = item.isLast ? 'breadcrumb-item current' : 'breadcrumb-item';

            return `
                <span class="${itemClass}" 
                      ${isClickable ? `data-path="${EditorApp.Utils.escapeHtmlAttr(item.path)}"` : ''}>
                    ${EditorApp.Utils.escapeHtmlAttr(item.name)}
                </span>
                ${!item.isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
            `;
        }).join('');

        containerElement.innerHTML = html;

        // 绑定点击事件
        containerElement.querySelectorAll('.breadcrumb-item[data-path]').forEach(el => {
            el.addEventListener('click', () => {
                const path = el.dataset.path;
                navigateTo(path);
            });
        });
    }

    // ==================== 导航 ====================

    function navigateTo(dirPath) {
        if (!dirPath) return;

        // 在文件树中展开并选中目录
        if (EditorApp.Tree && EditorApp.Tree.expandTo) {
            EditorApp.Tree.expandTo(dirPath);
        }
    }

    // 导出公共接口
    return {
        init: init,
        update: update,
        render: render,
        navigateTo: navigateTo,
        parsePath: parsePath
    };
})();
// 知识库编辑器 - 版本历史模块
// 提供文件 Git 历史查看和版本对比功能

window.EditorApp = window.EditorApp || {};

EditorApp.VersionHistory = (function() {
    'use strict';

    // 内部状态
    let currentPath = null;
    let commits = [];
    let selectedCommit = null;
    let isVisible = false;

    // DOM 元素
    let panel = null;
    let commitList = null;
    let contentViewer = null;

    // ==================== 初始化 ====================

    function init() {
        createPanel();
        bindEvents();
        console.log('[VersionHistory] 初始化完成');
    }

    function createPanel() {
        // 检查是否已存在
        if (document.getElementById('versionHistoryPanel')) {
            panel = document.getElementById('versionHistoryPanel');
            commitList = panel.querySelector('.history-commit-list');
            contentViewer = panel.querySelector('.history-content-viewer');
            return;
        }

        panel = document.createElement('div');
        panel.id = 'versionHistoryPanel';
        panel.className = 'version-history-panel';
        panel.innerHTML = `
            <div class="history-header">
                <h3>版本历史</h3>
                <button class="history-close-btn" title="关闭">×</button>
            </div>
            <div class="history-body">
                <div class="history-sidebar">
                    <div class="history-file-path"></div>
                    <div class="history-commit-list"></div>
                </div>
                <div class="history-main">
                    <div class="history-content-header">
                        <span class="history-commit-info"></span>
                    </div>
                    <div class="history-content-viewer">
                        <div class="history-placeholder">选择一个版本查看内容</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        commitList = panel.querySelector('.history-commit-list');
        contentViewer = panel.querySelector('.history-content-viewer');
    }

    function bindEvents() {
        if (!panel) return;

        // 关闭按钮
        const closeBtn = panel.querySelector('.history-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hide);
        }

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isVisible) {
                hide();
            }
        });
    }

    // ==================== 显示/隐藏 ====================

    async function show(path) {
        if (!path) {
            EditorApp.Utils.showToast('请先选择一个文件', 'warning');
            return;
        }

        currentPath = path;
        isVisible = true;

        // 显示面板
        if (panel) {
            panel.classList.add('is-open');
        }

        // 更新文件路径显示
        const filePathEl = panel.querySelector('.history-file-path');
        if (filePathEl) {
            filePathEl.textContent = path;
        }

        // 清空之前的内容
        if (commitList) {
            commitList.innerHTML = '<div class="history-loading">加载中...</div>';
        }
        if (contentViewer) {
            contentViewer.innerHTML = '<div class="history-placeholder">选择一个版本查看内容</div>';
        }

        // 加载历史
        try {
            await loadHistory(path);
        } catch (e) {
            console.error('[VersionHistory] 加载历史失败:', e);
            EditorApp.Utils.showToast('加载版本历史失败: ' + e.message, 'error');
        }
    }

    function hide() {
        isVisible = false;
        currentPath = null;
        commits = [];
        selectedCommit = null;

        if (panel) {
            panel.classList.remove('is-open');
        }
    }

    // ==================== 数据加载 ====================

    async function loadHistory(path) {
        const response = await fetch('/api/git/file-history?path=' + encodeURIComponent(path) + '&limit=50');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '获取历史失败');
        }

        commits = data.data.commits || [];
        renderCommitList();
    }

    async function loadVersionContent(commit) {
        if (!currentPath || !commit) return;

        selectedCommit = commit;

        // 更新提交信息显示
        const commitInfo = panel.querySelector('.history-commit-info');
        if (commitInfo) {
            commitInfo.innerHTML = `
                <span class="commit-hash">${commit.shortHash}</span>
                <span class="commit-author">${commit.author}</span>
                <span class="commit-date">${commit.date}</span>
            `;
        }

        // 显示加载状态
        if (contentViewer) {
            contentViewer.innerHTML = '<div class="history-loading">加载中...</div>';
        }

        try {
            const response = await fetch(
                '/api/git/file-show?path=' + encodeURIComponent(currentPath) +
                '&commit=' + encodeURIComponent(commit.hash)
            );
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '获取文件内容失败');
            }

            renderContent(data.data.content);
        } catch (e) {
            console.error('[VersionHistory] 加载版本内容失败:', e);
            if (contentViewer) {
                contentViewer.innerHTML = `<div class="history-error">加载失败: ${e.message}</div>`;
            }
        }
    }

    // ==================== 渲染 ====================

    function renderCommitList() {
        if (!commitList) return;

        if (commits.length === 0) {
            commitList.innerHTML = '<div class="history-empty">此文件没有版本历史</div>';
            return;
        }

        commitList.innerHTML = '';

        commits.forEach((commit, index) => {
            const item = document.createElement('div');
            item.className = 'history-commit-item';
            item.dataset.index = index;

            item.innerHTML = `
                <div class="commit-header">
                    <span class="commit-hash">${commit.shortHash}</span>
                    <span class="commit-date">${commit.date}</span>
                </div>
                <div class="commit-message">${escapeHtml(commit.message)}</div>
                <div class="commit-author">${escapeHtml(commit.author)}</div>
            `;

            item.addEventListener('click', () => {
                // 更新选中状态
                commitList.querySelectorAll('.history-commit-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');

                // 加载内容
                loadVersionContent(commit);
            });

            commitList.appendChild(item);
        });
    }

    function renderContent(content) {
        if (!contentViewer) return;

        // 创建代码高亮显示
        const pre = document.createElement('pre');
        pre.className = 'history-content-code';

        const code = document.createElement('code');
        code.className = 'language-markdown';
        code.textContent = content;

        pre.appendChild(code);
        contentViewer.innerHTML = '';
        contentViewer.appendChild(pre);

        // 如果有 hljs，进行语法高亮
        if (typeof hljs !== 'undefined') {
            hljs.highlightElement(code);
        }
    }

    // ==================== 工具函数 ====================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isOpen() {
        return isVisible;
    }

    function getCurrentPath() {
        return currentPath;
    }

    function getCommits() {
        return commits;
    }

    // 导出公共接口
    return {
        init: init,
        show: show,
        hide: hide,
        loadHistory: loadHistory,
        loadVersionContent: loadVersionContent,
        isOpen: isOpen,
        getCurrentPath: getCurrentPath,
        getCommits: getCommits
    };
})();
// 知识库编辑器 - 主入口模块
// 负责初始化所有模块和绑定全局事件

(function() {
    'use strict';

    window.EditorApp = window.EditorApp || {};

    // ==================== 初始化 ====================

    // 初始化 AI 聊天模块
    function initChatModule() {
        // 等待聊天模块加载完成
        if (typeof ChatContext === 'undefined' || typeof ChatConfig === 'undefined' || typeof ChatPanel === 'undefined') {
            console.warn('Chat modules not loaded yet, retrying...');
            setTimeout(initChatModule, 100);
            return;
        }

        // 初始化上下文管理器
        window.chatContext = new ChatContext();

        // 初始化配置管理器
        window.chatConfig = new ChatConfig();

        // 初始化聊天面板
        window.chatPanel = new ChatPanel();

        // 设置编辑器引用
        if (window.vditor) {
            window.chatContext.setEditor(window.vditor);
        }

        // 监听文件切换事件,更新当前文件
        document.addEventListener('fileOpened', (e) => {
            if (e.detail && e.detail.path) {
                window.chatContext.setCurrentFile(e.detail.path);
            }
        });

        // 添加快捷键支持 (Ctrl+Shift+L)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                const panel = document.getElementById('chatPanel');
                if (panel && panel.classList.contains('collapsed')) {
                    EditorApp.Layout.toggleChatPanel();
                }
                const input = document.getElementById('chat-input');
                if (input) {
                    input.focus();
                }
            }
        });

        console.log('AI Chat module initialized');
    }

    function init() {
        // 初始化主题
        EditorApp.Theme.init();

        // 加载布局偏好
        EditorApp.Layout.loadPreferences();

        // 初始化文件树
        EditorApp.Tree.load();

        // 初始化 Git 面板（仅在面板展开时加载）
        const state = EditorApp.State.getState();
        if (!state.gitPanelCollapsed) {
            EditorApp.Git.loadStatus();
        }

        // 初始化默认编辑模式选择
        EditorApp.Vditor.initDefaultMode();

        // 绑定事件
        bindEvents();

        // 应用布局
        EditorApp.Layout.apply();
        EditorApp.Layout.applyFocusMode();

        // 初始化附件面板
        EditorApp.Attachments.init();

        // 初始化新模块
        if (EditorApp.Loading) EditorApp.Loading.init();
        if (EditorApp.RecentFiles) EditorApp.RecentFiles.init();
        if (EditorApp.QuickOpen) EditorApp.QuickOpen.init();
        if (EditorApp.CommandPalette) EditorApp.CommandPalette.init();
        if (EditorApp.AutoSave) EditorApp.AutoSave.init();
        if (EditorApp.Breadcrumb) EditorApp.Breadcrumb.init();
        if (EditorApp.VersionHistory) EditorApp.VersionHistory.init();

        // 初始化 AI 聊天模块
        initChatModule();
    }

    // ==================== 事件绑定 ====================

    function bindEvents() {
        // 面板切换按钮
        document.getElementById('toggleFileTree').addEventListener('click', EditorApp.Layout.toggleFileTree);
        document.getElementById('toggleGitPanel').addEventListener('click', EditorApp.Layout.toggleGitPanel);
        document.getElementById('toggleChatPanel').addEventListener('click', EditorApp.Layout.toggleChatPanel);

        // 文件树操作
        document.getElementById('newFileBtn').addEventListener('click', EditorApp.Files.showNewModal);
        document.getElementById('refreshTreeBtn').addEventListener('click', EditorApp.Tree.load);
        document.getElementById('fileSearch').addEventListener('input', EditorApp.Tree.onSearchInput);

        // Git 操作
        document.getElementById('gitRefreshBtn').addEventListener('click', EditorApp.Git.loadStatus);

        // 默认编辑模式
        const modeSelect = document.getElementById('defaultEditorMode');
        if (modeSelect) {
            modeSelect.addEventListener('change', EditorApp.Vditor.onModeChange);
        }

        // Git 远程标签点击事件（事件委托）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.git-remote-tag')) {
                EditorApp.Git.showRemoteConfig();
            }
        });

        // 拖拽调整宽度
        EditorApp.Layout.initResizers();

        // 右键菜单
        document.addEventListener('contextmenu', EditorApp.Files.onContextMenu);
        document.addEventListener('click', EditorApp.Files.hideContextMenu);
        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', EditorApp.Files.onContextAction);
        });

        // 主题控制
        EditorApp.Theme.initControls();

        // 键盘快捷键
        document.addEventListener('keydown', onKeyDown);

        // 离开页面提示
        window.addEventListener('beforeunload', onBeforeUnload);

        // 返回按钮
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', onBackClick);
        }
    }

    // ==================== 键盘快捷键 ====================

    function onKeyDown(e) {
        const state = EditorApp.State.getState();
        
        // Ctrl+S 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            EditorApp.Vditor.saveCurrentFile();
        }

        // Ctrl+W 关闭标签
        if (e.ctrlKey && e.key === 'w') {
            e.preventDefault();
            if (state.activeTabId) {
                EditorApp.Tabs.close(state.activeTabId);
            }
        }

        // Ctrl+P 快速打开
        if (e.ctrlKey && !e.shiftKey && e.key === 'p') {
            e.preventDefault();
            if (EditorApp.QuickOpen) {
                EditorApp.QuickOpen.show();
            }
        }

        // Ctrl+Shift+P 命令面板
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            if (EditorApp.CommandPalette) {
                EditorApp.CommandPalette.show();
            }
        }

        // Ctrl+Shift+A 切换聊天面板
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            EditorApp.Layout.toggleChatPanel();
        }

        // Escape 关闭菜单/模态框/对话框
        if (e.key === 'Escape') {
            EditorApp.Files.hideContextMenu();
            if (EditorApp.QuickOpen && state.quickOpen && state.quickOpen.visible) {
                EditorApp.QuickOpen.hide();
            }
            if (EditorApp.CommandPalette && state.commandPalette && state.commandPalette.visible) {
                EditorApp.CommandPalette.hide();
            }
        }
    }

    // ==================== 未保存提示 ====================

    function showUnsavedModal() {
        EditorApp.Utils.openModal(document.getElementById('unsavedModal'));
    }

    function hideUnsavedModal() {
        const state = EditorApp.State.getState();
        EditorApp.Utils.closeModal(document.getElementById('unsavedModal'));
        state.pendingCloseTabId = null;
    }

    async function saveAndClose() {
        const state = EditorApp.State.getState();
        await EditorApp.Vditor.saveCurrentFile();
        hideUnsavedModal();
        if (state.pendingCloseTabId) {
            EditorApp.Tabs.close(state.pendingCloseTabId, true);
        }
    }

    function discardChanges() {
        const state = EditorApp.State.getState();
        const tabId = state.pendingCloseTabId; // 先保存 tabID
        hideUnsavedModal(); // 这会清空 pendingCloseTabId

        if (tabId) {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isDirty = false;
            }
            EditorApp.Tabs.close(tabId, true);
        }
    }

    function onBeforeUnload(e) {
        const state = EditorApp.State.getState();
        const hasUnsaved = state.tabs.some(t => t.isDirty);
        if (hasUnsaved) {
            e.preventDefault();
            e.returnValue = '有未保存的更改，确定要离开吗？';
            return e.returnValue;
        }
    }

    function onBackClick(e) {
        const state = EditorApp.State.getState();
        const hasUnsaved = state.tabs.some(t => t.isDirty);
        if (hasUnsaved) {
            e.preventDefault();
            if (confirm('有未保存的更改，确定要离开吗？')) {
                window.location.href = '/';
            }
        }
    }

    // ==================== 暴露接口 ====================

    EditorApp.init = init;
    EditorApp.Main = {
        init: init,
        bindEvents: bindEvents,
        onKeyDown: onKeyDown,
        showUnsavedModal: showUnsavedModal,
        hideUnsavedModal: hideUnsavedModal,
        saveAndClose: saveAndClose,
        discardChanges: discardChanges
    };

    // 暴露到全局作用域（向后兼容）
    window.showUnsavedModal = showUnsavedModal;
    window.hideUnsavedModal = hideUnsavedModal;
    window.saveAndClose = saveAndClose;
    window.discardChanges = discardChanges;

    // DOM 加载完成后初始化
    document.addEventListener('DOMContentLoaded', init);

})();
