<# 
.SYNOPSIS
    运维文档生成系统 - Windows 构建脚本

.DESCRIPTION
    将 Markdown 运维文档模块组合并转换为 Word 或 PDF 格式

.EXAMPLE
    .\build.ps1                                    # 使用默认配置构建
    .\build.ps1 -Client example-client             # 指定客户构建
    .\build.ps1 -Client example-client -Doc 运维手册  # 构建运维手册
    .\build.ps1 -Client example-client -Format pdf # 生成 PDF 格式
    .\build.ps1 -Client example-client -ListDocs   # 列出文档类型
    .\build.ps1 -Client example-client -BuildAll   # 构建所有文档
    .\build.ps1 -ListClients                       # 列出所有客户
    .\build.ps1 -Clean                             # 清理构建目录
    .\build.ps1 -CheckPdfDeps                      # 检查 PDF 依赖
    .\build.ps1 -Help                              # 显示帮助
#>

param(
    [string]$Client = "default",
    [string]$Doc = "",           # 指定文档类型
    [string]$ClientName = "",    # 自定义客户名称（覆盖配置）
    [ValidateSet("word", "pdf")]
    [string]$Format = "word",    # 输出格式：word 或 pdf
    [string]$WorkDir = "",       # 工作目录（包含 src, clients, templates）
    [string[]]$Var = @(),        # 变量值，格式：name=value
    [switch]$ListClients,
    [switch]$ListDocs,           # 列出客户的所有文档
    [switch]$ListModules,
    [switch]$BuildAll,           # 构建客户的所有文档
    [switch]$Clean,
    [switch]$InitTemplate,
    [switch]$InstallFonts,
    [switch]$CheckPdfDeps,       # 检查 PDF 生成依赖
    [switch]$Help
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 确定工作目录
if ($WorkDir -ne "") {
    $BaseDir = $WorkDir
} else {
    # 默认使用脚本所在目录的父目录（如果脚本在 bin 目录下）
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if ((Split-Path -Leaf $ScriptDir) -eq "bin") {
        $BaseDir = Split-Path -Parent $ScriptDir
    } else {
        $BaseDir = $ScriptDir
    }
}

# 切换到工作目录
Push-Location $BaseDir

# 配置（相对于工作目录）
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
  -Format <格式>    输出格式：word 或 pdf（默认: word）
  -Var <name=value> 设置变量值，可多次使用（如：-Var "项目名称=XX系统"）
  -ListClients      列出所有可用客户配置
  -ListDocs         列出指定客户的所有文档类型
  -ListModules      列出所有文档模块
  -BuildAll         构建指定客户的所有文档
  -Clean            清理构建产物
  -InitTemplate     生成默认 Word 模板
  -InstallFonts     安装项目字体
  -CheckPdfDeps     检查 PDF 生成所需依赖
  -Help             显示帮助信息

示例:
  .\build.ps1                                     # 默认构建 Word
  .\build.ps1 -Format pdf                         # 生成 PDF
  .\build.ps1 -Client 标准文档 -Doc 运维手册      # 构建运维手册
  .\build.ps1 -Client 标准文档 -Doc 运维手册 -Format pdf  # 生成 PDF 格式
  .\build.ps1 -Client 标准文档 -Doc 部署手册   # 构建部署手册
  .\build.ps1 -Client 标准文档 -Doc 应急预案   # 构建应急预案
  .\build.ps1 -Client 标准文档 -Doc 日常巡检   # 构建日常巡检手册
  .\build.ps1 -Client 标准文档 -Doc 交接文档   # 构建交接文档
  .\build.ps1 -Client 标准文档 -ListDocs    # 列出文档类型
  .\build.ps1 -Client 标准文档 -BuildAll    # 构建所有文档
  .\build.ps1 -Var "项目名称=XX系统" -Var "版本号=v2.0"  # 设置变量
  .\build.ps1 -ListClients                        # 列出所有客户
  .\build.ps1 -ListModules                        # 列出所有模块
  .\build.ps1 -InstallFonts                       # 安装字体
  .\build.ps1 -CheckPdfDeps                       # 检查 PDF 依赖
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

PDF 生成依赖:
  - Pandoc (必需)
  - XeLaTeX / TeX Live (必需)
  - Eisvogel 模板 (必需)
  - 中文字体如 Noto Sans CJK (推荐)

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
# 变量处理函数
# ==========================================

# 解析命令行变量参数
function Parse-VariableArgs {
    param([string[]]$VarArgs)
    
    $vars = @{}
    foreach ($arg in $VarArgs) {
        if ($arg -match "^([^=]+)=(.*)$") {
            $vars[$Matches[1].Trim()] = $Matches[2]
        }
    }
    return $vars
}

# 从文件提取变量声明
function Get-VariablesFromFile {
    param([string]$FilePath)
    
    if (-not (Test-Path $FilePath)) { return @{} }
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    
    # 检查是否有 front-matter
    if (-not $content.StartsWith("---")) { return @{} }
    
    # 提取 front-matter
    $endIndex = $content.IndexOf("`n---", 3)
    if ($endIndex -eq -1) { return @{} }
    
    $fmContent = $content.Substring(3, $endIndex - 3)
    
    # 简单解析 variables 节
    $vars = @{}
    $inVariables = $false
    $currentVar = $null
    $indent = 0
    
    foreach ($line in $fmContent -split "`n") {
        if ($line -match "^variables:") {
            $inVariables = $true
            continue
        }
        if ($inVariables) {
            # 检查是否退出 variables 节
            if ($line -match "^[a-zA-Z]" -and -not $line.StartsWith(" ")) {
                break
            }
            # 解析变量名
            if ($line -match "^\s{2}([a-zA-Z_][a-zA-Z0-9_.]*):(.*)$") {
                $currentVar = $Matches[1]
                $value = $Matches[2].Trim()
                if ($value -and $value -ne "") {
                    # 简单值
                    $vars[$currentVar] = @{ default = $value.Trim('"').Trim("'") }
                } else {
                    $vars[$currentVar] = @{}
                }
            }
            # 解析变量属性
            elseif ($currentVar -and $line -match "^\s{4}(default|type|description):\s*(.+)$") {
                $key = $Matches[1]
                $val = $Matches[2].Trim().Trim('"').Trim("'")
                $vars[$currentVar][$key] = $val
            }
        }
    }
    
    return $vars
}

# 渲染文件内容（替换变量）
function Render-FileContent {
    param(
        [string]$Content,
        [hashtable]$Variables,
        [hashtable]$Values
    )
    
    $result = $Content
    
    # 1. 临时替换转义的占位符
    $escapePlaceholder = "`0ESCAPED`0"
    $escapedMatches = [regex]::Matches($result, '\\(\{\{[^}]*\}\})')
    $escapedOriginals = @()
    foreach ($match in $escapedMatches) {
        $escapedOriginals += $match.Groups[1].Value
    }
    $result = [regex]::Replace($result, '\\(\{\{[^}]*\}\})', $escapePlaceholder)
    
    # 2. 替换已声明的变量
    $result = [regex]::Replace($result, '\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}', {
        param($match)
        $varName = $match.Groups[1].Value
        
        # 只替换已声明的变量
        if (-not $Variables.ContainsKey($varName)) {
            return $match.Value
        }
        
        # 优先使用传入的值
        if ($Values.ContainsKey($varName)) {
            return $Values[$varName]
        }
        
        # 使用默认值
        if ($Variables[$varName].ContainsKey("default")) {
            return $Variables[$varName]["default"]
        }
        
        return $match.Value
    })
    
    # 3. 恢复转义的占位符
    for ($i = 0; $i -lt $escapedOriginals.Count; $i++) {
        $result = $result.Replace($escapePlaceholder, $escapedOriginals[$i], 1)
    }
    
    # 4. 移除 front-matter 中的 variables 节
    if ($result.StartsWith("---")) {
        $endIndex = $result.IndexOf("`n---", 3)
        if ($endIndex -gt 0) {
            $fmContent = $result.Substring(0, $endIndex + 4)
            $bodyContent = $result.Substring($endIndex + 4)
            
            # 移除 variables 节
            $newFm = [regex]::Replace($fmContent, '(?ms)^variables:.*?(?=^[a-zA-Z]|\z)', '', [System.Text.RegularExpressions.RegexOptions]::Multiline)
            $result = $newFm + $bodyContent
        }
    }
    
    return $result
}

# 处理模块文件的变量渲染
function Process-ModulesWithVariables {
    param(
        [string[]]$ModulePaths,
        [hashtable]$CliValues
    )
    
    # 收集所有变量声明
    $allVars = @{}
    foreach ($path in $ModulePaths) {
        $vars = Get-VariablesFromFile -FilePath $path
        foreach ($key in $vars.Keys) {
            if (-not $allVars.ContainsKey($key)) {
                $allVars[$key] = $vars[$key]
            }
        }
    }
    
    # 如果没有变量，直接返回原路径
    if ($allVars.Count -eq 0) {
        return $ModulePaths
    }
    
    Write-Host "检测到变量: $($allVars.Keys -join ', ')" -ForegroundColor Cyan
    
    # 创建临时目录
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "docgen_$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # 渲染每个文件
    $renderedPaths = @()
    foreach ($path in $ModulePaths) {
        $content = Get-Content $path -Raw -Encoding UTF8
        $vars = Get-VariablesFromFile -FilePath $path
        
        if ($vars.Count -gt 0) {
            $rendered = Render-FileContent -Content $content -Variables $vars -Values $CliValues
            $tempPath = Join-Path $tempDir (Split-Path $path -Leaf)
            $rendered | Out-File -FilePath $tempPath -Encoding UTF8 -NoNewline
            $renderedPaths += $tempPath
        } else {
            $renderedPaths += $path
        }
    }
    
    return $renderedPaths
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
            # 跳过注释行
            if ($line -match "^\s*#") {
                continue
            }
            if ($line -match "^\s+-\s+(.+)$") {
                $items += $Matches[1].Trim().Trim('"').Trim("'")
            }
            elseif ($line -match "^\S") {
                break
            }
        }
    }
    return $items
}

# ==========================================
# PDF 选项读取函数
# ==========================================
function Read-PdfOptions {
    param([string]$FilePath)
    
    $options = @{
        # 封面设置
        titlepage = $true
        titlepage_color = "2C3E50"
        titlepage_text_color = "FFFFFF"
        titlepage_rule_color = "3498DB"
        logo = ""
        logo_width = "100"
        # 代码设置
        listings = $true
        listings_no_page_break = $true
        code_block_font_size = "\small"
        # 页眉页脚
        header_left = "\leftmark"
        header_right = "\thepage"
        footer_left = ""
        footer_center = ""
        footer_right = ""
        # 字体设置 - 使用更通用的字体名称
        CJKmainfont = "Microsoft YaHei"
        mainfont = "Microsoft YaHei"
        monofont = "Consolas"
        # 目录设置
        toc = $true
        toc_depth = 3
        number_sections = $true
        # 链接设置
        colorlinks = $true
        linkcolor = "blue"
    }
    
    if (-not (Test-Path $FilePath)) { return $options }
    
    $content = Get-Content $FilePath -Encoding UTF8
    $inPdfOptions = $false
    
    foreach ($line in $content) {
        if ($line -match "^pdf_options:") {
            $inPdfOptions = $true
            continue
        }
        if ($inPdfOptions) {
            if ($line -match "^\s+(\w+):\s*(.+)$") {
                $key = $Matches[1].Trim()
                $value = $Matches[2].Trim().Trim('"').Trim("'")
                if ($options.ContainsKey($key)) {
                    # 转换布尔值
                    if ($value -eq "true") { $value = $true }
                    elseif ($value -eq "false") { $value = $false }
                    # 转换数字
                    elseif ($value -match "^\d+$") { $value = [int]$value }
                    $options[$key] = $value
                }
            }
            elseif ($line -match "^\S" -and $line -notmatch "^\s*#") {
                break
            }
        }
    }
    
    return $options
}

# ==========================================
# PDF 依赖检查
# ==========================================
function Test-PdfDependencies {
    param([switch]$Verbose)
    
    $allOk = $true
    
    # 检查 Pandoc
    $pandocPath = Get-Command pandoc -ErrorAction SilentlyContinue
    if ($pandocPath) {
        if ($Verbose) { Write-Host "[OK] Pandoc 已安装: $($pandocPath.Source)" -ForegroundColor Green }
    } else {
        Write-Host "[错误] Pandoc 未安装" -ForegroundColor Red
        Write-Host "  安装: choco install pandoc" -ForegroundColor Yellow
        Write-Host "  或下载: https://pandoc.org/installing.html" -ForegroundColor Yellow
        $allOk = $false
    }
    
    # 检查 XeLaTeX
    $xelatexPath = Get-Command xelatex -ErrorAction SilentlyContinue
    if ($xelatexPath) {
        if ($Verbose) { Write-Host "[OK] XeLaTeX 已安装: $($xelatexPath.Source)" -ForegroundColor Green }
    } else {
        Write-Host "[错误] XeLaTeX 未安装" -ForegroundColor Red
        Write-Host "  安装: choco install texlive" -ForegroundColor Yellow
        Write-Host "  或下载: https://www.tug.org/texlive/" -ForegroundColor Yellow
        $allOk = $false
    }
    
    # 检查 Eisvogel 模板
    $templatePaths = @(
        "$env:APPDATA\pandoc\templates\eisvogel.latex",
        "$env:USERPROFILE\.local\share\pandoc\templates\eisvogel.latex",
        "$env:USERPROFILE\.pandoc\templates\eisvogel.latex"
    )
    $eisvogelFound = $false
    foreach ($path in $templatePaths) {
        if (Test-Path $path) {
            $eisvogelFound = $true
            if ($Verbose) { Write-Host "[OK] Eisvogel 模板已安装: $path" -ForegroundColor Green }
            break
        }
    }
    if (-not $eisvogelFound) {
        Write-Host "[错误] Eisvogel 模板未安装" -ForegroundColor Red
        Write-Host "  安装步骤:" -ForegroundColor Yellow
        Write-Host "  1. 创建目录: mkdir `"$env:APPDATA\pandoc\templates`"" -ForegroundColor Yellow
        Write-Host "  2. 下载模板: Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex' -OutFile `"$env:APPDATA\pandoc\templates\eisvogel.latex`"" -ForegroundColor Yellow
        $allOk = $false
    }
    
    # 检查中文字体
    $fontCheckCmd = "fc-list :lang=zh"
    try {
        $fonts = & cmd /c $fontCheckCmd 2>$null
        if ($fonts) {
            if ($Verbose) { Write-Host "[OK] 中文字体已安装" -ForegroundColor Green }
        } else {
            Write-Host "[警告] 未检测到中文字体，PDF 中文可能显示异常" -ForegroundColor Yellow
            Write-Host "  推荐安装 Noto Sans CJK 字体" -ForegroundColor Yellow
        }
    } catch {
        if ($Verbose) { Write-Host "[警告] 无法检测中文字体" -ForegroundColor Yellow }
    }
    
    return $allOk
}

# ==========================================
# 构建
# ==========================================
function Invoke-Build {
    param(
        [string]$ClientConfig,
        [string]$DocType = "",
        [string]$CustomClientName = "",
        [string]$OutputFormat = "word",
        [hashtable]$VariableValues = @{}
    )
    
    # 检查 Pandoc
    $pandocPath = Get-Command pandoc -ErrorAction SilentlyContinue
    if (-not $pandocPath) {
        Write-Host "[错误] 未找到 Pandoc，请先安装。" -ForegroundColor Red
        Write-Host "下载地址: https://pandoc.org/installing.html"
        exit 1
    }
    
    # PDF 格式需要额外检查依赖
    if ($OutputFormat -eq "pdf") {
        Write-Host "检查 PDF 生成依赖..." -ForegroundColor Cyan
        $depsOk = Test-PdfDependencies
        if (-not $depsOk) {
            Write-Host "[错误] PDF 依赖检查失败，请先安装所需依赖" -ForegroundColor Red
            Write-Host "运行 '.\build.ps1 -CheckPdfDeps' 查看详细信息" -ForegroundColor Yellow
            exit 1
        }
        Write-Host "PDF 依赖检查通过" -ForegroundColor Green
        Write-Host ""
    }
    
    # 创建目录
    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir | Out-Null
    }
    
    $clientDir = Join-Path $ClientsDir $ClientConfig
    $clientMeta = Join-Path $clientDir "metadata.yaml"
    
    # 确定配置文件（必须指定文档类型）
    if ($DocType -ne "") {
        $configFile = Join-Path $clientDir "$DocType.yaml"
    } else {
        # 没有指定文档类型时，尝试查找第一个可用的配置文件
        $firstConfig = Get-ChildItem -Path $clientDir -Filter "*.yaml" -File 2>$null | 
            Where-Object { $_.Name -ne "metadata.yaml" } | 
            Select-Object -First 1
        if ($firstConfig) {
            $configFile = $firstConfig.FullName
            $DocType = $firstConfig.BaseName
            Write-Host "[提示] 未指定文档类型，使用: $DocType" -ForegroundColor Yellow
        } else {
            Write-Host "[错误] 未指定文档类型，且客户目录中没有可用的配置文件" -ForegroundColor Red
            Write-Host "用法: .\build.ps1 -Client $ClientConfig -Doc <文档类型>"
            Show-Docs -ClientName $ClientConfig
            exit 1
        }
    }
    
    # 检查客户配置
    if (-not (Test-Path $clientDir)) {
        Write-Host "[错误] 客户配置不存在: $ClientConfig" -ForegroundColor Red
        Write-Host ""
        Show-Clients
        exit 1
    }
    
    if (-not (Test-Path $configFile)) {
        Write-Host "[错误] 配置文件不存在: $configFile" -ForegroundColor Red
        Write-Host "可用的文档类型:"
        Show-Docs -ClientName $ClientConfig
        exit 1
    }
    
    $formatLabel = if ($OutputFormat -eq "pdf") { "[PDF]" } else { "[Word]" }
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "构建文档 - 客户: $ClientConfig [$DocType] $formatLabel" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    
    # 读取配置
    $clientNameValue = Read-YamlValue -FilePath $configFile -Key "client_name"
    $template = Read-YamlValue -FilePath $configFile -Key "template"
    $outputPattern = Read-YamlValue -FilePath $configFile -Key "output_pattern"
    $modules = Read-YamlList -FilePath $configFile -Key "modules"
    $pandocArgs = Read-YamlList -FilePath $configFile -Key "pandoc_args"
    
    # 展开通配符模式（如 src/*.md）
    $expandedModules = @()
    foreach ($module in $modules) {
        if ($module -match '\*') {
            # 包含通配符，展开它（通配符展开时按文件名排序）
            $expanded = Get-ChildItem -Path $module -File -ErrorAction SilentlyContinue | Sort-Object Name
            foreach ($file in $expanded) {
                $expandedModules += $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
            }
        } else {
            $expandedModules += $module
        }
    }
    # 保持配置文件中指定的模块顺序，不进行排序
    $modules = $expandedModules
    
    # 读取 PDF 选项（从配置文件和 metadata 合并）
    $pdfOptions = Read-PdfOptions -FilePath $configFile
    if (Test-Path $clientMeta) {
        $metaPdfOptions = Read-PdfOptions -FilePath $clientMeta
        foreach ($key in $metaPdfOptions.Keys) {
            if ($metaPdfOptions[$key] -ne $pdfOptions[$key]) {
                $pdfOptions[$key] = $metaPdfOptions[$key]
            }
        }
    }
    
    # 如果传入了自定义客户名称，使用它覆盖配置
    if ($CustomClientName -ne "") {
        $clientNameValue = $CustomClientName
        Write-Host "使用自定义客户名称: $CustomClientName" -ForegroundColor Yellow
    }
    
    # 默认值
    if (-not $clientNameValue) { $clientNameValue = $ClientConfig }
    if (-not $template) { $template = "default.docx" }
    if (-not $outputPattern) { $outputPattern = "{title}_{date}.docx" }
    if ($modules.Count -eq 0) {
        $modules = @("$SrcDir/metadata.yaml", "$SrcDir/01-executive-summary.md")
    }
    
    Write-Host "客户名称: $clientNameValue"
    Write-Host "输出格式: $OutputFormat"
    if ($OutputFormat -eq "word") {
        Write-Host "模板: $template"
    }
    Write-Host "模块: $($modules -join ', ')"
    
    # 检查模板（仅 Word 格式需要）
    $templatePath = $null
    if ($OutputFormat -eq "word") {
        $templatePath = Join-Path $TemplatesDir $template
        if (-not (Test-Path $templatePath)) {
            Write-Host "[警告] 模板不存在: $templatePath" -ForegroundColor Yellow
            Write-Host "运行 '.\build.ps1 -InitTemplate' 生成默认模板"
            $templatePath = $null
        }
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
    
    # 处理变量模板
    $processedModules = $validModules
    if ($VariableValues.Count -gt 0) {
        Write-Host "处理变量模板..." -ForegroundColor Cyan
        $processedModules = Process-ModulesWithVariables -ModulePaths $validModules -CliValues $VariableValues
    } else {
        # 检查是否有变量需要处理（即使没有传入值，也需要处理默认值）
        $hasVariables = $false
        foreach ($path in $validModules) {
            $vars = Get-VariablesFromFile -FilePath $path
            if ($vars.Count -gt 0) {
                $hasVariables = $true
                break
            }
        }
        if ($hasVariables) {
            Write-Host "处理变量模板..." -ForegroundColor Cyan
            $processedModules = Process-ModulesWithVariables -ModulePaths $validModules -CliValues @{}
        }
    }
    
    # 读取元数据（优先级：文档配置 > 客户 metadata.yaml > src/metadata.yaml）
    # 1. 基础元数据
    $title = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "title"
    $version = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "version"
    $subtitle = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "subtitle"
    $author = Read-YamlValue -FilePath "$SrcDir\metadata.yaml" -Key "author"
    $date = Get-Date -Format "yyyy-MM-dd"
    
    # 2. 客户元数据覆盖
    if (Test-Path $clientMeta) {
        $clientTitle = Read-YamlValue -FilePath $clientMeta -Key "title"
        $clientVersion = Read-YamlValue -FilePath $clientMeta -Key "version"
        $clientSubtitle = Read-YamlValue -FilePath $clientMeta -Key "subtitle"
        $clientAuthor = Read-YamlValue -FilePath $clientMeta -Key "author"
        $clientDate = Read-YamlValue -FilePath $clientMeta -Key "date"
        if ($clientTitle) { $title = $clientTitle }
        if ($clientVersion) { $version = $clientVersion }
        if ($clientSubtitle) { $subtitle = $clientSubtitle }
        if ($clientAuthor) { $author = $clientAuthor }
        if ($clientDate) { $date = $clientDate }
    }
    
    # 3. 文档配置覆盖（最高优先级）
    $docTitle = Read-YamlValue -FilePath $configFile -Key "title"
    $docVersion = Read-YamlValue -FilePath $configFile -Key "version"
    $docSubtitle = Read-YamlValue -FilePath $configFile -Key "subtitle"
    $docAuthor = Read-YamlValue -FilePath $configFile -Key "author"
    $docDate = Read-YamlValue -FilePath $configFile -Key "date"
    if ($docTitle) { $title = $docTitle }
    if ($docVersion) { $version = $docVersion }
    if ($docSubtitle) { $subtitle = $docSubtitle }
    if ($docAuthor) { $author = $docAuthor }
    if ($docDate) { $date = $docDate }
    
    if (-not $title) { $title = "Document" }
    if (-not $version) { $version = "v1.0" }
    
    # 生成输出文件名
    $clientNameClean = $clientNameValue -replace "\s+", "_"
    $titleClean = $title -replace "\s+", "_"
    
    # 根据格式调整输出文件扩展名
    $outputPatternAdjusted = $outputPattern
    if ($OutputFormat -eq "pdf") {
        $outputPatternAdjusted = $outputPattern -replace "\.docx$", ".pdf"
        if ($outputPatternAdjusted -notmatch "\.pdf$") {
            $outputPatternAdjusted = $outputPatternAdjusted -replace "\.[^.]+$", ".pdf"
        }
    }
    
    $outputFileName = $outputPatternAdjusted `
        -replace "\{client\}", $clientNameClean `
        -replace "\{title\}", $titleClean `
        -replace "\{version\}", $version `
        -replace "\{date\}", $date
    
    $outputPath = Join-Path $BuildDir $outputFileName
    
    Write-Host "输出: $outputPath"
    Write-Host ""
    
    # 构建 Pandoc 参数
    $pandocCmdArgs = @()
    $pandocCmdArgs += $processedModules
    
    if (Test-Path $clientMeta) {
        $pandocCmdArgs += $clientMeta
    }
    
    $pandocCmdArgs += "-o"
    $pandocCmdArgs += $outputPath
    
    if ($OutputFormat -eq "word") {
        # Word 格式参数
        if ($templatePath) {
            $pandocCmdArgs += "--reference-doc=$templatePath"
        }
    } else {
        # PDF 格式参数
        $pandocCmdArgs += "--pdf-engine=xelatex"
        $pandocCmdArgs += "--template=eisvogel"
        # 表格兼容性设置 - 使用简单表格格式避免 longtable 兼容性问题
        $pandocCmdArgs += "--from=markdown-implicit_figures"
        $pandocCmdArgs += "-V", "table-use-row-colors=true"
        
        # 应用 PDF 选项
        if ($pdfOptions.titlepage) {
            $pandocCmdArgs += "-V", "titlepage=true"
        }
        if ($pdfOptions.titlepage_color) {
            $pandocCmdArgs += "-V", "titlepage-color=$($pdfOptions.titlepage_color)"
        }
        if ($pdfOptions.titlepage_text_color) {
            $pandocCmdArgs += "-V", "titlepage-text-color=$($pdfOptions.titlepage_text_color)"
        }
        if ($pdfOptions.titlepage_rule_color) {
            $pandocCmdArgs += "-V", "titlepage-rule-color=$($pdfOptions.titlepage_rule_color)"
        }
        if ($pdfOptions.logo -and (Test-Path (Join-Path $SrcDir $pdfOptions.logo))) {
            $pandocCmdArgs += "-V", "logo=$($pdfOptions.logo)"
            $pandocCmdArgs += "-V", "logo-width=$($pdfOptions.logo_width)"
        }
        if ($pdfOptions.listings) {
            $pandocCmdArgs += "-V", "listings=true"
        }
        if ($pdfOptions.listings_no_page_break) {
            $pandocCmdArgs += "-V", "listings-no-page-break=true"
        }
        if ($pdfOptions.code_block_font_size) {
            $pandocCmdArgs += "-V", "code-block-font-size=$($pdfOptions.code_block_font_size)"
        }
        if ($pdfOptions.header_left) {
            $pandocCmdArgs += "-V", "header-left=$($pdfOptions.header_left)"
        }
        if ($pdfOptions.header_right) {
            $pandocCmdArgs += "-V", "header-right=$($pdfOptions.header_right)"
        }
        if ($pdfOptions.CJKmainfont) {
            $pandocCmdArgs += "-V", "CJKmainfont=$($pdfOptions.CJKmainfont)"
        }
        if ($pdfOptions.mainfont) {
            $pandocCmdArgs += "-V", "mainfont=$($pdfOptions.mainfont)"
        }
        if ($pdfOptions.monofont) {
            $pandocCmdArgs += "-V", "monofont=$($pdfOptions.monofont)"
        }
        if ($pdfOptions.toc) {
            $pandocCmdArgs += "--toc"
            $pandocCmdArgs += "--toc-depth=$($pdfOptions.toc_depth)"
        }
        if ($pdfOptions.number_sections) {
            $pandocCmdArgs += "--number-sections"
        }
        if ($pdfOptions.colorlinks) {
            $pandocCmdArgs += "-V", "colorlinks=true"
            $pandocCmdArgs += "-V", "linkcolor=$($pdfOptions.linkcolor)"
        }
    }
    
    # 构建 resource-path：包含 src 目录及其所有子目录
    $resourcePaths = @($SrcDir)
    # 添加所有包含 images 目录的子目录
    Get-ChildItem -Path $SrcDir -Recurse -Directory -Filter "images" -ErrorAction SilentlyContinue | ForEach-Object {
        $parentDir = $_.Parent.FullName
        if ($resourcePaths -notcontains $parentDir) {
            $resourcePaths += $parentDir
        }
    }
    # 添加模块所在的目录（处理相对路径引用）
    foreach ($module in $processedModules) {
        $moduleDir = Split-Path -Parent $module
        if ($moduleDir -and $moduleDir -ne "." -and $resourcePaths -notcontains $moduleDir) {
            $resourcePaths += $moduleDir
        }
    }
    $resourcePathStr = $resourcePaths -join [IO.Path]::PathSeparator
    $pandocCmdArgs += "--resource-path=$resourcePathStr"
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
if ($CheckPdfDeps) { 
    Write-Host "检查 PDF 生成依赖..." -ForegroundColor Cyan
    Write-Host ""
    Test-PdfDependencies -Verbose
    exit 0
}
if ($InstallFonts) { 
    $fontScript = "bin\install-fonts.ps1"
    if (Test-Path $fontScript) {
        & $fontScript
    } else {
        Write-Host "[错误] 字体安装脚本不存在: $fontScript" -ForegroundColor Red
    }
    exit 0 
}

# 解析变量参数
$VariableValues = Parse-VariableArgs -VarArgs $Var

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
                Invoke-Build -ClientConfig $Client -DocType "" -CustomClientName $ClientName -OutputFormat $Format -VariableValues $VariableValues
            } else {
                Invoke-Build -ClientConfig $Client -DocType $docName -CustomClientName $ClientName -OutputFormat $Format -VariableValues $VariableValues
            }
            Write-Host ""
        }
    }
    exit 0
}

# 单个文档构建
Invoke-Build -ClientConfig $Client -DocType $Doc -CustomClientName $ClientName -OutputFormat $Format -VariableValues $VariableValues

# 恢复原目录
Pop-Location
