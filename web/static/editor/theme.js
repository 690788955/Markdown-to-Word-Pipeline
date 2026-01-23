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
