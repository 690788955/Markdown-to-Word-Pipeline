# ==========================================
# PDF 依赖检查脚本 (Windows PowerShell)
# ==========================================

param(
    [switch]$Quiet,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
PDF 依赖检查脚本

用法: .\bin\check-pdf-deps.ps1 [-Quiet] [-Help]

参数:
  -Quiet    静默模式，仅在有缺失依赖时输出
  -Help     显示此帮助信息

检查项目:
  - Pandoc: 文档转换引擎
  - XeLaTeX: PDF 生成引擎
  - Eisvogel: LaTeX 模板
  - 中文字体: Noto Sans CJK 或其他中文字体
"@
    exit 0
}

$missing = @()
$warnings = @()

function Write-Status {
    param([string]$Name, [bool]$Found, [string]$Version = "", [string]$Path = "")
    if (-not $Quiet) {
        if ($Found) {
            $info = if ($Version) { " ($Version)" } elseif ($Path) { " [$Path]" } else { "" }
            Write-Host "[OK] $Name$info" -ForegroundColor Green
        } else {
            Write-Host "[缺失] $Name" -ForegroundColor Red
        }
    }
}

if (-not $Quiet) {
    Write-Host "=========================================="
    Write-Host "PDF 依赖检查"
    Write-Host "=========================================="
    Write-Host ""
}

# 检查 Pandoc
$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if ($pandoc) {
    $pandocVersion = (pandoc --version | Select-Object -First 1) -replace "pandoc ", ""
    Write-Status "Pandoc" $true $pandocVersion
} else {
    Write-Status "Pandoc" $false
    $missing += @{
        Name = "Pandoc"
        Install = "choco install pandoc"
        Url = "https://pandoc.org/installing.html"
    }
}

# 检查 XeLaTeX
$xelatex = Get-Command xelatex -ErrorAction SilentlyContinue
if ($xelatex) {
    $xelatexVersion = (xelatex --version | Select-Object -First 1)
    Write-Status "XeLaTeX" $true $xelatexVersion
} else {
    Write-Status "XeLaTeX" $false
    $missing += @{
        Name = "XeLaTeX (TeX Live)"
        Install = "choco install texlive"
        Url = "https://www.tug.org/texlive/"
    }
}

# 检查 Eisvogel 模板
$templatePaths = @(
    "$env:APPDATA\pandoc\templates\eisvogel.latex",
    "$env:USERPROFILE\.pandoc\templates\eisvogel.latex",
    "$env:LOCALAPPDATA\pandoc\templates\eisvogel.latex"
)

$eisvogelFound = $false
$eisvogelPath = ""
foreach ($path in $templatePaths) {
    if (Test-Path $path) {
        $eisvogelFound = $true
        $eisvogelPath = $path
        break
    }
}

if ($eisvogelFound) {
    Write-Status "Eisvogel 模板" $true "" $eisvogelPath
} else {
    Write-Status "Eisvogel 模板" $false
    $missing += @{
        Name = "Eisvogel 模板"
        Install = @"
`$templateDir = "`$env:APPDATA\pandoc\templates"
New-Item -ItemType Directory -Path `$templateDir -Force
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex" -OutFile "`$templateDir\eisvogel.latex"
"@
        Url = "https://github.com/Wandmalfarbe/pandoc-latex-template"
    }
}

# 检查中文字体
$fontNames = @(
    "Noto Sans CJK SC",
    "Noto Sans CJK",
    "Microsoft YaHei",
    "SimHei",
    "SimSun",
    "Source Han Sans SC"
)

$fontFound = $false
$foundFontName = ""

# 使用 PowerShell 检查已安装字体
$installedFonts = [System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object { $_.Name }

foreach ($fontName in $fontNames) {
    if ($installedFonts -contains $fontName) {
        $fontFound = $true
        $foundFontName = $fontName
        break
    }
}

# 备用检查：检查字体文件夹
if (-not $fontFound) {
    $fontPaths = @(
        "C:\Windows\Fonts\NotoSansCJK*.ttf",
        "C:\Windows\Fonts\NotoSansCJK*.otf",
        "C:\Windows\Fonts\msyh*.ttc",
        "C:\Windows\Fonts\simhei.ttf"
    )
    foreach ($pattern in $fontPaths) {
        if (Get-ChildItem $pattern -ErrorAction SilentlyContinue) {
            $fontFound = $true
            $foundFontName = "系统字体"
            break
        }
    }
}

if ($fontFound) {
    Write-Status "中文字体" $true $foundFontName
} else {
    Write-Status "中文字体" $false
    $warnings += @{
        Name = "中文字体"
        Message = "未检测到推荐的中文字体，PDF 可能无法正确显示中文"
        Install = "下载 Noto Sans CJK: https://github.com/googlefonts/noto-cjk/releases"
    }
}

# 输出结果
if (-not $Quiet) {
    Write-Host ""
}

if ($missing.Count -gt 0) {
    Write-Host "=========================================="
    Write-Host "缺失依赖安装指南"
    Write-Host "=========================================="
    Write-Host ""
    
    foreach ($dep in $missing) {
        Write-Host "[$($dep.Name)]" -ForegroundColor Yellow
        Write-Host "安装命令:"
        Write-Host "  $($dep.Install)" -ForegroundColor Cyan
        Write-Host "官方文档: $($dep.Url)"
        Write-Host ""
    }
    
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host "=========================================="
    Write-Host "警告"
    Write-Host "=========================================="
    Write-Host ""
    
    foreach ($warn in $warnings) {
        Write-Host "[$($warn.Name)]" -ForegroundColor Yellow
        Write-Host $warn.Message
        Write-Host "建议: $($warn.Install)"
        Write-Host ""
    }
}

if ($missing.Count -eq 0) {
    if (-not $Quiet) {
        Write-Host "=========================================="
        Write-Host "所有 PDF 依赖已就绪！" -ForegroundColor Green
        Write-Host "=========================================="
    }
    exit 0
}
