// chat-config.js - AI 聊天配置管理

class ChatConfig {
    constructor() {
        this.config = this.loadConfig();
        this.dialog = null;

        this.init();
    }

    init() {
        this.createDialog();
        this.loadModels(); // 加载模型列表
    }

    createDialog() {
        // 创建配置对话框
        const dialog = document.createElement('div');
        dialog.id = 'chat-config-dialog';
        dialog.className = 'chat-config-dialog';
        dialog.style.display = 'none';
        dialog.innerHTML = `
            <div class="chat-config-overlay"></div>
            <div class="chat-config-content">
                <div class="chat-config-header">
                    <h3>AI 助手配置</h3>
                    <button class="chat-config-close" id="chat-config-close">×</button>
                </div>
                <div class="chat-config-body">
                    <div class="chat-config-section">
                        <label for="chat-api-endpoint">API 端点</label>
                        <input type="text" id="chat-api-endpoint" class="chat-config-input"
                               placeholder="https://api.openai.com/v1/chat/completions" />
                        <small>支持 OpenAI、Azure OpenAI 或兼容的 API</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-api-key">API 密钥</label>
                        <input type="password" id="chat-api-key" class="chat-config-input"
                               placeholder="sk-..." />
                        <small>密钥仅存储在本地浏览器中</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-model">模型</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="chat-model" class="chat-config-input"
                                   list="chat-model-list"
                                   placeholder="输入或选择模型 (如 gpt-4)"
                                   style="flex: 1;" />
                            <datalist id="chat-model-list"></datalist>
                            <button id="chat-refresh-models" class="chat-config-btn-icon" title="刷新模型列表">🔄</button>
                        </div>
                        <small>可手动输入任何模型名称,或点击刷新获取可用模型列表</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-temperature">温度 (Temperature)</label>
                        <input type="range" id="chat-temperature" class="chat-config-slider"
                               min="0" max="2" step="0.1" value="0.7" />
                        <span id="chat-temperature-value">0.7</span>
                        <small>控制回复的随机性 (0 = 确定性, 2 = 创造性)</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-max-tokens">最大 Token 数</label>
                        <input type="number" id="chat-max-tokens" class="chat-config-input"
                               min="100" max="8000" step="100" value="2000" />
                        <small>限制回复的最大长度</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-system-prompt">系统提示词 (System Prompt)</label>
                        <textarea id="chat-system-prompt" class="chat-config-input"
                               rows="4" placeholder="你是一个专业的运维文档助手..."
                               style="resize: vertical; min-height: 80px;"></textarea>
                        <small>自定义 AI 的角色和行为，留空使用默认提示词</small>
                    </div>

                    <div class="chat-config-divider"></div>
                    <h4 class="chat-config-group-title">Embedding 模型配置</h4>

                    <div class="chat-config-section">
                        <label for="chat-embedding-endpoint">Embedding API 端点</label>
                        <input type="text" id="chat-embedding-endpoint" class="chat-config-input"
                               placeholder="https://api.jina.ai/v1/embeddings" />
                        <small>Embedding 服务的 API 端点（支持 OpenAI 兼容格式）</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-embedding-key">Embedding API 密钥</label>
                        <input type="password" id="chat-embedding-key" class="chat-config-input"
                               placeholder="sk-..." />
                        <small>Embedding 服务的 API 密钥</small>
                    </div>

                    <div class="chat-config-section">
                        <label for="chat-embedding-model">Embedding 模型</label>
                        <input type="text" id="chat-embedding-model" class="chat-config-input"
                               placeholder="text-embedding-3-small" />
                        <small>Embedding 模型名称（如 text-embedding-3-small、jina-embeddings-v3 等）</small>
                    </div>

                    <div class="chat-config-section">
                        <button id="chat-test-embedding" class="chat-config-btn chat-config-btn-secondary">
                            测试 Embedding 连接
                        </button>
                        <span id="chat-test-embedding-result"></span>
                    </div>

                    <div class="chat-config-divider"></div>

                    <div class="chat-config-section">
                        <label>知识库索引</label>
                        <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                            <button id="chat-index-kb" class="chat-config-btn chat-config-btn-secondary">
                                索引文档
                            </button>
                            <span id="chat-index-status" style="font-size: 12px; color: var(--color-muted);"></span>
                        </div>
                        <small>索引 src/ 目录下的运维文档，用于智能检索</small>
                    </div>

                    <div class="chat-config-section">
                        <button id="chat-test-connection" class="chat-config-btn chat-config-btn-secondary">
                            测试连接
                        </button>
                        <span id="chat-test-result"></span>
                    </div>
                </div>
                <div class="chat-config-footer">
                    <button id="chat-config-cancel" class="chat-config-btn chat-config-btn-secondary">取消</button>
                    <button id="chat-config-save" class="chat-config-btn chat-config-btn-primary">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        this.dialog = dialog;

        this.attachEventListeners();
        this.loadFormValues();
    }

    attachEventListeners() {
        // 关闭按钮
        document.getElementById('chat-config-close').addEventListener('click', () => this.hide());
        document.getElementById('chat-config-cancel').addEventListener('click', () => this.hide());

        // 保存按钮
        document.getElementById('chat-config-save').addEventListener('click', () => this.save());

        // 测试连接按钮
        document.getElementById('chat-test-connection').addEventListener('click', () => this.testConnection());

        // 测试 Embedding 连接按钮
        document.getElementById('chat-test-embedding').addEventListener('click', () => this.testEmbeddingConnection());

        // 知识库索引按钮
        document.getElementById('chat-index-kb').addEventListener('click', () => this.indexKnowledgeBase());

        // 刷新模型列表按钮
        document.getElementById('chat-refresh-models').addEventListener('click', () => this.refreshModels());

        // 温度滑块
        const tempSlider = document.getElementById('chat-temperature');
        const tempValue = document.getElementById('chat-temperature-value');
        tempSlider.addEventListener('input', (e) => {
            tempValue.textContent = e.target.value;
        });

        // 点击遮罩层关闭
        this.dialog.querySelector('.chat-config-overlay').addEventListener('click', () => this.hide());

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dialog.style.display === 'flex') {
                this.hide();
            }
        });
    }

    show() {
        this.loadFormValues();
        this.loadIndexStatus(); // 加载索引状态
        this.dialog.style.display = 'flex';
    }

    hide() {
        this.dialog.style.display = 'none';
        document.getElementById('chat-test-result').textContent = '';
        document.getElementById('chat-test-embedding-result').textContent = '';
    }

    loadFormValues() {
        if (this.config) {
            document.getElementById('chat-api-endpoint').value = this.config.apiEndpoint || '';
            document.getElementById('chat-api-key').value = this.config.apiKey || '';
            document.getElementById('chat-model').value = this.config.model || 'gpt-4';
            document.getElementById('chat-temperature').value = this.config.temperature || 0.7;
            document.getElementById('chat-temperature-value').textContent = this.config.temperature || 0.7;
            document.getElementById('chat-max-tokens').value = this.config.maxTokens || 2000;
            document.getElementById('chat-system-prompt').value = this.config.systemPrompt || '';
            document.getElementById('chat-embedding-endpoint').value = this.config.embeddingEndpoint || '';
            document.getElementById('chat-embedding-key').value = this.config.embeddingKey || '';
            document.getElementById('chat-embedding-model').value = this.config.embeddingModel || '';
        }
    }

    save() {
        const config = {
            apiEndpoint: document.getElementById('chat-api-endpoint').value.trim(),
            apiKey: document.getElementById('chat-api-key').value.trim(),
            model: document.getElementById('chat-model').value,
            temperature: parseFloat(document.getElementById('chat-temperature').value),
            maxTokens: parseInt(document.getElementById('chat-max-tokens').value),
            systemPrompt: document.getElementById('chat-system-prompt').value.trim(),
            embeddingEndpoint: document.getElementById('chat-embedding-endpoint').value.trim(),
            embeddingKey: document.getElementById('chat-embedding-key').value.trim(),
            embeddingModel: document.getElementById('chat-embedding-model').value.trim()
        };

        // 验证
        if (!config.apiEndpoint) {
            this.showTestResult('请输入 API 端点', 'error');
            return;
        }

        if (!config.apiKey) {
            this.showTestResult('请输入 API 密钥', 'error');
            return;
        }

        // 保存到 localStorage
        this.config = config;
        this.saveConfig();

        // 重新加载模型列表
        this.loadModels();

        this.showTestResult('配置已保存', 'success');
        setTimeout(() => this.hide(), 1000);
    }

    async testConnection() {
        const apiEndpoint = document.getElementById('chat-api-endpoint').value.trim();
        const apiKey = document.getElementById('chat-api-key').value.trim();
        const model = document.getElementById('chat-model').value;

        if (!apiEndpoint || !apiKey) {
            this.showTestResult('请先填写 API 端点和密钥', 'error');
            return;
        }

        this.showTestResult('测试中...', 'info');

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Endpoint': apiEndpoint,
                    'X-API-Key': apiKey,
                    'X-Model': model
                },
                body: JSON.stringify({
                    message: 'Hello',
                    options: {
                        temperature: 0.7,
                        maxTokens: 50
                    }
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showTestResult('连接成功！', 'success');
            } else {
                this.showTestResult(`连接失败: ${data.error}`, 'error');
            }
        } catch (error) {
            this.showTestResult(`连接失败: ${error.message}`, 'error');
        }
    }

    showTestResult(message, type) {
        const resultEl = document.getElementById('chat-test-result');
        resultEl.textContent = message;
        resultEl.className = `chat-test-result chat-test-result-${type}`;
    }

    async testEmbeddingConnection() {
        const endpoint = document.getElementById('chat-embedding-endpoint').value.trim();
        const key = document.getElementById('chat-embedding-key').value.trim();
        const model = document.getElementById('chat-embedding-model').value.trim();
        const resultEl = document.getElementById('chat-test-embedding-result');

        if (!endpoint || !key) {
            resultEl.textContent = '请先填写 Embedding API 端点和密钥';
            resultEl.className = 'chat-test-result chat-test-result-error';
            return;
        }

        resultEl.textContent = '测试中...';
        resultEl.className = 'chat-test-result chat-test-result-info';

        try {
            const response = await fetch('/api/chat/rag/test-embedding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Embedding-Endpoint': endpoint,
                    'X-Embedding-Key': key,
                    'X-Embedding-Model': model
                },
                body: JSON.stringify({ text: 'test' })
            });

            const data = await response.json();

            if (data.success) {
                resultEl.textContent = `连接成功！维度: ${data.dimension}`;
                resultEl.className = 'chat-test-result chat-test-result-success';
            } else {
                resultEl.textContent = `连接失败: ${data.error}`;
                resultEl.className = 'chat-test-result chat-test-result-error';
            }
        } catch (error) {
            resultEl.textContent = `连接失败: ${error.message}`;
            resultEl.className = 'chat-test-result chat-test-result-error';
        }
    }

    loadConfig() {
        try {
            const config = localStorage.getItem('ai_chat_config');
            return config ? JSON.parse(config) : null;
        } catch (error) {
            // config parse failed, reset to defaults
            return null;
        }
    }

    saveConfig() {
        try {
            localStorage.setItem('ai_chat_config', JSON.stringify(this.config));
        } catch (error) {
            // storage full or unavailable
        }
    }

    getConfig() {
        return this.config;
    }

    isConfigured() {
        return this.config && this.config.apiEndpoint && this.config.apiKey;
    }

    async loadModels(endpoint, key) {
        const modelInput = document.getElementById('chat-model');
        const modelList = document.getElementById('chat-model-list');
        if (!modelInput || !modelList) return;

        const apiEndpoint = endpoint || (this.config && this.config.apiEndpoint);
        const apiKey = key || (this.config && this.config.apiKey);

        if (!apiEndpoint || !apiKey) {
            return;
        }

        try {
            const response = await fetch('/api/chat/models', {
                method: 'GET',
                headers: {
                    'X-API-Endpoint': apiEndpoint,
                    'X-API-Key': apiKey
                }
            });

            const data = await response.json();

            if (data.success && data.models && data.models.length > 0) {
                // 清空并填充模型列表
                modelList.innerHTML = '';
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    modelList.appendChild(option);
                });
            }
        } catch (error) {
            // 显示用户友好的错误提示
            const inputContainer = modelInput.parentElement;
            if (inputContainer && !inputContainer.querySelector('.chat-model-error')) {
                const errorHint = document.createElement('small');
                errorHint.className = 'chat-model-error';
                errorHint.textContent = '获取模型列表失败，请检查网络或手动输入';
                errorHint.style.color = 'var(--color-danger)';
                inputContainer.appendChild(errorHint);
                // 3秒后自动移除提示
                setTimeout(() => errorHint.remove(), 3000);
            }
        }
    }

    async indexKnowledgeBase() {
        const statusEl = document.getElementById('chat-index-status');
        const btnEl = document.getElementById('chat-index-kb');

        // 直接从表单读取当前输入值（用户可能还没保存）
        const embEndpoint = document.getElementById('chat-embedding-endpoint').value.trim();
        const embKey = document.getElementById('chat-embedding-key').value.trim();
        const embModel = document.getElementById('chat-embedding-model').value.trim();
        const chatEndpoint = document.getElementById('chat-api-endpoint').value.trim();
        const chatKey = document.getElementById('chat-api-key').value.trim();

        const hasEmbeddingConfig = embEndpoint && embKey;
        const hasChatConfig = chatEndpoint && chatKey;

        if (!hasEmbeddingConfig && !hasChatConfig) {
            statusEl.textContent = '请先配置 Embedding API 或聊天 API';
            statusEl.style.color = 'var(--color-danger)';
            return;
        }

        if (!hasEmbeddingConfig) {
            statusEl.textContent = '未配置 Embedding API，将使用聊天 API 回退';
            statusEl.style.color = 'var(--color-warning, orange)';
        }

        // 显示加载状态
        statusEl.textContent = '索引中...';
        statusEl.style.color = 'var(--color-primary)';
        btnEl.disabled = true;

        try {
            const headers = {};
            // 优先使用独立的 embedding 配置
            if (hasEmbeddingConfig) {
                headers['X-Embedding-Endpoint'] = embEndpoint;
                headers['X-Embedding-Key'] = embKey;
                headers['X-Embedding-Model'] = embModel;
            }
            // 同时传递聊天 API 配置作为回退
            if (hasChatConfig) {
                headers['X-API-Endpoint'] = chatEndpoint;
                headers['X-API-Key'] = chatKey;
            }

            const response = await fetch('/api/chat/rag/index', {
                method: 'POST',
                headers: headers
            });

            const data = await response.json();

            if (data.success) {
                statusEl.textContent = '索引成功';
                statusEl.style.color = 'var(--color-success)';

                // 更新索引状态
                setTimeout(() => this.loadIndexStatus(), 1000);
            } else {
                statusEl.textContent = `索引失败: ${data.error || '未知错误'}`;
                statusEl.style.color = 'var(--color-danger)';
            }
        } catch (error) {
            statusEl.textContent = `索引失败: ${error.message}`;
            statusEl.style.color = 'var(--color-danger)';
        } finally {
            btnEl.disabled = false;
        }
    }

    async loadIndexStatus() {
        const statusEl = document.getElementById('chat-index-status');

        try {
            const response = await fetch('/api/chat/rag/status');
            const data = await response.json();

            if (data.success && data.indexed) {
                statusEl.textContent = `已索引 ${data.document_count} 个文档块`;
                statusEl.style.color = 'var(--color-success)';
            } else {
                statusEl.textContent = '未索引';
                statusEl.style.color = 'var(--color-muted)';
            }
        } catch (error) {
            statusEl.textContent = '状态获取失败';
            statusEl.style.color = 'var(--color-muted)';
        }
    }

    async refreshModels() {
        const btnEl = document.getElementById('chat-refresh-models');
        const modelInput = document.getElementById('chat-model');

        // 从表单读取当前值（用户可能还没保存）
        const apiEndpoint = document.getElementById('chat-api-endpoint').value.trim();
        const apiKey = document.getElementById('chat-api-key').value.trim();

        if (!apiEndpoint || !apiKey) {
            this.showTestResult('请先填写 API 端点和密钥', 'error');
            return;
        }

        // 显示加载状态
        btnEl.disabled = true;
        btnEl.textContent = '⏳';
        modelInput.disabled = true;

        try {
            await this.loadModels(apiEndpoint, apiKey);
            const modelList = document.getElementById('chat-model-list');
            const count = modelList ? modelList.children.length : 0;
            btnEl.textContent = '✓';
            if (count > 0) {
                this.showTestResult(`已加载 ${count} 个模型`, 'success');
            } else {
                this.showTestResult('未获取到模型，请手动输入', 'error');
            }
            setTimeout(() => { btnEl.textContent = '🔄'; }, 1500);
        } catch (error) {
            btnEl.textContent = '✗';
            this.showTestResult(`刷新失败: ${error.message}`, 'error');
            setTimeout(() => { btnEl.textContent = '🔄'; }, 1500);
        } finally {
            btnEl.disabled = false;
            modelInput.disabled = false;
        }
    }
}

// 导出
window.ChatConfig = ChatConfig;
