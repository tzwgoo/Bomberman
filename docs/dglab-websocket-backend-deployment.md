# DG-LAB WebSocket v2 后端部署文档

## 1. 适用范围

本文只用于部署 `dungeonlab-open/dglab-websocket-simple` 仓库中的：

```text
socket/v2/backend
```

该服务负责在游戏网页与 DG-LAB APP 之间中继绑定、强度和波形消息，仅支持郊狼脉冲主机 3.0。

YYC-DJ 指令 WebSocket 不使用该后端。YYC-DJ 使用独立的 `WEBSOCKET_API` 和固定服务地址 `ws://103.236.55.92:43001`。

本文根据官方仓库提交 `e0c051efde020f57682a21159dd57c4c5a4a5cf6` 整理。

## 2. 服务结构

连接关系如下：

```text
Bomberman 网页
      │
      │ WebSocket
      ▼
socket/v2/backend
      ▲
      │ WebSocket
      │
DG-LAB APP ── 蓝牙 ── 郊狼 3.0
```

后端只保存内存中的连接和配对关系，不需要数据库。服务重启后，网页和 APP 必须重新扫码绑定。

## 3. 环境要求

- Linux 服务器，推荐 Ubuntu 22.04 或更高版本。
- Node.js 18 或更高版本。
- npm。
- 公网部署推荐使用独立域名，例如 `dglab-ws.example.com`。
- HTTPS 游戏页面必须配套使用 `wss://`。
- 生产环境推荐使用 PM2 守护进程，使用 Nginx 提供 TLS 和 WebSocket 反向代理。

Ubuntu 安装基础工具：

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx
```

Node.js 请通过 Node.js 官方安装方式或服务器现有版本管理器安装，不要使用低于 18 的版本。

检查版本：

```bash
node -v
npm -v
nginx -v
```

## 4. 获取源码

建议部署到 `/opt/dglab-websocket-simple`：

```bash
cd /opt
sudo git clone https://github.com/dungeonlab-open/dglab-websocket-simple.git
sudo chown -R "$USER":"$USER" /opt/dglab-websocket-simple
cd /opt/dglab-websocket-simple/socket/v2/backend
```

如果服务器已经有仓库：

```bash
cd /opt/dglab-websocket-simple
git pull --ff-only
cd socket/v2/backend
```

## 5. 安装依赖

仓库包含 `package-lock.json`，生产环境使用固定版本安装：

```bash
npm ci --omit=dev
```

后端要求 Node.js `>=18.0.0`。启动入口为 `src/index.js`。

## 6. 配置环境变量

官方后端 README 提到了 `.env.example`，但当前仓库没有提供该文件。直接在 `socket/v2/backend` 下创建 `.env`：

```bash
nano .env
```

推荐配置：

```env
PORT=9999
HEARTBEAT_INTERVAL=30000
DEFAULT_PUNISHMENT_TIME=1
DEFAULT_PUNISHMENT_DURATION=5
LOG_LEVEL=info
VERBOSE=false
```

配置说明：

| 变量 | 源码默认值 | 说明 |
| --- | ---: | --- |
| `PORT` | `9999` | WebSocket 监听端口 |
| `HEARTBEAT_INTERVAL` | `30000` | 服务端心跳间隔，单位毫秒 |
| `DEFAULT_PUNISHMENT_TIME` | `1` | 波形消息每秒发送次数 |
| `DEFAULT_PUNISHMENT_DURATION` | `5` | 未指定时的默认持续时间，单位秒 |
| `LOG_LEVEL` | `info` | `error`、`warn`、`info` 或 `debug` |
| `VERBOSE` | `false` | 设置为 `true` 时启用详细日志 |

注意：部分官方 README 将心跳默认值写成 `60000`，但当前 `src/config.js` 实际默认值是 `30000`。本文以源码为准。

## 7. 首次启动验证

前台启动：

```bash
npm start
```

正常日志包含：

```text
WebSocket 服务器启动，监听端口：9999
服务器启动完成
```

另开一个终端检查监听端口：

```bash
ss -lntp | grep 9999
```

使用浏览器控制台测试：

```javascript
const ws = new WebSocket("ws://服务器IP:9999");
ws.onmessage = (event) => console.log(JSON.parse(event.data));
ws.onerror = console.error;
```

连接成功后，服务端会立即返回类似消息：

```json
{
  "type": "bind",
  "clientId": "服务端生成的UUID",
  "targetId": "",
  "message": "targetId"
}
```

完成验证后按 `Ctrl+C` 停止前台进程。

## 8. 使用 PM2 守护

安装 PM2：

```bash
sudo npm install -g pm2
```

从后端目录启动：

```bash
cd /opt/dglab-websocket-simple/socket/v2/backend
pm2 start src/index.js --name dglab-socket --cwd /opt/dglab-websocket-simple/socket/v2/backend
```

检查状态和日志：

```bash
pm2 status
pm2 logs dglab-socket
```

保存进程列表并配置开机启动：

```bash
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条带 `sudo` 的命令。复制并执行该命令，然后再次执行：

```bash
pm2 save
```

常用操作：

```bash
pm2 restart dglab-socket --update-env
pm2 stop dglab-socket
pm2 delete dglab-socket
```

服务收到 `SIGINT` 或 `SIGTERM` 时，会清理波形定时器、关闭连接并退出。

## 9. 配置 Nginx 和 WSS

### 9.1 为什么推荐独立域名

DG-LAB APP 的二维码格式要求 WebSocket 地址后直接追加终端 ID，不能增加额外路径。因此推荐使用独立域名：

```text
wss://dglab-ws.example.com/终端ID
```

不要使用：

```text
wss://example.com/dglab/终端ID
```

### 9.2 Nginx 配置

创建配置：

```bash
sudo nano /etc/nginx/conf.d/dglab-websocket.conf
```

填写：

```nginx
server {
    listen 80;
    server_name dglab-ws.example.com;

    location / {
        proxy_pass http://127.0.0.1:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 9.3 配置 HTTPS 证书

使用 Certbot：

```bash
sudo certbot --nginx -d dglab-ws.example.com
```

完成后再次检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

最终 WebSocket 地址为：

```text
wss://dglab-ws.example.com
```

如果使用宝塔、1Panel、云负载均衡或 CDN，也必须开启 WebSocket 转发，并保证请求路径保持 `/`。

## 10. 防火墙配置

公网只开放 HTTP 和 HTTPS：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

不建议将 `9999` 直接暴露到公网。后端源码没有监听地址配置，会监听所有可用网卡；应通过系统防火墙或云安全组阻止公网访问 `9999`，只让本机 Nginx 转发。

如果只在局域网使用且没有 Nginx，可以按需开放：

```bash
sudo ufw allow from 192.168.0.0/16 to any port 9999 proto tcp
```

## 11. 配置 Bomberman 客户端

在 `client/.env` 中设置默认 DG-LAB WebSocket 地址：

```env
VITE_DGLAB_WS_URL="wss://dglab-ws.example.com"
```

Vite 环境变量会在构建时写入前端，修改后需要重新构建：

```bash
cd /opt/Bomberman
npm --prefix client run build
```

局域网或本地调试可以使用：

```env
VITE_DGLAB_WS_URL="ws://192.168.1.10:9999"
```

如果游戏页面使用 HTTPS，浏览器不允许连接 `ws://`，必须使用 `wss://`。

## 12. APP 配对流程

1. 启动 `dglab-socket` 服务。
2. 打开 Bomberman 首页的“设备连接”。
3. 连接方式选择“DG-LAB WebSocket（仅 3.0）”。
4. 确认 WebSocket 地址并点击连接。
5. 网页收到服务端分配的 `clientId` 后生成二维码。
6. 打开 DG-LAB APP 的 SOCKET 功能。
7. 使用 APP 扫描网页二维码。
8. 网页显示“已连接 DG-LAB APP”后再进入游戏测试事件反馈。

服务端建立的是内存配对。网页、APP 或后端任意一方断开后，都需要重新连接或扫码。

## 13. 日志和运行状态

后端在当前工作目录写入：

```text
logs/combined.log
logs/error.log
```

查看日志：

```bash
cd /opt/dglab-websocket-simple/socket/v2/backend
tail -f logs/combined.log
tail -f logs/error.log
```

配合 PM2：

```bash
pm2 logs dglab-socket
pm2 describe dglab-socket
```

日志目录已被官方仓库 `.gitignore` 忽略，不会进入 Git。

## 14. 旧版本增量部署

### 14.1 升级前确认

先确认服务器当前运行的是哪一种旧版：

- v1：入口通常是 `socket/v1/BackEnd(Node)/websocketNode.js`，端口 `9999` 写死在源码中。
- v2 旧提交：入口是 `socket/v2/backend/src/index.js`，端口来自 `.env` 或默认值 `9999`。
- 自定义版本：先记录实际目录、启动命令、端口和 Nginx 上游，不要直接覆盖。

检查 PM2、端口和 Nginx：

```bash
pm2 status
pm2 describe dglab-socket
ss -lntp | grep -E ':9999|:19999'
sudo nginx -T | grep -n "proxy_pass"
```

如果旧进程名不是 `dglab-socket`，后续命令中的 `<旧进程名>` 必须替换为实际名称。

升级会清空后端内存中的连接和配对关系。切换后，网页和 DG-LAB APP 需要重新连接并扫码。

### 14.2 备份旧版本

记录旧进程信息：

```bash
pm2 describe <旧进程名>
pm2 logs <旧进程名> --lines 100
```

备份源码、配置和 Nginx：

```bash
sudo mkdir -p /opt/backups
sudo cp -a /opt/dglab-websocket-simple /opt/backups/dglab-websocket-simple-before-v2
sudo cp /etc/nginx/conf.d/dglab-websocket.conf /opt/backups/dglab-websocket.conf.before-v2
```

如果旧目录是 Git 仓库，再记录提交号：

```bash
cd /opt/dglab-websocket-simple
git rev-parse HEAD
git status --short
```

存在未提交修改时，不要直接执行 `git pull` 或切换提交。先单独备份并确认这些修改是否仍然需要。

### 14.3 推荐方案：并行部署后切换

该方案不覆盖旧目录。旧服务继续监听 `9999`，新 v2 服务先监听 `19999`。

#### 14.3.1 部署新版本到独立目录

```bash
cd /opt
sudo git clone https://github.com/dungeonlab-open/dglab-websocket-simple.git dglab-websocket-simple-v2
sudo chown -R "$USER":"$USER" /opt/dglab-websocket-simple-v2
cd /opt/dglab-websocket-simple-v2/socket/v2/backend
npm ci --omit=dev
```

创建新版本 `.env`：

```env
PORT=19999
HEARTBEAT_INTERVAL=30000
DEFAULT_PUNISHMENT_TIME=1
DEFAULT_PUNISHMENT_DURATION=5
LOG_LEVEL=info
VERBOSE=false
```

启动灰度进程：

```bash
pm2 start src/index.js --name dglab-socket-v2 --cwd /opt/dglab-websocket-simple-v2/socket/v2/backend
pm2 logs dglab-socket-v2 --lines 100
```

检查新端口：

```bash
ss -lntp | grep 19999
```

#### 14.3.2 验证新进程

在服务器执行：

```bash
cd /opt/dglab-websocket-simple-v2/socket/v2/backend
npx wscat -c ws://127.0.0.1:19999
```

应立即收到包含以下字段的 JSON：

```json
{
  "type": "bind",
  "clientId": "UUID",
  "targetId": "",
  "message": "targetId"
}
```

退出 `wscat` 后，检查新进程没有持续报错：

```bash
pm2 logs dglab-socket-v2 --lines 100
tail -n 100 /opt/dglab-websocket-simple-v2/socket/v2/backend/logs/error.log
```

#### 14.3.3 切换 Nginx

将 Nginx 中的上游从旧端口：

```nginx
proxy_pass http://127.0.0.1:9999;
```

改为新端口：

```nginx
proxy_pass http://127.0.0.1:19999;
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

域名没有变化，因此 Bomberman 的 `VITE_DGLAB_WS_URL` 不需要修改，也不需要重新构建前端。

Nginx 重载后，新连接进入 v2。已有 WebSocket 连接可能继续停留在旧进程，直到主动断开。建议安排玩家退出设备连接后再切换，并通知用户重新扫码。

#### 14.3.4 观察和收尾

完成一次真实流程验证：

1. Bomberman 连接 `wss://dglab-ws.example.com`。
2. 网页正常生成二维码。
3. DG-LAB APP 扫码成功。
4. 测试 A、B 通道强度。
5. 测试一个游戏事件波形。
6. 断开后服务端能够清理配对和波形定时器。

建议保留旧进程至少一个观察周期。确认新版本稳定后再停止旧进程：

```bash
pm2 stop <旧进程名>
pm2 delete <旧进程名>
pm2 save
```

不要立即删除旧目录和备份。

### 14.4 回滚并行部署

如果新版本异常，将 Nginx 上游改回：

```nginx
proxy_pass http://127.0.0.1:9999;
```

然后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
pm2 restart <旧进程名>
pm2 stop dglab-socket-v2
```

确认旧服务恢复后，再分析新版本日志。回滚也会导致当前连接断开，网页和 APP 需要重新扫码。

### 14.5 可接受短暂停机时：v2 原地升级

仅当现有服务已经是 `socket/v2/backend`，并且可以接受短时断开时使用：

```bash
cd /opt/dglab-websocket-simple
git status --short
git rev-parse HEAD
git pull --ff-only
cd socket/v2/backend
npm ci --omit=dev
pm2 restart dglab-socket --update-env
pm2 logs dglab-socket --lines 100
```

原地升级前必须保存旧提交号。需要回滚时：

```bash
cd /opt/dglab-websocket-simple
git switch --detach <旧提交号>
cd socket/v2/backend
npm ci --omit=dev
pm2 restart dglab-socket --update-env
```

不要对存在未提交修改的生产目录执行上述回滚。优先恢复升级前的完整目录备份。

### 14.6 从 v1 升级的额外注意事项

- v1 的 `websocketNode.js` 固定监听 `9999`，不能通过 `.env` 改成灰度端口。
- 应保持 v1 使用 `9999`，让新 v2 使用 `19999`，通过 Nginx 切换。
- 不要把 v2 文件复制进 v1 目录，也不要复用 v1 的 `node_modules`。
- v2 新增日志、配对管理、波形定时器清理和环境变量配置，应使用新的工作目录。
- v1 和 v2 都只保存内存状态，切换时无法迁移现有配对。

YYC-DJ 指令 WebSocket 与本次升级无关，不需要修改或部署。

## 15. 常见问题

### 15.1 网页提示连接失败

依次检查：

```bash
pm2 status
ss -lntp | grep 9999
sudo nginx -t
sudo systemctl status nginx
```

同时检查云安全组、域名解析和证书是否正常。

### 15.2 HTTPS 页面无法连接 ws 地址

这是浏览器的混合内容限制。HTTPS 页面必须使用 `wss://`，不能使用 `ws://`。

### 15.3 能连接但 APP 无法扫码绑定

检查：

- 使用的是郊狼脉冲主机 3.0。
- 二维码中的地址可以被手机访问。
- 使用独立域名或根路径，没有 `/dglab` 等额外路径。
- Nginx 已转发 `Upgrade` 和 `Connection` 请求头。
- APP 和网页连接的是同一个 WebSocket 后端。

### 15.4 连接后立即断开

检查 Nginx 的 `proxy_read_timeout`。建议不低于 `120s`，应大于服务端心跳间隔。

### 15.5 错误码

| 错误码 | 含义 |
| --- | --- |
| `209` | 配对方已断开 |
| `400` | 客户端已被其他终端绑定 |
| `401` | 要绑定的客户端不存在 |
| `402` | 发送方与接收方不是有效绑定关系 |
| `403` | 消息不是有效 JSON |
| `404` | 缺少字段、来源非法或目标离线 |
| `405` | 消息长度超过限制 |
| `406` | 波形消息缺少通道 |
| `500` | 服务端内部异常 |

### 15.6 日志目录没有生成

确认 PM2 的 `cwd` 是：

```text
/opt/dglab-websocket-simple/socket/v2/backend
```

并确认运行用户对该目录有写权限。

## 16. 后续更新

更新：

```bash
cd /opt/dglab-websocket-simple
git pull --ff-only
cd socket/v2/backend
npm ci --omit=dev
pm2 restart dglab-socket --update-env
pm2 logs dglab-socket --lines 100
```

生产环境建议在更新前记录当前提交：

```bash
git rev-parse HEAD
```

如果新版本异常，可以切回已验证的提交，再重新安装依赖和重启 PM2。不要在存在本地修改时强制切换版本。

## 17. 官方资料

- [dglab-websocket-simple 仓库](https://github.com/dungeonlab-open/dglab-websocket-simple)
- [SOCKET 控制协议 v2](https://github.com/dungeonlab-open/dglab-websocket-simple/blob/main/socket/v2/README.md)
- [backend README](https://github.com/dungeonlab-open/dglab-websocket-simple/blob/main/socket/v2/backend/README.md)
- [backend 配置源码](https://github.com/dungeonlab-open/dglab-websocket-simple/blob/main/socket/v2/backend/src/config.js)
