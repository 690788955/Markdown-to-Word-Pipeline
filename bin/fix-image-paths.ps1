# ==========================================
# 修复 Markdown 文件中的图片路径
# ==========================================
# 将 Windows 风格路径 (.\images\) 转换为跨平台路径 (images/)
#
# 使用方式:
#   .\bin\fix-image-paths.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 修复 Markdown 图片路径 ===" -ForegroundColor Cyan

# 查找所有包含 .\images\ 的 Markdown 文件
Write-Host "搜索需要修复的文件..."
$files = Get-ChildItem -Path . -Filter "*.md" -Recurse -File | 
    Where-Object { (Get-Content $_.FullName -Raw) -match '\\.\\images\\' }

if ($files.Count -eq 0) {
    Write-Host "✅ 未发现需要修复的文件" -ForegroundColor Green
    exit 0
}

Write-Host "发现以下文件需要修复:"
$files | ForEach-Object { Write-Host "  - $($_.FullName)" }
Write-Host ""

# 备份并替换
foreach ($file in $files) {
    Write-Host "处理: $($file.FullName)" -ForegroundColor Yellow
    
    # 创建备份
    $backupPath = "$($file.FullName).bak"
    Copy-Item -Path $file.FullName -Destination $backupPath -Force
    
    # 读取内容
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # 替换路径: .\images\ -> images/
    $content = $content -replace '\\.\\images\\', 'images/'
    
    # 替换路径: ./images\ -> images/
    $content = $content -replace '\.\/images\\', 'images/'
    
    # 写回文件
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
    
    Write-Host "  ✅ 已修复 (备份: $backupPath)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 修复完成 ===" -ForegroundColor Cyan
Write-Host "如需恢复，可使用备份文件 (*.bak)" -ForegroundColor Gray
