// 知识库编辑器 - Vditor 编辑器核心模块
// 提供 Vditor 编辑器创建、文件内容加载保存、图片查看器等功能

window.EditorApp = window.EditorApp || {};

EditorApp.Vditor = (function() {
    'use strict';

    const state = EditorApp.State.getState();

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

        // 创建 Vditor 编辑器
        const linkBase = EditorApp.Utils.calculateLinkBase(tab.path);
        create(editorContainer, tab, linkBase);
    }

    function create(container, tab, linkBase = '/api/src/') {
        requestAnimationFrame(() => {
            const editor = new Vditor(container, {
                cdn: '/static/vendor/vditor',
                height: '100%',
                mode: getDefaultMode(),
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
        observeIrPadding: observeIrPadding
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
