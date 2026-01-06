# 故障处理

## 故障分级

| 级别 | 定义 | 响应时间 | 恢复时间 |
|------|------|---------|---------|
| P0 | 核心业务完全中断 | 5分钟 | 30分钟 |
| P1 | 核心业务部分受损 | 15分钟 | 2小时 |
| P2 | 非核心功能异常 | 30分钟 | 8小时 |
| P3 | 轻微问题 | 4小时 | 24小时 |

## 常见故障处理

### 服务无法访问

**排查步骤：**

1. 检查服务进程
```bash
systemctl status nginx
ps aux | grep nginx
```

2. 检查端口监听
```bash
ss -tunlp | grep 80
```

3. 检查防火墙
```bash
iptables -L -n
firewall-cmd --list-all
```

4. 检查负载均衡健康检查

5. 查看错误日志
```bash
tail -100 /var/log/nginx/error.log
```

### 数据库连接失败

**排查步骤：**

1. 检查MySQL服务状态
```bash
systemctl status mysql
```

2. 检查连接数
```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';
```

3. 检查慢查询
```sql
SHOW PROCESSLIST;
```

4. 检查磁盘空间
```bash
df -h /var/lib/mysql
```

### 服务器负载过高

**排查步骤：**

1. 查看负载来源
```bash
top -c
htop
```

2. 分析CPU占用
```bash
pidstat -u 1 5
```

3. 分析IO等待
```bash
iostat -x 1 5
iotop
```

4. 检查是否有异常进程

## 故障复盘模板

```markdown
## 故障概述
- 故障时间：
- 影响范围：
- 故障级别：

## 时间线
- HH:MM 发现问题
- HH:MM 开始处理
- HH:MM 恢复服务

## 根因分析
[描述根本原因]

## 改进措施
1. 短期措施
2. 长期措施

## 经验教训
[总结经验]
```
