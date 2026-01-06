<#
.SYNOPSIS
    安装项目字体 (Windows)

.DESCRIPTION
    将 fonts 目录下的字体安装到系统

.EXAMPLE
    .\scripts\install-fonts.ps1
#>

$ErrorActionPreference = "Stop"

$fontsDir = "fonts"
$systemFontsDir = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"

# 检查字体目录
if (-not (Test-Path $fontsDir)) {
    Write-Host "[错误] fonts 目录不存在" -ForegroundColor Red
    exit 1
}

$fontFiles = Get-ChildItem -Path $fontsDir -Include "*.otf", "*.ttf" -File

if ($fontFiles.Count -eq 0) {
    Write-Host "[警告] fonts 目录下没有字体文件" -ForegroundColor Yellow
    Write-Host "请下载字体文件放到 fonts 目录，参考 fonts/README.md"
    exit 0
}

Write-Host "=========================================="
Write-Host "安装字体"
Write-Host "=========================================="

# 确保目标目录存在
if (-not (Test-Path $systemFontsDir)) {
    New-Item -ItemType Directory -Path $systemFontsDir -Force | Out-Null
}

foreach ($font in $fontFiles) {
    $destPath = Join-Path $systemFontsDir $font.Name
    
    if (Test-Path $destPath) {
        Write-Host "  [跳过] $($font.Name) (已安装)" -ForegroundColor Gray
    } else {
        try {
            Copy-Item $font.FullName $destPath -Force
            
            # 注册字体到注册表
            $fontName = [System.IO.Path]::GetFileNameWithoutExtension($font.Name)
            $regPath = "HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"
            Set-ItemProperty -Path $regPath -Name "$fontName (TrueType)" -Value $destPath -ErrorAction SilentlyContinue
            
            Write-Host "  [安装] $($font.Name)" -ForegroundColor Green
        } catch {
            Write-Host "  [失败] $($font.Name): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "完成！可能需要重启应用程序才能使用新字体。" -ForegroundColor Cyan
