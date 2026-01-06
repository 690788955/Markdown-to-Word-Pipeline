<# 
.SYNOPSIS
    运维文档生成系统 - Windows 构建脚本

.DESCRIPTION
    将 Markdown 运维文档模块组合并转换为 Word 格式

.EXAMPLE
    .\build.ps1                                    # 使用默认配置构建
    .\build.ps1 -Client example-client             # 指定客户构建
    .\build.ps1 -Client example-client -Doc 运维手册  # 构建运维手册
    .\build.ps1 -Client example-client -ListDocs   # 列出文档类型
    .\build.ps1 -Client example-client -BuildAll   # 构建所有文档
    .\build.ps1 -ListClients                       # 列出所有客户
    .\build.ps1 -Clean                             # 清理构建目录
    .\build.ps1 -Help                              # 显示帮助
#>

param(
    [string]$Client = "default",
    [string]$Doc = "",           # 新增：指定文档类型
    [switch]$ListClients,
    [switch]$ListDocs,           # 新增：列出客户的所有文档
    [switch]$ListModules,
    [switch]$BuildAll,           # 新增：构建客户的所有文档
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
运维文档生成系统 (Windows)
==========================================

用法: .\build.ps1 [参数]

参数:
  -Client <名称>    指定客户配置（默认: default）
  -Doc <文档类型>   指定文档类型（如：运维手册、部署手册）
  -ListClients      列出所有可用客户配置
  -ListDocs         列出指定客户的所有文档类型
  -ListModules      列出所有文档模块
  -BuildAll         构建指定客户的所有文档
  -Clean            清理构建产物
  -InitTemplate     生成默认 Word 模板
  -Help             显示帮助信息

示例:
  .\build.ps1                                     # 默认构建
  .\build.ps1 -Client example-client              # 使用 config.yaml
  .\build.ps1 -Client example-client -Doc 运维手册   # 构建运维手册
  .\build.ps1 -Client example-client -Doc 部署手册   # 构建部署手册
  .\build.ps1 -Client example-client -Doc 应急预案   # 构建应急预案
  .\build.ps1 -Client example-client -Doc 日常巡检   # 构建日常巡检手册
  .\build.ps1 -Client example-client -Doc 交接文档   # 构建交接文档
  .\build.ps1 -Client example-client -ListDocs    # 列出文档类型
  .\build.ps1 -Client example-client -BuildAll    # 构建所有文档
  .\build.ps1 -ListClients                        # 列出所有客户
  .\build.ps1 -ListModules                        # 列出所有模块
  .\build.ps1 -Clean                              # 清理构建目录

文档模块:
  01-概述.md       概述、适用范围
  02-系统架构.md   系统架构、服务器清单
  03-日常运维.md   日常巡检、常用命令
  04-故障处理.md   故障分级、处理流程
  05-监控告警.md   监控体系、告警阈值
  06-备份恢复.md   备份策略、恢复流程
  07-安全规范.md   访问控制、安全检查
  08-部署上线.md   部署流程、回滚方案
  09-应急预案.md   应急响应、灾难恢复
  10-项目背景.md   项目背景、业务说明
  11-联系人.md     联系人清单、值班表

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

# 列出客户的所有文档类型
function Show-Docs {
    param([string]$ClientName)
    
    $clientDir = Join-Path $ClientsDir $ClientName
    if (-not (Test-Path $clientDir)) {
        Write-Host "[错误] 客户不存在: $ClientName" -ForegroundColor Red
        return
    }
    
    Write-Host "客户 [$ClientName] 的文档类型:"
    Get-ChildItem -Path $clientDir -Filter "*.yaml" | ForEach-Object {
        $docName = $_.BaseName
        if ($docName -eq "metadata") {
            # 跳过 metadata.yaml
        } elseif ($docName -eq "config") {
            Write-Host "  - (默认)" -ForegroundColor Gray
        } else {
            Write-Host "  - $docName"
        }
    }
}

# ==========================================
# 清理
# ==========================================
function Invoke-Clean {
    Write-Host "清理构建目录..."
    if (Test-Path $BuildDir) {
        Remove-Item -Path $BuildDir -Recurse -Force
        Write-Host "已删除 $BuildDir 目录"
    } else {
        Write-Host "$BuildDir 目录不存在"
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
    param(
        [string]$ClientName,
        [string]$DocType = ""
    )
    
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
    $clientMeta = Join-Path $clientDir "metadata.yaml"
    
    # 确定配置文件
    if ($DocType -ne "") {
        $configFile = Join-Path $clientDir "$DocType.yaml"
    } else {
        $configFile = Join-Path $clientDir "config.yaml"
    }
    
    # 检查客户配置
    if (-not (Test-Path $clientDir)) {
        Write-Host "[错误] 客户配置不存在: $ClientName" -ForegroundColor Red
        Write-Host ""
        Show-Clients
        exit 1
    }
    
    if (-not (Test-Path $configFile)) {
        Write-Host "[错误] 配置文件不存在: $configFile" -ForegroundColor Red
        if ($DocType -ne "") {
            Write-Host "可用的文档类型:"
            Show-Docs -ClientName $ClientName
        }
        exit 1
    }
    
    $docLabel = if ($DocType -ne "") { "[$DocType]" } else { "" }
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "构建文档 - 客户: $ClientName $docLabel" -ForegroundColor Cyan
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
if ($ListDocs) { Show-Docs -ClientName $Client; exit 0 }
if ($Clean) { Invoke-Clean; exit 0 }
if ($InitTemplate) { Initialize-Template; exit 0 }

# 构建所有文档
if ($BuildAll) {
    $clientDir = Join-Path $ClientsDir $Client
    if (-not (Test-Path $clientDir)) {
        Write-Host "[错误] 客户不存在: $Client" -ForegroundColor Red
        exit 1
    }
    
    Get-ChildItem -Path $clientDir -Filter "*.yaml" | ForEach-Object {
        $docName = $_.BaseName
        if ($docName -ne "metadata") {
            if ($docName -eq "config") {
                Invoke-Build -ClientName $Client -DocType ""
            } else {
                Invoke-Build -ClientName $Client -DocType $docName
            }
            Write-Host ""
        }
    }
    exit 0
}

# 单个文档构建
Invoke-Build -ClientName $Client -DocType $Doc
