# ==========================================
# Docker Compose 部署验证脚本
# ==========================================
#
# 用途: 验证 docker-compose 配置和环境变量设置
# 使用: .\validate-deployment.ps1

param(
    [switch]$CheckOnly,  # 仅检查配置，不启动服务
    [switch]$Verbose     # 详细输出
)

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Docker Compose 部署验证" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$ErrorCount = 0

# 函数：记录错误
function Log-Error($message) {
    Write-Host "✗ $message" -ForegroundColor Red
    $script:ErrorCount++
}

# 函数：记录成功
function Log-Success($message) {
    Write-Host "✓ $message" -ForegroundColor Green
}

# 函数：记录警告
function Log-Warning($message) {
    Write-Host "⚠ $message" -ForegroundColor Yellow
}

# 函数：记录信息
function Log-Info($message) {
    if ($Verbose) {
        Write-Host "ℹ $message" -ForegroundColor Blue
    }
}

# 1. 检查 Docker 环境
Write-Host "`n1. 检查 Docker 环境..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Docker 可用: $dockerVersion"
    } else {
        Log-Error "Docker 未安装或不可用"
    }
} catch {
    Log-Error "Docker 检查失败: $_"
}

try {
    $composeVersion = docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Docker Compose 可用: $composeVersion"
    } else {
        Log-Error "Docker Compose 未安装或不可用"
    }
} catch {
    Log-Error "Docker Compose 检查失败: $_"
}

# 2. 验证环境变量
Write-Host "`n2. 验证环境变量..." -ForegroundColor Yellow

# 检查端口
if ($env:PORT) {
    $port = [int]$env:PORT
    if ($port -ge 1024 -and $port -le 65535) {
        Log-Success "端口 $port 在有效范围内 (1024-65535)"
        
        # 检查端口是否被占用
        try {
            $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
            $portInUse = $listener | Where-Object { $_.Port -eq $port }
            if ($portInUse) {
                Log-Warning "端口 $port 可能已被占用"
            } else {
                Log-Success "端口 $port 可用"
            }
        } catch {
            Log-Warning "无法检查端口 $port 可用性: $_"
        }
    } else {
        Log-Error "端口 $port 超出有效范围 (1024-65535)"
    }
} else {
    Log-Info "使用默认端口 8080"
}

# 检查目录变量
$directories = @{
    "DOCS_DIR" = $env:DOCS_DIR
    "SRC_DIR" = $env:SRC_DIR
    "CLIENTS_DIR" = $env:CLIENTS_DIR
    "TEMPLATES_DIR" = $env:TEMPLATES_DIR
    "OUTPUT_DIR" = $env:OUTPUT_DIR
}

foreach ($dirVar in $directories.GetEnumerator()) {
    if ($dirVar.Value) {
        $dirPath = $dirVar.Value
        Log-Info "检查 $($dirVar.Key): $dirPath"
        
        if (Test-Path $dirPath) {
            Log-Success "$($dirVar.Key) 目录存在: $dirPath"
            
            # 检查读写权限
            try {
                $testFile = Join-Path $dirPath "test-write-$(Get-Random).tmp"
                "test" | Out-File $testFile -ErrorAction Stop
                Remove-Item $testFile -ErrorAction Stop
                Log-Success "$($dirVar.Key) 目录可写"
            } catch {
                Log-Warning "$($dirVar.Key) 目录可能没有写权限: $_"
            }
        } else {
            if ($dirVar.Key -eq "OUTPUT_DIR") {
                Log-Warning "$($dirVar.Key) 目录不存在，将自动创建: $dirPath"
            } else {
                Log-Error "$($dirVar.Key) 目录不存在: $dirPath"
            }
        }
    }
}

# 3. 验证 docker-compose.yml 配置
Write-Host "`n3. 验证 docker-compose.yml 配置..." -ForegroundColor Yellow

if (Test-Path "docker-compose.yml") {
    Log-Success "docker-compose.yml 文件存在"
    
    try {
        $config = docker compose config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Log-Success "docker-compose.yml 语法正确"
            
            if ($Verbose) {
                Write-Host "`n生成的配置:" -ForegroundColor Blue
                Write-Host $config -ForegroundColor Gray
            }
        } else {
            Log-Error "docker-compose.yml 配置错误: $config"
        }
    } catch {
        Log-Error "配置验证失败: $_"
    }
} else {
    Log-Error "docker-compose.yml 文件不存在"
}

# 4. 检查必需的目录结构
Write-Host "`n4. 检查项目目录结构..." -ForegroundColor Yellow

$requiredDirs = @("src", "clients", "templates")
$defaultDirs = @()

# 如果没有设置 DOCS_DIR，检查默认目录
if (-not $env:DOCS_DIR) {
    $defaultDirs = $requiredDirs
} else {
    # 如果设置了 DOCS_DIR，检查其子目录
    $baseDir = $env:DOCS_DIR
    foreach ($dir in $requiredDirs) {
        $fullPath = Join-Path $baseDir $dir
        if (Test-Path $fullPath) {
            Log-Success "找到 $dir 目录: $fullPath"
        } else {
            Log-Warning "$dir 目录不存在: $fullPath"
        }
    }
}

# 检查默认目录（当没有设置 DOCS_DIR 时）
foreach ($dir in $defaultDirs) {
    if (Test-Path $dir) {
        Log-Success "找到默认 $dir 目录"
    } else {
        Log-Warning "默认 $dir 目录不存在，可能需要创建"
    }
}

# 检查输出目录
$outputDir = if ($env:OUTPUT_DIR) { $env:OUTPUT_DIR } else { "./build" }
if (Test-Path $outputDir) {
    Log-Success "输出目录存在: $outputDir"
} else {
    Log-Info "输出目录将自动创建: $outputDir"
}

# 5. 检查 Dockerfile
Write-Host "`n5. 检查 Dockerfile..." -ForegroundColor Yellow
if (Test-Path "web/Dockerfile") {
    Log-Success "Dockerfile 存在: web/Dockerfile"
} else {
    Log-Warning "Dockerfile 不存在: web/Dockerfile（如果使用自定义镜像则无需关心）"
}

# 6. 网络连通性检查（如果不是仅检查模式）
if (-not $CheckOnly) {
    Write-Host "`n6. 网络连通性检查..." -ForegroundColor Yellow
    
    $testPort = if ($env:PORT) { $env:PORT } else { 8080 }
    
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $testPort)
        $listener.Start()
        $listener.Stop()
        Log-Success "端口 $testPort 可以绑定"
    } catch {
        Log-Error "端口 $testPort 无法绑定: $_"
    }
}

# 7. 总结
Write-Host "`n===========================================" -ForegroundColor Cyan
if ($ErrorCount -eq 0) {
    Write-Host "✓ 所有检查通过，可以部署" -ForegroundColor Green
    $exitCode = 0
} else {
    Write-Host "✗ 发现 $ErrorCount 个错误，请修复后重试" -ForegroundColor Red
    $exitCode = 1
}
Write-Host "===========================================" -ForegroundColor Cyan

# 8. 部署建议
Write-Host "`n部署建议:" -ForegroundColor Yellow
Write-Host "1. 运行验证: .\validate-deployment.ps1 -Verbose" -ForegroundColor White
Write-Host "2. 检查配置: docker compose config" -ForegroundColor White
Write-Host "3. 启动服务: docker compose up -d" -ForegroundColor White
Write-Host "4. 检查状态: docker compose ps" -ForegroundColor White
Write-Host "5. 查看日志: docker compose logs -f" -ForegroundColor White

$accessUrl = "http://localhost:$(if ($env:PORT) { $env:PORT } else { '8080' })"
Write-Host "6. 访问服务: $accessUrl" -ForegroundColor White

exit $exitCode