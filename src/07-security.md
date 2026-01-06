# 安全规范

## 访问控制

### SSH 安全

```bash
# /etc/ssh/sshd_config 推荐配置
Port 22222                    # 修改默认端口
PermitRootLogin no            # 禁止root登录
PasswordAuthentication no     # 禁用密码登录
PubkeyAuthentication yes      # 启用密钥登录
MaxAuthTries 3                # 最大尝试次数
```

### 防火墙规则

```bash
# 只开放必要端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=22222/tcp
firewall-cmd --reload
```

### 权限管理

| 角色 | 权限范围 |
|------|---------|
| 运维管理员 | 所有服务器 sudo |
| 开发人员 | 测试环境 + 日志查看 |
| DBA | 数据库服务器 |
| 安全人员 | 审计日志 |

## 安全检查

### 每日检查

- [ ] 检查登录失败日志
- [ ] 检查异常进程
- [ ] 检查异常网络连接

### 每周检查

- [ ] 检查账号权限
- [ ] 检查sudo日志
- [ ] 扫描漏洞

### 检查命令

```bash
# 查看登录失败
grep "Failed password" /var/log/secure | tail -20

# 查看当前登录用户
who
w

# 查看异常网络连接
netstat -tunlp | grep -v ESTABLISHED

# 查看最近修改的文件
find /etc -mtime -1 -type f
```

## 应急响应

### 发现入侵

1. **隔离** - 断开网络连接
2. **取证** - 保存日志和现场
3. **分析** - 确定入侵途径
4. **清除** - 删除后门和恶意程序
5. **加固** - 修复漏洞
6. **恢复** - 从干净备份恢复
7. **复盘** - 总结经验教训

### 紧急联系

| 事件类型 | 联系人 |
|---------|-------|
| 安全事件 | 安全团队 |
| 数据泄露 | 法务 + 安全 |
| DDoS攻击 | 云服务商 |
