// 运维文档生成系统 - Markdown 编辑器模块
// 基于 Vditor 实现，支持 WYSIWYG、即时渲染、分屏预览三种模式

// 全局变量
let vditorInstance = null;
let currentEditPath = null;
let originalContent = '';
let hasUnsavedChanges = false;
let editorReady = false; // 编辑器是否已完全初始化

// 初始化 Vditor 编辑器
function initVditor(content, mode = 'ir') {
    editorReady = false; // 重置初始化状态
    
    // 销毁已有实例
    if (vditorInstance) {
        vditorInstance.destroy();
        vditorInstance = null;
    }

    vditorInstance = new Vditor('vditor', {
        mode: mode,
        lang: 'zh_CN',
        height: '100%',
        value: content,
        cache: { enable: false },
        toolbar: [
            'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
            'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
            'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
            'upload', 'table', '|',
            'undo', 'redo', '|',
            'fullscreen', 'edit-mode', 'both', 'preview', 'outline', 'export'
        ],
        preview: {
            markdown: {
                linkBase: '/api/src/'
            },
            hljs: {
                enable: true,
                style: 'github',
                lineNumber: true
            }
        },
        upload: {
            // 图片上传暂不支持，使用本地路径
            accept: 'image/*',
            handler: function(files) {
                showToast('图片上传功能暂未开放，请将图片放入 src/images/ 目录后使用相对路径引用', 'warning', 5000);
                return null;
            }
        },
        input: function(value) {
            hasUnsavedChanges = value !== originalContent;
            updateSaveButtonState();
        },
        after: function() {
            originalContent = content;
            hasUnsavedChanges = false;
            editorReady = true; // 标记编辑器已完全初始化
            updateSaveButtonState();
        }
    });
}


// 更新保存按钮状态
function updateSaveButtonState() {
    const saveBtn = document.getElementById('editorSaveBtn');
    if (saveBtn) {
        const btnText = saveBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = hasUnsavedChanges ? '💾 保存 *' : '💾 保存';
        }
    }
}

// 打开编辑器
async function openEditor(modulePath) {
    const modal = document.getElementById('editorModal');
    const titleEl = document.getElementById('editorTitle');
    const pathEl = document.getElementById('editorPath');
    const modeSelect = document.getElementById('editorModeSelect');
    
    if (!modal) return;
    
    // 显示加载状态
    titleEl.textContent = '加载中...';
    pathEl.textContent = modulePath;
    openModal(modal);
    
    try {
        const response = await fetch('/api/editor/module?path=' + encodeURIComponent(modulePath));
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '加载失败');
        }
        
        currentEditPath = modulePath;
        const content = data.data.content || '';
        
        // 更新标题
        const fileName = modulePath.split('/').pop();
        titleEl.textContent = '编辑: ' + fileName;
        
        // 初始化编辑器
        const mode = modeSelect ? modeSelect.value : 'ir';
        initVditor(content, mode);
        
    } catch (e) {
        closeModal(modal);
        showToast('加载模块失败: ' + e.message, 'error');
        console.error('加载模块失败:', e);
    }
}

// 保存模块内容
async function saveModule() {
    if (!vditorInstance || !currentEditPath) {
        showToast('编辑器未初始化', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('editorSaveBtn');
    const content = vditorInstance.getValue();
    
    // 设置加载状态
    if (saveBtn) {
        saveBtn.disabled = true;
        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoading = saveBtn.querySelector('.btn-loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';
    }
    
    try {
        const response = await fetch('/api/editor/module', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentEditPath,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '保存失败');
        }
        
        // 更新原始内容
        originalContent = content;
        hasUnsavedChanges = false;
        updateSaveButtonState();
        
        showToast('保存成功', 'success');
        
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
        console.error('保存模块失败:', e);
    } finally {
        // 恢复按钮状态
        if (saveBtn) {
            saveBtn.disabled = false;
            const btnText = saveBtn.querySelector('.btn-text');
            const btnLoading = saveBtn.querySelector('.btn-loading');
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    }
}

// 关闭编辑器
function closeEditor() {
    if (hasUnsavedChanges) {
        if (!confirm('有未保存的更改，确定要关闭吗？')) {
            return;
        }
    }
    
    const modal = document.getElementById('editorModal');
    if (modal) {
        closeModal(modal);
    }
    
    // 清理状态
    if (vditorInstance) {
        vditorInstance.destroy();
        vditorInstance = null;
    }
    currentEditPath = null;
    originalContent = '';
    hasUnsavedChanges = false;
    editorReady = false;
}

// 切换编辑模式
function changeEditorMode() {
    const modeSelect = document.getElementById('editorModeSelect');
    if (!modeSelect || !vditorInstance) return;
    
    // 如果编辑器未完全初始化，忽略模式切换
    if (!editorReady) {
        console.log('编辑器正在初始化，忽略模式切换');
        return;
    }
    
    const newMode = modeSelect.value;
    
    // 安全获取当前内容
    let currentContent;
    try {
        currentContent = vditorInstance.getValue();
    } catch (e) {
        console.warn('获取编辑器内容失败，使用原始内容');
        currentContent = originalContent;
    }
    
    // 重新初始化编辑器
    initVditor(currentContent, newMode);
    
    // 保持未保存状态
    if (currentContent !== originalContent) {
        hasUnsavedChanges = true;
        updateSaveButtonState();
    }
}

// ==================== 新建模块功能 ====================

// 切换新目录输入框显示
function toggleNewDirInput() {
    const dirSelect = document.getElementById('newModuleDir');
    const newDirGroup = document.getElementById('newDirGroup');
    
    if (dirSelect && newDirGroup) {
        newDirGroup.style.display = dirSelect.value === '__new__' ? 'block' : 'none';
    }
}

// 显示新建模块对话框
function showNewModuleModal() {
    const modal = document.getElementById('newModuleModal');
    const dirSelect = document.getElementById('newModuleDir');
    const nameInput = document.getElementById('newModuleName');
    const newDirInput = document.getElementById('newDirName');
    const newDirGroup = document.getElementById('newDirGroup');
    
    if (modal) {
        // 填充目录选项
        if (dirSelect && typeof moduleTree !== 'undefined') {
            dirSelect.innerHTML = '<option value="">根目录</option>';
            moduleTree.directories.forEach(dir => {
                const option = document.createElement('option');
                option.value = dir.name;
                option.textContent = dir.displayName;
                dirSelect.appendChild(option);
            });
            // 添加新建目录选项
            const newOption = document.createElement('option');
            newOption.value = '__new__';
            newOption.textContent = '+ 新建目录...';
            dirSelect.appendChild(newOption);
        }
        
        if (nameInput) nameInput.value = '';
        if (newDirInput) newDirInput.value = '';
        if (newDirGroup) newDirGroup.style.display = 'none';
        
        openModal(modal);
        if (nameInput) nameInput.focus();
    }
}

// 隐藏新建模块对话框
function hideNewModuleModal() {
    const modal = document.getElementById('newModuleModal');
    if (modal) closeModal(modal);
}

// 创建新模块
async function createNewModule() {
    const dirSelect = document.getElementById('newModuleDir');
    const nameInput = document.getElementById('newModuleName');
    const newDirInput = document.getElementById('newDirName');
    if (!nameInput) return;
    
    let fileName = nameInput.value.trim();
    if (!fileName) {
        showToast('请输入文件名', 'warning');
        return;
    }
    
    // 自动添加 .md 后缀
    if (!fileName.toLowerCase().endsWith('.md')) {
        fileName += '.md';
    }
    
    // 确定目录
    let dir = dirSelect ? dirSelect.value : '';
    if (dir === '__new__') {
        dir = newDirInput ? newDirInput.value.trim() : '';
        if (!dir) {
            showToast('请输入新目录名称', 'warning');
            return;
        }
    }
    
    // 构建完整路径
    const path = dir ? dir + '/' + fileName : fileName;
    
    try {
        const response = await fetch('/api/editor/module', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '创建失败');
        }
        
        showToast('模块创建成功', 'success');
        hideNewModuleModal();
        
        // 刷新模块列表
        if (typeof loadModules === 'function') {
            await loadModules();
        }
        
        // 自动打开编辑器
        openEditor(path);
        
    } catch (e) {
        showToast('创建失败: ' + e.message, 'error');
        console.error('创建模块失败:', e);
    }
}

// 暴露函数到全局
window.openEditor = openEditor;
window.saveModule = saveModule;
window.closeEditor = closeEditor;
window.changeEditorMode = changeEditorMode;
window.showNewModuleModal = showNewModuleModal;
window.hideNewModuleModal = hideNewModuleModal;
window.createNewModule = createNewModule;
window.toggleNewDirInput = toggleNewDirInput;
