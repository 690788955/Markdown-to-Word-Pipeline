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
