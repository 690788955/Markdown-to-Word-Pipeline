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
