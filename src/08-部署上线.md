# 部署指南

## 环境要求

### 硬件要求

| 角色 | CPU | 内存 | 磁盘 | 数量 |
|------|-----|------|------|------|
| Web服务器 | 8核 | 16GB | 100GB SSD | 3 |
| 数据库服务器 | 16核 | 64GB | 500GB SSD | 2 |
| 缓存服务器 | 4核 | 8GB | 50GB SSD | 2 |
| 负载均衡 | 4核 | 8GB | 50GB SSD | 2 |

### 软件要求

| 软件 | 版本 | 说明 |
|------|------|------|
| CentOS | 7.9+ | 操作系统 |
| Docker | 20.10+ | 容器运行时 |
| Nginx | 1.20+ | Web服务器 |
| MySQL | 8.0+ | 数据库 |
| Redis | 6.0+ | 缓存 |

## 部署步骤

### 1. 基础环境准备

```bash
# 更新系统
yum update -y

# 安装基础工具
yum install -y vim wget curl git

# 关闭SELinux
setenforce 0
sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config

# 配置时间同步
yum install -y chrony
systemctl enable chronyd
systemctl start chronyd
```

### 2. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker
systemctl enable docker
systemctl start docker

# 配置镜像加速
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF

systemctl restart docker
```

### 3. 部署应用

```bash
# 拉取镜像
docker pull your-registry/app:latest

# 启动容器
docker run -d \
  --name app \
  -p 8080:8080 \
  -v /data/app:/app/data \
  -e DB_HOST=10.0.3.11 \
  -e REDIS_HOST=10.0.2.11 \
  your-registry/app:latest
```

### 4. 配置 Nginx

```nginx
# /etc/nginx/conf.d/app.conf
upstream app_backend {
    server 10.0.1.11:8080 weight=1;
    server 10.0.1.12:8080 weight=1;
    server 10.0.1.13:8080 weight=1;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5. 验证部署

```bash
# 检查服务状态
docker ps

# 检查端口
ss -tunlp | grep 8080

# 测试访问
curl -I http://localhost:8080/health
```

## 配置文件说明

### 应用配置

| 配置项 | 路径 | 说明 |
|-------|------|------|
| 主配置 | /app/config/application.yml | 应用主配置 |
| 日志配置 | /app/config/logback.xml | 日志配置 |
| 数据库配置 | /app/config/datasource.yml | 数据库连接 |

### 环境变量

| 变量名 | 默认值 | 说明 |
|-------|-------|------|
| DB_HOST | localhost | 数据库地址 |
| DB_PORT | 3306 | 数据库端口 |
| REDIS_HOST | localhost | Redis地址 |
| LOG_LEVEL | INFO | 日志级别 |

## 回滚方案

```bash
# 停止当前版本
docker stop app

# 启动上一版本
docker run -d \
  --name app \
  -p 8080:8080 \
  your-registry/app:v1.0.0-previous

# 验证回滚
curl http://localhost:8080/health
```
