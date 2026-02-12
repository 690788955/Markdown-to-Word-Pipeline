// chat.js - AI 聊天面板组件

class ChatPanel {
    constructor() {
        this.messages = [];
        this.isStreaming = false;
        this.currentStreamMessage = null;
        this.abortController = null;
        this.mentionState = {
            active: false,
            start: 0,
            end: 0,
            query: '',
            options: [],
            selectedIndex: 0
        };
        this.mentionMenuEl = null;

        this.init();
    }

    init() {
        this.attachEventListeners();
        this.loadHistory();
        this.updateWelcomeVisibility();
    }

    attachEventListeners() {
        // Send button
        document.getElementById('chat-send-btn').addEventListener('click', () => this.sendMessage());

        // Stop button
        const stopBtn = document.getElementById('chat-stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopStreaming());
        }

        // New chat button
        const newBtn = document.getElementById('chat-new-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.clearHistory());
        }

        // Input hotkeys, mention menu, auto-resize
        const input = document.getElementById('chat-input');
        input.addEventListener('keydown', (e) => {
            if (this.handleMentionKeydown(e, input)) {
                return;
            }

            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });
        input.addEventListener('input', () => {
            this.handleMentionInput(input);
            this.autoResizeInput(input);
        });
        input.addEventListener('click', () => this.handleMentionInput(input));
        input.addEventListener('focus', () => this.handleMentionInput(input));
        input.addEventListener('blur', () => {
            window.setTimeout(() => this.hideMentionMenu(), 120);
        });

        document.addEventListener('click', (e) => {
            if (!this.mentionMenuEl || !this.mentionState.active) {
                return;
            }

            if (e.target === input || this.mentionMenuEl.contains(e.target)) {
                return;
            }

            this.hideMentionMenu();
        });

        // Settings button
        const settingsBtn = document.getElementById('chat-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (window.chatConfig) {
                    window.chatConfig.show();
                }
            });
        }
    }

    autoResizeInput(input) {
        input.style.height = 'auto';
        const newHeight = Math.min(input.scrollHeight, 120);
        input.style.height = newHeight + 'px';
    }

    // ==================== Mention 相关 ====================

    handleMentionInput(input) {
        const mentionContext = this.getMentionContextAtCursor(input);
        if (!mentionContext) {
            this.hideMentionMenu();
            return;
        }

        const options = this.getMentionCandidates(mentionContext.query);
        if (options.length === 0) {
            this.hideMentionMenu();
            return;
        }

        this.mentionState.active = true;
        this.mentionState.start = mentionContext.start;
        this.mentionState.end = mentionContext.end;
        this.mentionState.query = mentionContext.query;
        this.mentionState.options = options;
        this.mentionState.selectedIndex = 0;

        this.renderMentionMenu(input);
    }

    handleMentionKeydown(e, input) {
        if (!this.mentionState.active || this.mentionState.options.length === 0) {
            return false;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.mentionState.selectedIndex = (this.mentionState.selectedIndex + 1) % this.mentionState.options.length;
                this.renderMentionMenu(input);
                return true;

            case 'ArrowUp':
                e.preventDefault();
                this.mentionState.selectedIndex = (this.mentionState.selectedIndex - 1 + this.mentionState.options.length) % this.mentionState.options.length;
                this.renderMentionMenu(input);
                return true;

            case 'Enter':
                if (!e.ctrlKey) {
                    e.preventDefault();
                    this.applyMentionCandidate(input, this.mentionState.selectedIndex);
                    return true;
                }
                return false;

            case 'Tab':
                e.preventDefault();
                this.applyMentionCandidate(input, this.mentionState.selectedIndex);
                return true;

            case 'Escape':
                e.preventDefault();
                this.hideMentionMenu();
                return true;

            default:
                return false;
        }
    }

    getMentionContextAtCursor(input) {
        if (!input) {
            return null;
        }

        const cursor = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
        const textBeforeCursor = input.value.slice(0, cursor);
        const atIndex = textBeforeCursor.lastIndexOf('@');
        if (atIndex === -1) {
            return null;
        }

        if (atIndex > 0) {
            const prevChar = textBeforeCursor[atIndex - 1];
            if (!/\s/.test(prevChar)) {
                return null;
            }
        }

        const token = textBeforeCursor.slice(atIndex + 1);
        if (/[\s\n\r\t]/.test(token)) {
            return null;
        }

        if (token.startsWith('{')) {
            return null;
        }

        return {
            start: atIndex,
            end: cursor,
            query: token
        };
    }

    getMentionCandidates(query) {
        const tabs = this.getOpenMarkdownTabs();
        const normalizedQuery = (query || '').trim().toLowerCase();
        const seenPaths = new Set();
        const candidates = [];

        for (const tab of tabs) {
            const path = tab.path;
            if (!path || seenPaths.has(path)) {
                continue;
            }
            seenPaths.add(path);

            const fileName = path.split('/').pop() || path;
            const baseName = fileName.replace(/\.md$/i, '');
            const title = tab.title || baseName;

            const pathLower = path.toLowerCase();
            const fileLower = fileName.toLowerCase();
            const baseLower = baseName.toLowerCase();
            const titleLower = title.toLowerCase();

            if (normalizedQuery) {
                const matches = pathLower.includes(normalizedQuery) ||
                    fileLower.includes(normalizedQuery) ||
                    baseLower.includes(normalizedQuery) ||
                    titleLower.includes(normalizedQuery);
                if (!matches) {
                    continue;
                }
            }

            let score = 3;
            if (!normalizedQuery) {
                score = 4;
            } else if (pathLower === normalizedQuery || fileLower === normalizedQuery || baseLower === normalizedQuery) {
                score = 0;
            } else if (fileLower.startsWith(normalizedQuery) || baseLower.startsWith(normalizedQuery) || titleLower.startsWith(normalizedQuery)) {
                score = 1;
            } else if (pathLower.includes(`/${normalizedQuery}`)) {
                score = 2;
            }

            candidates.push({
                path,
                title,
                fileName,
                score
            });
        }

        candidates.sort((a, b) => {
            if (a.score !== b.score) {
                return a.score - b.score;
            }
            return a.path.localeCompare(b.path);
        });

        return candidates.slice(0, 8);
    }

    ensureMentionMenuElement(input) {
        if (this.mentionMenuEl) {
            return this.mentionMenuEl;
        }

        const wrapper = input.closest('.chat-input-wrapper') || input.parentElement;
        if (!wrapper) {
            return null;
        }

        const menu = document.createElement('div');
        menu.className = 'chat-mention-menu';
        menu.id = 'chat-mention-menu';
        wrapper.appendChild(menu);

        this.mentionMenuEl = menu;
        return menu;
    }

    renderMentionMenu(input) {
        const menu = this.ensureMentionMenuElement(input);
        if (!menu || !this.mentionState.active || this.mentionState.options.length === 0) {
            this.hideMentionMenu();
            return;
        }

        menu.innerHTML = '';

        this.mentionState.options.forEach((option, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'chat-mention-item';
            if (index === this.mentionState.selectedIndex) {
                item.classList.add('active');
            }

            const title = document.createElement('span');
            title.className = 'chat-mention-title';
            title.textContent = option.title || option.fileName;

            const path = document.createElement('span');
            path.className = 'chat-mention-path';
            path.textContent = option.path;

            item.appendChild(title);
            item.appendChild(path);
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.applyMentionCandidate(input, index);
            });

            menu.appendChild(item);
        });

        menu.style.display = 'block';

        const activeEl = menu.querySelector('.chat-mention-item.active');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }

    hideMentionMenu() {
        this.mentionState.active = false;
        this.mentionState.options = [];
        this.mentionState.selectedIndex = 0;

        if (this.mentionMenuEl) {
            this.mentionMenuEl.style.display = 'none';
            this.mentionMenuEl.innerHTML = '';
        }
    }

    applyMentionCandidate(input, index) {
        const candidate = this.mentionState.options[index];
        if (!candidate) {
            return;
        }

        const before = input.value.slice(0, this.mentionState.start);
        const after = input.value.slice(this.mentionState.end);
        const mentionToken = `@{${candidate.path}}`;
        const shouldAddSpace = after.length > 0 && !/^\s/.test(after);

        input.value = `${before}${mentionToken}${shouldAddSpace ? ' ' : ''}${after}`;

        const newCursor = before.length + mentionToken.length + (shouldAddSpace ? 1 : 0);
        input.focus();
        input.setSelectionRange(newCursor, newCursor);

        this.hideMentionMenu();
        this.autoResizeInput(input);
    }

    // ==================== 消息发送 ====================

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || this.isStreaming) {
            return;
        }

        this.hideMentionMenu();

        if (!window.chatConfig || !window.chatConfig.isConfigured()) {
            this.showError('请先配置 API 端点和密钥');
            if (window.chatConfig) {
                window.chatConfig.show();
            }
            return;
        }

        input.value = '';
        input.style.height = 'auto';
        this.addMessage('user', message);

        const contextType = document.getElementById('chat-context-selector').value;
        const messageForModel = this.removeMentionTokensFromMessage(message);
        let context = null;

        try {
            context = await this.getContext(contextType, message);
        } catch (error) {
            this.showError(`获取上下文失败: ${error.message}`);
            return;
        }

        this.isStreaming = true;
        this.updateStreamingUI(true);
        this.showTypingIndicator();

        try {
            await this.streamMessage(messageForModel, context);
        } catch (error) {
            this.hideTypingIndicator();
            if (error.name !== 'AbortError') {
                this.showError(`发送失败: ${error.message}`);
            }
        } finally {
            this.isStreaming = false;
            this.abortController = null;
            this.updateStreamingUI(false);
        }
    }

    stopStreaming() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isStreaming = false;
        this.currentStreamMessage = null;
        this.hideTypingIndicator();
        this.updateStreamingUI(false);
    }

    updateStreamingUI(streaming) {
        const sendBtn = document.getElementById('chat-send-btn');
        const stopBtn = document.getElementById('chat-stop-btn');
        if (sendBtn) {
            sendBtn.disabled = streaming;
        }
        if (stopBtn) {
            stopBtn.style.display = streaming ? 'flex' : 'none';
        }
    }

    // ==================== Mention Token 处理 ====================

    normalizeMentionToken(token) {
        if (!token) {
            return '';
        }

        let normalized = token.trim();
        normalized = normalized.replace(/^["'`]+|["'`]+$/g, '');
        normalized = normalized.replace(/[.,!?;:]+$/g, '');
        return normalized.trim();
    }

    extractMentionTokens(message) {
        const mentions = [];

        const explicitRegex = /@\{([^}]+)\}/g;
        for (const match of message.matchAll(explicitRegex)) {
            const token = this.normalizeMentionToken(match[1]);
            if (token) {
                mentions.push(token);
            }
        }

        const simpleRegex = /(?:^|\s)@([^\s@{}]+)/g;
        for (const match of message.matchAll(simpleRegex)) {
            const token = this.normalizeMentionToken(match[1]);
            if (token) {
                mentions.push(token);
            }
        }

        return [...new Set(mentions)];
    }

    removeMentionTokensFromMessage(message) {
        let cleaned = message.replace(/@\{[^}]+\}/g, ' ');
        cleaned = cleaned.replace(/(?:^|\s)@([^\s@{}]+)/g, (fullMatch) => (fullMatch.startsWith(' ') ? ' ' : ''));
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned || message;
    }

    getOpenMarkdownTabs() {
        if (!window.EditorApp || !EditorApp.State || typeof EditorApp.State.getState !== 'function') {
            return [];
        }

        const state = EditorApp.State.getState();
        if (!state || !Array.isArray(state.tabs)) {
            return [];
        }

        return state.tabs.filter(tab => tab && tab.type !== 'image' && typeof tab.path === 'string');
    }

    resolveMentionToPath(token, tabs) {
        const normalized = this.normalizeMentionToken(token);
        if (!normalized) {
            throw new Error('Empty @document token');
        }

        const variants = new Set([normalized]);
        if (!normalized.toLowerCase().endsWith('.md')) {
            variants.add(`${normalized}.md`);
        }

        const candidates = tabs.filter((tab) => {
            const path = tab.path;
            const fileName = path.split('/').pop() || '';
            const baseName = fileName.replace(/\.md$/i, '');
            const title = tab.title || '';

            for (const variant of variants) {
                if (path === variant || fileName === variant || baseName === variant || title === variant) {
                    return true;
                }
                if (path.endsWith(`/${variant}`)) {
                    return true;
                }
            }

            return false;
        });

        if (candidates.length === 0) {
            throw new Error(`Open document not found: @${normalized}`);
        }

        if (candidates.length > 1) {
            const options = candidates.map(tab => tab.path).join(', ');
            throw new Error(`Ambiguous @${normalized}, matched: ${options}. Use @{full/path/to/doc.md}`);
        }

        return candidates[0].path;
    }

    resolveMentionedDocumentPaths(message) {
        const mentionTokens = this.extractMentionTokens(message);
        if (mentionTokens.length === 0) {
            return [];
        }

        const tabs = this.getOpenMarkdownTabs();
        if (tabs.length === 0) {
            throw new Error('No open Markdown documents available for @mention');
        }

        return mentionTokens.map(token => this.resolveMentionToPath(token, tabs));
    }

    async buildMentionContext(paths) {
        if (!window.chatContext || typeof window.chatContext.extractDocumentByPath !== 'function') {
            throw new Error('Chat context module is not ready');
        }

        const contexts = [];
        for (const path of paths) {
            const context = await window.chatContext.extractDocumentByPath(path);
            contexts.push(context);
        }

        if (contexts.length === 1) {
            return contexts[0];
        }

        const mergedContent = contexts
            .map((context, index) => `## Document ${index + 1}: ${context.path}\n\n${context.content}`)
            .join('\n\n---\n\n');

        return {
            type: 'current_document',
            path: paths.join(', '),
            content: mergedContent
        };
    }

    async getContext(contextType, message = '') {
        if (!window.chatContext) {
            return null;
        }

        const mentionedPaths = this.resolveMentionedDocumentPaths(message);
        if (mentionedPaths.length > 0) {
            return await this.buildMentionContext(mentionedPaths);
        }

        return await window.chatContext.extract(contextType);
    }

    // ==================== 流式消息 ====================

    async streamMessage(message, context) {
        const config = window.chatConfig.getConfig();

        const requestBody = {
            message: message,
            context: context,
            history: this.getRecentHistory(5),
            options: {
                temperature: config.temperature || 0.7,
                maxTokens: config.maxTokens || 2000,
                systemPrompt: config.systemPrompt || ''
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            'X-API-Endpoint': config.apiEndpoint,
            'X-API-Key': config.apiKey,
            'X-Model': config.model
        };

        if (config.embeddingEndpoint) {
            headers['X-Embedding-Endpoint'] = config.embeddingEndpoint;
        }
        if (config.embeddingKey) {
            headers['X-Embedding-Key'] = config.embeddingKey;
        }
        if (config.embeddingModel) {
            headers['X-Embedding-Model'] = config.embeddingModel;
        }

        this.abortController = new AbortController();

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: this.abortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('Response body is not readable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        this.hideTypingIndicator();
        this.currentStreamMessage = this.addMessage('assistant', '');

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);

                    try {
                        const event = JSON.parse(data);
                        this.handleStreamEvent(event);
                    } catch (error) {
                        // ignore malformed SSE events
                    }
                }
            }
        }

        this.currentStreamMessage = null;
        this.saveHistory();
    }

    handleStreamEvent(event) {
        switch (event.type) {
            case 'start':
                break;

            case 'content':
                if (this.currentStreamMessage) {
                    this.currentStreamMessage.content += event.delta;
                    this.updateMessage(this.currentStreamMessage);
                }
                break;

            case 'done':
                break;

            case 'error':
                this.showError(event.error);
                break;
        }
    }

    // ==================== 消息渲染 ====================

    addMessage(role, content) {
        const message = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        };

        this.messages.push(message);
        this.renderMessage(message);
        this.updateWelcomeVisibility();

        return message;
    }

    renderMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message chat-message-${message.role}`;
        messageEl.dataset.id = message.id;
        messageEl.dataset.timestamp = message.timestamp;

        const contentEl = document.createElement('div');
        contentEl.className = 'chat-message-content';

        if (message.role === 'assistant') {
            contentEl.innerHTML = this.renderMarkdown(message.content);
        } else {
            contentEl.textContent = message.content;
        }

        messageEl.appendChild(contentEl);

        // 时间戳
        const timeEl = document.createElement('div');
        timeEl.className = 'chat-message-time';
        timeEl.textContent = this.formatTime(message.timestamp);
        messageEl.appendChild(timeEl);

        // 操作按钮
        const actionsEl = document.createElement('div');
        actionsEl.className = 'chat-message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'chat-message-action-btn';
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', () => this.copyMessage(message));
        actionsEl.appendChild(copyBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-message-action-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => this.deleteMessage(message.id));
        actionsEl.appendChild(deleteBtn);

        messageEl.appendChild(actionsEl);
        messagesContainer.appendChild(messageEl);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageEl = messagesContainer.querySelector(`[data-id="${CSS.escape(message.id)}"]`);

        if (messageEl) {
            const contentEl = messageEl.querySelector('.chat-message-content');
            if (message.role === 'assistant') {
                contentEl.innerHTML = this.renderMarkdown(message.content);
            } else {
                contentEl.textContent = message.content;
            }

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    formatTime(timestamp) {
        try {
            const date = new Date(timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (e) {
            return '';
        }
    }

    copyMessage(message) {
        const text = message.content;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('已复制到剪贴板');
        }).catch(() => {
            // fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('已复制到剪贴板');
        });
    }

    deleteMessage(messageId) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index === -1) {
            return;
        }

        this.messages = [
            ...this.messages.slice(0, index),
            ...this.messages.slice(index + 1)
        ];

        const el = document.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
        if (el) {
            el.remove();
        }

        this.saveHistory();
        this.updateWelcomeVisibility();
    }

    showToast(text) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--color-panel-strong);color:var(--color-text);padding:8px 16px;border-radius:var(--radius-md);font-size:12px;z-index:10010;box-shadow:var(--shadow-panel);border:1px solid var(--color-border);';
        toast.textContent = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }

    updateWelcomeVisibility() {
        const welcome = document.getElementById('chat-welcome');
        if (welcome) {
            welcome.style.display = this.messages.length === 0 ? 'flex' : 'none';
        }
    }

    // ==================== Markdown 渲染 ====================

    renderMarkdown(content) {
        // 先对整体内容做 HTML 转义，防止 XSS
        let html = this.escapeHtml(content);

        // 代码块
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
        });

        // 行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 粗体
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 斜体
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 链接（仅允许 http/https 协议）
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            const trimmed = url.trim();
            if (/^https?:\/\//i.test(trimmed)) {
                return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
            return text;
        });

        // 换行
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==================== 状态指示 ====================

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const indicator = document.createElement('div');
        indicator.className = 'chat-typing-indicator';
        indicator.id = 'chat-typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('chat-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    showError(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const errorEl = document.createElement('div');
        errorEl.className = 'chat-error';
        errorEl.textContent = message;
        messagesContainer.appendChild(errorEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ==================== 历史管理 ====================

    getRecentHistory(count) {
        return this.messages.slice(-count * 2).map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    saveHistory() {
        try {
            localStorage.setItem('chat_history', JSON.stringify(this.messages));
        } catch (error) {
            // storage full, trim oldest messages
            if (this.messages.length > 20) {
                this.messages = this.messages.slice(-20);
                try {
                    localStorage.setItem('chat_history', JSON.stringify(this.messages));
                } catch (e) {
                    // give up
                }
            }
        }
    }

    loadHistory() {
        try {
            const history = localStorage.getItem('chat_history');
            if (history) {
                const parsed = JSON.parse(history);
                if (!Array.isArray(parsed)) {
                    this.messages = [];
                    return;
                }
                this.messages = parsed
                    .filter(msg => msg && typeof msg.role === 'string' && typeof msg.content === 'string')
                    .map(msg => ({
                        ...msg,
                        id: msg.id || Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                        timestamp: msg.timestamp || new Date().toISOString()
                    }));
                this.messages.forEach(msg => this.renderMessage(msg));
            }
        } catch (error) {
            this.messages = [];
        }
    }

    clearHistory() {
        this.messages = [];
        const container = document.getElementById('chat-messages');
        // 保留 welcome 元素
        const welcome = document.getElementById('chat-welcome');
        container.innerHTML = '';
        if (welcome) {
            container.appendChild(welcome);
        }
        localStorage.removeItem('chat_history');
        this.updateWelcomeVisibility();
    }
}

// 导出
window.ChatPanel = ChatPanel;
