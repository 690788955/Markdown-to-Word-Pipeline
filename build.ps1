<# 
.SYNOPSIS
    Markdown to Word Pipeline - Windows 构建脚本

.DESCRIPTION
    将 Markdown 文档组合并转换为 Word 格式

.EXAMPLE
    .\build.ps1                     # 使用默认配置构建
    .\build.ps1 -Client 银行客户     # 指定客户构建
    .\build.ps1 -ListClients        # 列出所有客户
    .\build.ps1 -Clean              # 清理构建目录
    .\build.ps1 -InitTemplate       # 生成默认模板
    .\build.ps1 -Help               # 显示帮助
#>

param(
    [string]$Client = "default",
    [switch]$ListClients,
    [switch]$ListModules,
    [switch]$Clean,
    [switch]$InitTemplate,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 配置
$SrcDir = "src"
$ClientsDir = "clients"
$TemplatesDir = "templates"
$BuildDir = "build"

# ==========================================
# 帮助信息
# ==========================================
function Show-Help {
    Write-Host @"
==========================================
Markdown to Word Pipeline (Windows)
==========================================

用法: .\build.ps1 [参数]

参数:
  -Client <名称>    指定客户配置（默认: default）
  -ListClients      列出所有可用客户配置
  -ListModules      列出所有文档模块
  -Clean            清理构建产物
  -InitTemplate     生成默认 Word 模板
  -Help             显示帮助信息

示例:
  .\build.ps1
  .\build.ps1 -Client 银行客户
  .\build.ps1 -Client 零售客户
  .\build.ps1 -ListClients
  .\build.ps1 -Clean

"@
}

# ==========================================
# 列表命令
# ==========================================
function Show-Clients {
    Write-Host "可用客户配置:"
    Get-ChildItem -Path $ClientsDir -Directory | ForEach-Object {
        Write-Host "  - $($_.Name)"
    }
}

function Show-Modules {
    Write-Host "可用文档模块 (${SrcDir}/):"
    Get-ChildItem -Path $SrcDir -Include "*.md", "*.yaml" -File -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "  - $relativePath"
    }
}

# ==========================================
# 清理
# ==========================================
function Invoke-Clean {
    Write-Host "清理构建目录..."
    if (Test-Path $BuildDir) {
        Get-ChildItem -Path $BuildDir -Include "*.docx", "*.pdf" -File | Remove-Item -Force
    }
    Write-Host "完成。"
}

# ==========================================
# 初始化模板
# ==========================================
function Initialize-Template {
    Write-Host "生成默认 Word 模板..."
    
    $pandocPath = Get-Command pandoc -ErrorAction SilentlyContinue
    if (-not $pandocPath) {
        Write-Host "[错误] 未找到 Pandoc，请先安装。" -ForegroundColor Red
        Write-Host "下载地址: https://pandoc.org/installing.html"
        exit 1
    }
    
    if (-not (Test-Path $TemplatesDir)) {
        New-Item -ItemType Directory -Path $TemplatesDir | Out-Null
    }
    
    $templatePath = Join-Path $TemplatesDir "default.docx"
    $tempMd = [System.IO.Path]::GetTempFileName() + ".md"
    
    "# Template`n`nSample content." | Out-File -FilePath $tempMd -Encoding UTF8
    
    try {
        & pandoc $tempMd -o $templatePath
        Write-Host "模板已创建: $templatePath" -ForegroundColor Green
    } finally {
        Remove-Item $tempMd -Force -ErrorAction SilentlyContinue
    }
}

# ==========================================
# YAML 解析函数
# ==========================================
function Read-YamlValue {
    param([string]$FilePath, [string]$Key)
    
    if (-not (Test-Path $FilePath)) { return $null }
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    if ($content -match "(?m)^${Key}:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        return $Matches[1].Trim()
    }
    return $null
}

function Read-YamlList {
    param([string]$FilePath, [string]$Key)
    
    if (-not (Test-Path $FilePath)) { return @() }
    
    $content = Get-Content $FilePath -Encoding UTF8
    $inList = $false
    $items = @()
    
    foreach ($line in $content) {
        if ($line -match "^${Key}:") {
            $inList = $true
            continue
        }
        if ($inList) {
            if ($line -match "^\s+-\s+(.+)$") {
                $items += $Matches[1].Trim().Trim('"').Trim("'")
            }
            elseif ($line -match "^\S" -and $line -notmatch "^\s*#") {
                break
            }
        }
    }
    return $items
}

# ==========================================
# 构建
# ==========================================
function Invoke-Build {
    param([string]$ClientName)
    
    # 检查 Pandoc
    $pandocPath = Get-Command pandoc -ErrorAction SilentlyContinue
    if (-not $pandocPath) {
        Write-Host "[错误] 未找到 Pandoc，请先安装。" -ForegroundColor Red
        Write-Host "下载地址: https://pandoc.org/installing.html"
        exit 1
    }
    
    # 创建目录
    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir | Out-Null
    }
    
    $clientDir = Join-Path $ClientsDir $ClientName
    $configFile = Join-Path $clientDir "config.yaml"
    $clientMeta = Join-Path $clientDir "metadata.yaml"
    
    # 检查客户配置
    if (-not (Test-Path $clientDir)) {
        Write-Host "[错误] 客户配置不存在: $ClientName" -ForegroundColor Red
        Write-Host ""
        Show-Clients
        exit 1
    }
    
    if (-not (Test-Path $configFile)) {
        Write-Host "[错误] 配置文件不存在: $configFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "构建文档 - 客户: $ClientName" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    
    # 读取配置
    $clientNameValue = Read-YamlValue -FilePath $configFile -Key "client_name"
    $template = Read-YamlValue -FilePath $configFile -Key "template"
    $outputPattern = Read-YamlValue -FilePath $configFile -Key "output_pattern"
    $modules = Read-YamlList -FilePath $configFile -Key "modules"
    $pandocArgs = Read-YamlList -FilePath $configFile -Key "pandoc_args"
    
    # 默认值
    if (-not $clientNameValue) { $clientNameValue = $ClientName }
    if (-not $template) { $template = "default.docx" }
    if (-not $outputPattern) { $outputPattern = "{title}_{date}.docx" }
    if ($modules.Count -eq 0) {
        $modules = @("$SrcDir/metadata.yaml", "$SrcDir/01-executive-summary.md")
    }
    
    Write-Host "客户名称: $clientNameValue"
    Write-Host "模板: $template"
    Write-Host "模块: $($modules -join ', ')"
    
    # 检查模板
    $templatePath = Join-Path $TemplatesDir $template
    if (-not (Test-Path $templatePath)) {
        Write-Host "[警告] 模板不存在: $templatePath" -ForegroundColor Yellow
        Write-Host "运行 '.\build.ps1 -InitTemplate' 生成默认模板"
        $templatePath = $null
    }
    
    # 检查模块
    $validModules = @()
    foreach ($module in $modules) {
        $modulePath = $module -replace "/", "\"
        if (Test-Path $modulePath) {
            $validModules += $modulePath
        } else {
            Write-Host "[警告] 模块不存在: $modulePath" -ForegroundColor Yellow
        }
    }
    
    if ($validModules.Count -eq 0) {
        Write-Host "[错误] 没有有效的文档模块！" -ForegroundColor Red
        exit 1
    }
    
    # 读取元数据
    $title = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "title"
    $version = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "version"
    $date = Get-Date -Format "yyyy-MM-dd"
    
    # 客户元数据覆盖
    if (Test-Path $clientMeta) {
        $clientTitle = Read-YamlValue -FilePath $clientMeta -Key "title"
        $clientVersion = Read-YamlValue -FilePath $clientMeta -Key "version"
        if ($clientTitle) { $title = $clientTitle }
        if ($clientVersion) { $version = $clientVersion }
    }
    
    if (-not $title) { $title = "Document" }
    if (-not $version) { $version = "v1.0" }
    
    # 生成输出文件名
    $clientNameClean = $clientNameValue -replace "\s+", "_"
    $titleClean = $title -replace "\s+", "_"
    
    $outputFileName = $outputPattern `
        -replace "\{client\}", $clientNameClean `
        -replace "\{title\}", $titleClean `
        -replace "\{version\}", $version `
        -replace "\{date\}", $date
    
    $outputPath = Join-Path $BuildDir $outputFileName
    
    Write-Host "输出: $outputPath"
    Write-Host ""
    
    # 构建 Pandoc 参数
    $pandocCmdArgs = @()
    $pandocCmdArgs += $validModules
    
    if (Test-Path $clientMeta) {
        $pandocCmdArgs += $clientMeta
    }
    
    $pandocCmdArgs += "-o"
    $pandocCmdArgs += $outputPath
    
    if ($templatePath) {
        $pandocCmdArgs += "--reference-doc=$templatePath"
    }
    
    $pandocCmdArgs += "--resource-path=$SrcDir"
    $pandocCmdArgs += $pandocArgs
    
    Write-Host "执行: pandoc $($pandocCmdArgs -join ' ')" -ForegroundColor Gray
    Write-Host ""
    
    # 执行 Pandoc
    try {
        & pandoc $pandocCmdArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "==========================================" -ForegroundColor Green
            Write-Host "构建成功！" -ForegroundColor Green
            Write-Host "输出文件: $outputPath" -ForegroundColor Green
            Write-Host "==========================================" -ForegroundColor Green
        } else {
            Write-Host "[错误] Pandoc 执行失败" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "[错误] 执行失败: $_" -ForegroundColor Red
        exit 1
    }
}

# ==========================================
# 主逻辑
# ==========================================
if ($Help) { Show-Help; exit 0 }
if ($ListClients) { Show-Clients; exit 0 }
if ($ListModules) { Show-Modules; exit 0 }
if ($Clean) { Invoke-Clean; exit 0 }
if ($InitTemplate) { Initialize-Template; exit 0 }

Invoke-Build -ClientName $Client
