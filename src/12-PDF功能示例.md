# PDF 功能示例

本章节展示 PDF 输出的各种功能特性，包括代码高亮、提示框、表格、图片等。

## 代码高亮示例

### Bash 脚本

```bash
#!/bin/bash
# 系统健康检查脚本
check_disk_usage() {
    local threshold=80
    df -h | awk -v t="$threshold" 'NR>1 && int($5)>t {print $6": "$5}'
}

check_memory() {
    free -m | awk 'NR==2 {printf "内存使用: %.1f%%\n", $3*100/$2}'
}

main() {
    echo "=== 系统健康检查 ==="
    check_disk_usage
    check_memory
}

main "$@"
```

### Python 脚本

```python
#!/usr/bin/env python3
"""运维监控数据采集模块"""

import psutil
from datetime import datetime
from typing import Dict, Any

class SystemMonitor:
    """系统监控类"""
    
    def __init__(self, interval: int = 60):
        self.interval = interval
        self.metrics: Dict[str, Any] = {}
    
    def collect_cpu(self) -> float:
        """采集 CPU 使用率"""
        return psutil.cpu_percent(interval=1)
    
    def collect_memory(self) -> Dict[str, float]:
        """采集内存使用情况"""
        mem = psutil.virtual_memory()
        return {
            "total_gb": mem.total / (1024**3),
            "used_gb": mem.used / (1024**3),
            "percent": mem.percent
        }
    
    def report(self) -> None:
        """生成监控报告"""
        print(f"[{datetime.now()}] CPU: {self.collect_cpu()}%")
        print(f"Memory: {self.collect_memory()}")

if __name__ == "__main__":
    monitor = SystemMonitor()
    monitor.report()
```

### YAML 配置

```yaml
# 监控告警配置
monitoring:
  prometheus:
    scrape_interval: 15s
    evaluation_interval: 15s
  
  alerting:
    alertmanagers:
      - static_configs:
          - targets: ['alertmanager:9093']
  
  rules:
    - name: 系统告警
      rules:
        - alert: HighCPUUsage
          expr: cpu_usage > 80
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "CPU 使用率过高"
```

### JSON 数据

```json
{
  "service": "api-gateway",
  "version": "2.1.0",
  "endpoints": [
    {
      "path": "/api/v1/users",
      "method": "GET",
      "rateLimit": 1000
    },
    {
      "path": "/api/v1/orders",
      "method": "POST",
      "rateLimit": 500
    }
  ],
  "healthCheck": {
    "enabled": true,
    "interval": "30s"
  }
}
```

### Go 代码

```go
package main

import (
    "fmt"
    "net/http"
    "time"
)

// HealthChecker 健康检查器
type HealthChecker struct {
    Endpoint string
    Timeout  time.Duration
}

// Check 执行健康检查
func (h *HealthChecker) Check() error {
    client := &http.Client{Timeout: h.Timeout}
    resp, err := client.Get(h.Endpoint)
    if err != nil {
        return fmt.Errorf("健康检查失败: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("状态码异常: %d", resp.StatusCode)
    }
    return nil
}

func main() {
    checker := &HealthChecker{
        Endpoint: "http://localhost:8080/health",
        Timeout:  5 * time.Second,
    }
    if err := checker.Check(); err != nil {
        fmt.Printf("❌ %v\n", err)
    } else {
        fmt.Println("✅ 服务健康")
    }
}
```

## 提示框示例

Eisvogel 模板支持多种提示框样式，用于突出显示重要信息。

::: warning
**警告**: 在执行数据库迁移前，请务必完成数据备份。未经备份的迁移操作可能导致数据丢失。
:::

::: note
**注意**: 本文档中的命令示例基于 Ubuntu 22.04 LTS 环境，其他发行版可能需要调整。
:::

::: tip
**提示**: 使用 `screen` 或 `tmux` 运行长时间任务，可以防止 SSH 断开导致任务中断。
:::

::: info
**信息**: 系统默认每天凌晨 2:00 执行自动备份，备份文件保留 7 天。
:::

::: important
**重要**: 生产环境变更必须经过审批流程，禁止直接在生产服务器上进行未经测试的操作。
:::

## 中英文混排示例

本系统采用 **Microservices Architecture**（微服务架构），各服务通过 **RESTful API** 进行通信。核心组件包括：

- **API Gateway**: 统一入口，负责路由、限流、认证
- **Service Registry**: 服务注册与发现（基于 Consul）
- **Message Queue**: 异步消息处理（RabbitMQ / Kafka）
- **Cache Layer**: 缓存层（Redis Cluster）

系统遵循 **12-Factor App** 原则设计，支持 **Horizontal Scaling**（水平扩展）和 **Blue-Green Deployment**（蓝绿部署）。

## 表格示例

### 服务器清单

| 主机名 | IP 地址 | 角色 | CPU | 内存 | 存储 |
|--------|---------|------|-----|------|------|
| app-01 | 10.0.1.11 | 应用服务器 | 8核 | 16GB | 200GB SSD |
| app-02 | 10.0.1.12 | 应用服务器 | 8核 | 16GB | 200GB SSD |
| db-master | 10.0.2.21 | 数据库主节点 | 16核 | 64GB | 1TB NVMe |
| db-slave | 10.0.2.22 | 数据库从节点 | 16核 | 64GB | 1TB NVMe |
| redis-01 | 10.0.3.31 | 缓存节点 | 4核 | 32GB | 100GB SSD |

### 告警阈值配置

| 指标 | 警告阈值 | 严重阈值 | 检查间隔 |
|------|----------|----------|----------|
| CPU 使用率 | > 70% | > 90% | 1 分钟 |
| 内存使用率 | > 75% | > 90% | 1 分钟 |
| 磁盘使用率 | > 80% | > 95% | 5 分钟 |
| 响应时间 | > 500ms | > 2000ms | 30 秒 |
| 错误率 | > 1% | > 5% | 1 分钟 |

## 列表示例

### 日常巡检项目

1. **系统资源检查**
   - CPU 使用率是否正常
   - 内存使用率是否正常
   - 磁盘空间是否充足
   - 网络连接是否正常

2. **服务状态检查**
   - 核心服务是否运行
   - 依赖服务是否可用
   - 定时任务是否正常执行

3. **日志检查**
   - 是否有异常错误日志
   - 是否有安全告警
   - 日志轮转是否正常

### 故障处理流程

- [ ] 确认故障现象和影响范围
- [ ] 通知相关人员
- [ ] 收集故障信息（日志、监控数据）
- [ ] 分析故障原因
- [ ] 制定修复方案
- [ ] 执行修复操作
- [ ] 验证修复结果
- [ ] 编写故障报告

## 引用示例

> 运维工作的核心目标是保障系统的稳定性、可用性和安全性。
> 
> —— 《SRE: Google 运维解密》

## 数学公式示例（如果启用 LaTeX）

系统可用性计算公式：

$$
\text{可用性} = \frac{\text{正常运行时间}}{\text{总时间}} \times 100\%
$$

MTBF（平均故障间隔时间）和 MTTR（平均修复时间）的关系：

$$
\text{可用性} = \frac{MTBF}{MTBF + MTTR}
$$
