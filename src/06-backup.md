# 备份恢复

## 备份策略

### 数据库备份

| 备份类型 | 频率 | 保留时间 | 存储位置 |
|---------|------|---------|---------|
| 全量备份 | 每日 02:00 | 30天 | OSS |
| 增量备份 | 每小时 | 7天 | 本地 + OSS |
| binlog | 实时 | 7天 | 本地 |

### 文件备份

| 备份内容 | 频率 | 保留时间 |
|---------|------|---------|
| 配置文件 | 每日 | 90天 |
| 应用代码 | 每次发布 | 永久(Git) |
| 用户上传 | 每日增量 | 永久 |

## 备份脚本

### MySQL全量备份

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backup/mysql
MYSQL_USER=backup
MYSQL_PASS=xxx

mysqldump -u${MYSQL_USER} -p${MYSQL_PASS} \
  --all-databases \
  --single-transaction \
  --routines \
  --triggers \
  | gzip > ${BACKUP_DIR}/full_${DATE}.sql.gz

# 上传到OSS
ossutil cp ${BACKUP_DIR}/full_${DATE}.sql.gz oss://backup-bucket/mysql/
```

### 配置文件备份

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backup/config

tar -czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
  /etc/nginx/ \
  /etc/redis/ \
  /etc/my.cnf

# 保留90天
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +90 -delete
```

## 恢复流程

### MySQL恢复

1. 停止应用写入
2. 确认恢复时间点
3. 恢复全量备份
```bash
gunzip < full_20260101.sql.gz | mysql -uroot -p
```
4. 应用binlog到指定时间点
```bash
mysqlbinlog --stop-datetime="2026-01-01 12:00:00" binlog.000001 | mysql -uroot -p
```
5. 验证数据完整性
6. 恢复应用访问

### 恢复演练

| 演练项目 | 频率 | 负责人 |
|---------|------|-------|
| 数据库恢复 | 每季度 | DBA |
| 配置恢复 | 每半年 | 运维 |
| 全站恢复 | 每年 | 运维团队 |

## 备份检查

### 每日检查

- [ ] 备份任务是否成功
- [ ] 备份文件大小是否正常
- [ ] 备份文件是否上传到OSS

### 每周检查

- [ ] 抽查备份文件可恢复性
- [ ] 检查备份空间使用情况
