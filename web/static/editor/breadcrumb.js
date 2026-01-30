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
