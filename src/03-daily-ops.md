# 日常运维

## 巡检清单

### 每日巡检

| 检查项 | 命令/方法 | 正常标准 |
|-------|----------|---------|
| 服务器负载 | `uptime` | load < CPU核数 |
| 磁盘使用率 | `df -h` | < 80% |
| 内存使用率 | `free -m` | < 85% |
| 服务状态 | `systemctl status` | active |
| 日志错误 | `grep ERROR /var/log/` | 无新增异常 |

### 每周巡检

- [ ] 检查备份完整性
- [ ] 审查安全日志
- [ ] 检查证书有效期
- [ ] 清理临时文件
- [ ] 检查磁盘SMART状态

## 常用命令

### 服务管理

```bash
# 查看服务状态
systemctl status nginx

# 重启服务
systemctl restart nginx

# 查看服务日志
journalctl -u nginx -f
```

### 日志查看

```bash
# 实时查看日志
tail -f /var/log/nginx/access.log

# 查看错误日志
grep -i error /var/log/nginx/error.log | tail -100

# 统计访问量
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20
```

### 性能排查

```bash
# 查看CPU占用最高的进程
top -bn1 | head -20

# 查看内存占用
ps aux --sort=-%mem | head -10

# 查看网络连接
ss -tunlp

# 查看IO情况
iostat -x 1 5
```

## 变更管理

### 变更流程

1. 提交变更申请
2. 技术评审
3. 测试环境验证
4. 制定回滚方案
5. 选择变更窗口
6. 执行变更
7. 验证结果
8. 更新文档

### 变更窗口

| 变更级别 | 窗口时间 | 审批要求 |
|---------|---------|---------|
| 紧急变更 | 随时 | 口头审批 + 事后补单 |
| 一般变更 | 工作日 22:00-06:00 | 主管审批 |
| 重大变更 | 周末 02:00-06:00 | 总监审批 |
