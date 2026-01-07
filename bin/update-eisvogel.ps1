#!/usr/bin/env pwsh
# ==========================================
# 更新 Eisvogel LaTeX 模板
# 用于解决 Pandoc 版本兼容性问题
# ==========================================

param(
    [switch]$Force  # 强制更新
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "更新 Eisvogel LaTeX 模板" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 确定模板目录
$templateDir = "$env:APPDATA\pandoc\templates"
$eisvogelPath = "$templateDir\eisvogel.latex"

# 创建目录
if (-not (Test-Path $templateDir)) {
    Write-Host "创建模板目录: $templateDir"
    New-Item -ItemType Directory -Path $templateDir -Force | Out-Null
}

# 检查现有版本
if (Test-Path $eisvogelPath) {
    $existingFile = Get-Item $eisvogelPath
    Write-Host "现有模板: $eisvogelPath"
    Write-Host "  修改时间: $($existingFile.LastWriteTime)"
    Write-Host "  文件大小: $($existingFile.Length) bytes"
    
    if (-not $Force) {
        # 备份现有文件
        $backupPath = "$eisvogelPath.backup"
        Copy-Item $eisvogelPath $backupPath -Force
        Write-Host "  已备份到: $backupPath"
    }
    Write-Host ""
}

# 下载最新版本
$downloadUrl = "https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/refs/heads/master/eisvogel.latex"
Write-Host "下载最新 Eisvogel 模板..."
Write-Host "  URL: $downloadUrl"

try {
    # 使用 TLS 1.2
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $eisvogelPath -UseBasicParsing
    
    $newFile = Get-Item $eisvogelPath
    Write-Host ""
    Write-Host "[成功] 模板已更新!" -ForegroundColor Green
    Write-Host "  路径: $eisvogelPath"
    Write-Host "  大小: $($newFile.Length) bytes"
    Write-Host ""
    Write-Host "现在可以重新尝试生成 PDF 了。" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "[错误] 下载失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "手动下载步骤:" -ForegroundColor Yellow
    Write-Host "1. 访问: https://github.com/Wandmalfarbe/pandoc-latex-template/releases"
    Write-Host "2. 下载最新版本的 eisvogel.latex"
    Write-Host "3. 复制到: $templateDir"
    
    # 恢复备份
    $backupPath = "$eisvogelPath.backup"
    if (Test-Path $backupPath) {
        Copy-Item $backupPath $eisvogelPath -Force
        Write-Host ""
        Write-Host "已恢复备份文件"
    }
    exit 1
}
