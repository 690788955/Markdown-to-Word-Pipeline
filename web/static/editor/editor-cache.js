// 知识库编辑器 - 编辑器实例缓存模块
// 使用 LRU 策略缓存编辑器实例，提升标签切换性能

window.EditorApp = window.EditorApp || {};

EditorApp.EditorCache = (function() {
    'use strict';

    // 配置
    const CONFIG = {
        maxSize: 5,           // 最大缓存实例数
        minIdleTime: 30000    // 最小空闲时间（毫秒）才能被淘汰
    };

    // 缓存数据结构
    // key: tabId, value: { editor, container, lastAccess, content }
    const cache = new Map();

    // 访问顺序队列（最近访问的在末尾）
    let accessOrder = [];

    // ==================== 核心方法 ====================

    /**
     * 获取或创建编辑器实例
     * @param {string} tabId - 标签 ID
     * @param {HTMLElement} container - 编辑器容器
     * @param {Object} options - Vditor 配置选项
     * @param {Function} createFn - 创建编辑器的函数
     * @returns {Object|null} 缓存的编辑器实例或 null（需要新建）
     */
    function acquire(tabId, container, options, createFn) {
        // 检查缓存中是否存在
        if (cache.has(tabId)) {
            const entry = cache.get(tabId);
            
            // 更新访问时间
            entry.lastAccess = Date.now();
            updateAccessOrder(tabId);

            console.log('[EditorCache] 命中缓存:', tabId);
            return entry.editor;
        }

        // 缓存未命中，检查是否需要淘汰
        if (cache.size >= CONFIG.maxSize) {
            evictLRU();
        }

        // 返回 null 表示需要创建新实例
        console.log('[EditorCache] 缓存未命中:', tabId);
        return null;
    }

    /**
     * 将编辑器实例添加到缓存
     * @param {string} tabId - 标签 ID
     * @param {Object} editor - Vditor 编辑器实例
     * @param {HTMLElement} container - 编辑器容器
     */
    function add(tabId, editor, container) {
        if (!tabId || !editor) return;

        // 如果已存在，更新
        if (cache.has(tabId)) {
            const entry = cache.get(tabId);
            entry.editor = editor;
            entry.container = container;
            entry.lastAccess = Date.now();
            updateAccessOrder(tabId);
            return;
        }

        // 检查是否需要淘汰
        if (cache.size >= CONFIG.maxSize) {
            evictLRU();
        }

        // 添加新条目
        cache.set(tabId, {
            editor: editor,
            container: container,
            lastAccess: Date.now(),
            content: null
        });

        accessOrder.push(tabId);
        console.log('[EditorCache] 添加缓存:', tabId, '当前大小:', cache.size);
    }

    /**
     * 释放编辑器实例到缓存池
     * @param {string} tabId - 标签 ID
     * @param {boolean} keepInCache - 是否保留在缓存中
     */
    function release(tabId, keepInCache = true) {
        if (!cache.has(tabId)) return;

        const entry = cache.get(tabId);

        if (keepInCache) {
            // 保存当前内容状态
            if (entry.editor && typeof entry.editor.getValue === 'function') {
                entry.content = entry.editor.getValue();
            }
            entry.lastAccess = Date.now();
            console.log('[EditorCache] 释放到缓存:', tabId);
        } else {
            // 完全移除
            remove(tabId);
        }
    }

    /**
     * 从缓存中移除并销毁编辑器实例
     * @param {string} tabId - 标签 ID
     */
    function remove(tabId) {
        if (!cache.has(tabId)) return;

        const entry = cache.get(tabId);

        // 销毁编辑器实例
        if (entry.editor && typeof entry.editor.destroy === 'function') {
            try {
                entry.editor.destroy();
            } catch (e) {
                console.warn('[EditorCache] 销毁编辑器失败:', e);
            }
        }

        // 移除容器
        if (entry.container && entry.container.parentNode) {
            entry.container.parentNode.removeChild(entry.container);
        }

        cache.delete(tabId);
        accessOrder = accessOrder.filter(id => id !== tabId);

        console.log('[EditorCache] 移除缓存:', tabId, '当前大小:', cache.size);
    }

    /**
     * 淘汰最久未使用的实例
     */
    function evictLRU() {
        if (accessOrder.length === 0) return;

        const now = Date.now();

        // 找到可以淘汰的最旧条目
        for (let i = 0; i < accessOrder.length; i++) {
            const tabId = accessOrder[i];
            const entry = cache.get(tabId);

            if (!entry) continue;

            // 检查是否满足最小空闲时间
            if (now - entry.lastAccess >= CONFIG.minIdleTime) {
                console.log('[EditorCache] LRU 淘汰:', tabId);
                remove(tabId);
                return;
            }
        }

        // 如果没有满足空闲时间的，强制淘汰最旧的
        if (accessOrder.length > 0) {
            const oldestId = accessOrder[0];
            console.log('[EditorCache] 强制淘汰:', oldestId);
            remove(oldestId);
        }
    }

    /**
     * 清空所有缓存
     */
    function clear() {
        const ids = Array.from(cache.keys());
        ids.forEach(id => remove(id));
        accessOrder = [];
        console.log('[EditorCache] 缓存已清空');
    }

    // ==================== 辅助方法 ====================

    function updateAccessOrder(tabId) {
        accessOrder = accessOrder.filter(id => id !== tabId);
        accessOrder.push(tabId);
    }

    function has(tabId) {
        return cache.has(tabId);
    }

    function get(tabId) {
        if (!cache.has(tabId)) return null;
        
        const entry = cache.get(tabId);
        entry.lastAccess = Date.now();
        updateAccessOrder(tabId);
        
        return entry.editor;
    }

    function getEntry(tabId) {
        return cache.get(tabId) || null;
    }

    /**
     * 获取缓存统计信息
     */
    function getStats() {
        return {
            size: cache.size,
            maxSize: CONFIG.maxSize,
            entries: Array.from(cache.entries()).map(([id, entry]) => ({
                tabId: id,
                lastAccess: entry.lastAccess,
                hasEditor: !!entry.editor,
                hasContent: !!entry.content
            })),
            accessOrder: [...accessOrder]
        };
    }

    /**
     * 更新配置
     */
    function configure(options) {
        Object.assign(CONFIG, options);
        
        // 如果新的 maxSize 更小，可能需要淘汰
        while (cache.size > CONFIG.maxSize) {
            evictLRU();
        }
    }

    // 导出公共接口
    return {
        acquire: acquire,
        add: add,
        release: release,
        remove: remove,
        evict: evictLRU,
        clear: clear,
        has: has,
        get: get,
        getEntry: getEntry,
        getStats: getStats,
        configure: configure,
        CONFIG: CONFIG
    };
})();
