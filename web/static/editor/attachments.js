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
