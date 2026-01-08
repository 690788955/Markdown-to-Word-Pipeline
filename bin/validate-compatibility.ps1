# ==========================================
# Docker Compose 向后兼容性验证脚本
# ==========================================
#
# 用途: 验证增强的 docker-compose.yml 配置与原始版本的兼容性
# 使用: .\validate-compatibility.ps1

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Docker Compose 向后兼容性验证" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# 检查 Docker 和 Docker Compose 是否可用
Write-Host "`n1. 检查 Docker 环境..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker 未安装或不可用" -ForegroundColor Red
    exit 1
}

try {
    $composeVersion = docker compose version
    Write-Host "✓ Docker Compose: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose 未安装或不可用" -ForegroundColor Red
    exit 1
}

# 验证默认配置（无环境变量）
Write-Host "`n2. 验证默认配置（向后兼容性）..." -ForegroundColor Yellow

# 清除所有相关环境变量
$env:PORT = $null
$env:DOCS_DIR = $null
$env:SRC_DIR = $null
$env:CLIENTS_DIR = $null
$env:TEMPLATES_DIR = $null
$env:OUTPUT_DIR = $null

try {
    $config = docker compose config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 默认配置验证通过" -ForegroundColor Green
        
        # 检查默认端口
        if ($config -match '"8080:8080"') {
            Write-Host "✓ 默认端口 8080 配置正确" -ForegroundColor Green
        } else {
            Write-Host "✗ 默认端口配置异常" -ForegroundColor Red
        }
        
        # 检查默认卷挂载
        if ($config -match './src:/app/src' -and $config -match './clients:/app/clients' -and $config -match './templates:/app/templates' -and $config -match './build:/app/build') {
            Write-Host "✓ 默认卷挂载配置正确" -ForegroundColor Green
        } else {
            Write-Host "✗ 默认卷挂载配置异常" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ 默认配置验证失败: $config" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 配置验证异常: $_" -ForegroundColor Red
}

# 验证 IMAGE 环境变量兼容性
Write-Host "`n3. 验证 IMAGE 环境变量兼容性..." -ForegroundColor Yellow
$env:IMAGE = "custom-image:test"
try {
    $config = docker compose config 2>&1
    if ($config -match 'custom-image:test') {
        Write-Host "✓ IMAGE 环境变量兼容性验证通过" -ForegroundColor Green
    } else {
        Write-Host "✗ IMAGE 环境变量不工作" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ IMAGE 环境变量验证异常: $_" -ForegroundColor Red
}
$env:IMAGE = $null

# 验证端口配置
Write-Host "`n4. 验证端口配置..." -ForegroundColor Yellow
$testPorts = @(8080, 9000, 3000, 8888)
foreach ($port in $testPorts) {
    $env:PORT = $port
    try {
        $config = docker compose config 2>&1
        if ($config -match "`"$port`:$port`"") {
            Write-Host "✓ 端口 $port 配置正确" -ForegroundColor Green
        } else {
            Write-Host "✗ 端口 $port 配置异常" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ 端口 $port 验证异常: $_" -ForegroundColor Red
    }
}
$env:PORT = $null

# 验证目录配置
Write-Host "`n5. 验证目录配置..." -ForegroundColor Yellow

# 测试 DOCS_DIR
$env:DOCS_DIR = "/test/docs"
try {
    $config = docker compose config 2>&1
    if ($config -match '/test/docs/src:/app/src' -and $config -match '/test/docs/clients:/app/clients') {
        Write-Host "✓ DOCS_DIR 配置正确" -ForegroundColor Green
    } else {
        Write-Host "✗ DOCS_DIR 配置异常" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ DOCS_DIR 验证异常: $_" -ForegroundColor Red
}
$env:DOCS_DIR = $null

# 测试个别目录变量
$env:SRC_DIR = "/custom/src"
$env:CLIENTS_DIR = "/custom/clients"
try {
    $config = docker compose config 2>&1
    if ($config -match '/custom/src:/app/src' -and $config -match '/custom/clients:/app/clients') {
        Write-Host "✓ 个别目录变量配置正确" -ForegroundColor Green
    } else {
        Write-Host "✗ 个别目录变量配置异常" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 个别目录变量验证异常: $_" -ForegroundColor Red
}
$env:SRC_DIR = $null
$env:CLIENTS_DIR = $null

# 验证目录优先级
Write-Host "`n6. 验证目录优先级..." -ForegroundColor Yellow
$env:DOCS_DIR = "/base/docs"
$env:SRC_DIR = "/override/src"
try {
    $config = docker compose config 2>&1
    if ($config -match '/override/src:/app/src' -and $config -match '/base/docs/clients:/app/clients') {
        Write-Host "✓ 目录优先级配置正确（个别变量优先于 DOCS_DIR）" -ForegroundColor Green
    } else {
        Write-Host "✗ 目录优先级配置异常" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 目录优先级验证异常: $_" -ForegroundColor Red
}
$env:DOCS_DIR = $null
$env:SRC_DIR = $null

# 验证健康检查端口
Write-Host "`n7. 验证健康检查端口..." -ForegroundColor Yellow
$env:PORT = 9001
try {
    $config = docker compose config 2>&1
    if ($config -match 'http://localhost:9001/') {
        Write-Host "✓ 健康检查端口配置正确" -ForegroundColor Green
    } else {
        Write-Host "✗ 健康检查端口配置异常" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 健康检查端口验证异常: $_" -ForegroundColor Red
}
$env:PORT = $null

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "向后兼容性验证完成" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

Write-Host "`n测试建议:" -ForegroundColor Yellow
Write-Host "1. 运行 'docker compose config' 验证当前配置" -ForegroundColor White
Write-Host "2. 使用 'docker compose up -d' 测试服务启动" -ForegroundColor White
Write-Host "3. 检查 'docker compose ps' 确认服务状态" -ForegroundColor White
Write-Host "4. 访问 http://localhost:8080 验证服务可用性" -ForegroundColor White