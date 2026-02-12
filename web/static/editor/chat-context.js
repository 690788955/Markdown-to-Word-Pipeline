// chat-context.js - AI 聊天上下文管理

class ChatContext {
    constructor() {
        this.currentFile = null;
        this.editor = null;
    }

    setEditor(editor) {
        this.editor = editor;
    }

    setCurrentFile(filePath) {
        this.currentFile = filePath;
    }

    async extract(contextType) {
        switch (contextType) {
            case 'current_document':
                return await this.extractCurrentDocument();

            case 'selection':
                return await this.extractSelection();

            case 'knowledge_base':
                return await this.extractKnowledgeBase();

            default:
                throw new Error(`Unknown context type: ${contextType}`);
        }
    }

    getEditorState() {
        if (!window.EditorApp || !EditorApp.State || typeof EditorApp.State.getState !== 'function') {
            return null;
        }

        return EditorApp.State.getState();
    }

    getActiveTab(state) {
        if (!state || !state.activeTabId || !Array.isArray(state.tabs)) {
            return null;
        }

        return state.tabs.find(tab => tab.id === state.activeTabId) || null;
    }

    resolveCurrentFilePath(state = null, activeTab = null) {
        if (this.currentFile) {
            return this.currentFile;
        }

        const currentState = state || this.getEditorState();
        if (!currentState) {
            return null;
        }

        if (currentState.selectedFile) {
            return currentState.selectedFile;
        }

        const tab = activeTab || this.getActiveTab(currentState);
        if (tab && tab.path) {
            return tab.path;
        }

        return null;
    }

    resolveEditorInstance(state = null) {
        if (this.editor && typeof this.editor.getValue === 'function') {
            return this.editor;
        }

        if (window.vditor && typeof window.vditor.getValue === 'function') {
            return window.vditor;
        }

        const currentState = state || this.getEditorState();
        if (!currentState || !currentState.activeTabId || !currentState.editors || typeof currentState.editors.get !== 'function') {
            return null;
        }

        const editor = currentState.editors.get(currentState.activeTabId);
        if (editor && typeof editor.getValue === 'function') {
            return editor;
        }

        return null;
    }

    readCurrentDocumentContent(state, activeTab) {
        const editor = this.resolveEditorInstance(state);
        if (editor) {
            this.editor = editor;
            const value = editor.getValue();
            if (typeof value === 'string') {
                return value;
            }
        }

        if (activeTab && typeof activeTab.content === 'string') {
            return activeTab.content;
        }

        const textarea = document.querySelector('#editorContainer textarea, .vditor textarea');
        if (textarea && typeof textarea.value === 'string') {
            return textarea.value;
        }

        const ir = document.querySelector('#editorContainer .vditor-ir');
        if (ir && typeof ir.innerText === 'string') {
            return ir.innerText;
        }

        return '';
    }

    async fetchDocumentContentByPath(path) {
        const response = await fetch(`/api/editor/module?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success || !data.data || typeof data.data.content !== 'string') {
            throw new Error(data.error || 'Failed to fetch document content');
        }

        return data.data.content;
    }

    async extractCurrentDocument() {
        const state = this.getEditorState();
        const activeTab = this.getActiveTab(state);
        const resolvedPath = this.resolveCurrentFilePath(state, activeTab);
        if (resolvedPath) {
            this.currentFile = resolvedPath;
        }

        let content = this.readCurrentDocumentContent(state, activeTab);

        if ((!content || content.trim() === '') && this.currentFile) {
            content = await this.fetchDocumentContentByPath(this.currentFile);
        }

        if (!this.currentFile && (!content || content.trim() === '')) {
            throw new Error('No file is currently open');
        }

        return {
            type: 'current_document',
            content: content || '',
            path: this.currentFile || ''
        };
    }

    async extractDocumentByPath(path) {
        const normalizedPath = (path || '').trim();
        if (!normalizedPath) {
            throw new Error('Invalid document path');
        }

        const state = this.getEditorState();
        const activeTab = this.getActiveTab(state);
        const targetTab = state && Array.isArray(state.tabs)
            ? state.tabs.find(tab => tab.path === normalizedPath)
            : null;

        if (!targetTab) {
            throw new Error(`Document is not open: ${normalizedPath}`);
        }

        if (targetTab.type === 'image') {
            throw new Error(`Unsupported document type: ${normalizedPath}`);
        }

        this.currentFile = normalizedPath;

        let content = '';
        if (activeTab && activeTab.path === normalizedPath) {
            content = this.readCurrentDocumentContent(state, activeTab);
        }

        if ((!content || content.trim() === '') && typeof targetTab.content === 'string') {
            content = targetTab.content;
        }

        if (!content || content.trim() === '') {
            content = await this.fetchDocumentContentByPath(normalizedPath);
        }

        return {
            type: 'current_document',
            content: content || '',
            path: normalizedPath
        };
    }

    async extractSelection() {
        const state = this.getEditorState();
        const activeTab = this.getActiveTab(state);
        const resolvedPath = this.resolveCurrentFilePath(state, activeTab);
        if (resolvedPath) {
            this.currentFile = resolvedPath;
        }

        const editor = this.resolveEditorInstance(state);
        if (!editor || typeof editor.getSelection !== 'function') {
            throw new Error('No editor instance available');
        }

        const selectedText = editor.getSelection();
        if (!selectedText || selectedText.trim() === '') {
            throw new Error('No text is selected');
        }

        return {
            type: 'selection',
            content: selectedText,
            path: this.currentFile || ''
        };
    }

    async extractKnowledgeBase() {
        // 知识库上下文由后端 RAG 检索处理，前端只发类型标记
        // 不再预拉全量内容（避免 >100KB 时报错阻断请求）
        return {
            type: 'knowledge_base',
            content: ''
        };
    }

    // 获取上下文摘要（用于显示）
    getContextSummary(context) {
        if (!context) {
            return '无上下文';
        }

        const charCount = context.content.length;
        const lineCount = context.content.split('\n').length;

        switch (context.type) {
            case 'current_document':
                return `当前文档 (${lineCount} 行, ${charCount} 字符)`;

            case 'selection':
                return `选中内容 (${lineCount} 行, ${charCount} 字符)`;

            case 'knowledge_base':
                return `整个知识库 (${charCount} 字符)`;

            default:
                return '未知上下文';
        }
    }
}

// 导出
window.ChatContext = ChatContext;
