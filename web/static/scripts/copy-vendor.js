// 复制 node_modules 中的依赖到 vendor 目录
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'vditor', 'dist');
const destDir = path.join(__dirname, '..', 'vendor', 'vditor', 'dist');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('复制 vditor 到 vendor 目录...');
copyDir(srcDir, destDir);
console.log('完成！');
