# 上线指南

先选一种方式：

- **只要网站公开展示**：用 WorkBuddy、GitHub Pages、Vercel 或 Netlify 做静态托管，最快也最省成本。
- **要保留用户名登录、账户后台和后台更新日志**：需要把整个站点部署到支持 Node 和持久化磁盘的环境。

WorkBuddy 的纯静态托管不会运行 `server.js`，所以静态版只能使用邮箱验证码登录，管理后台会提示“后台服务未连接”。

## 方案 A：静态上线

上传这些文件即可：

`index.html`、`styles.css`、`script.js`、`login.html`、`login.css`、`login.js`、`site-auth.js`、`cloud-config.js`、`workbuddy-sdk.js`、`changelog.html`、`changelog.js`

不要上传：

- `server.js`
- `.data/`
- `Dockerfile`、`docker-compose.yml`、`render.yaml`

上线后：

- 登录页自动切换为 WorkBuddy 云端邮箱验证码模式
- 用户名会保存在当前浏览器，用于站点导航显示
- 账户管理后台不可用

## 方案 B：完整上线（推荐 Render）

完整版包含用户名密码、管理员权限、账户管理和更新日志管理，必须部署到 Node 环境，并挂载持久化磁盘。

### 1. 推到 GitHub

在项目目录初始化仓库并推送：

```bash
git init
git add .
git commit -m "deploy personal site"
git branch -M main
git remote add origin https://github.com/hajikuo/你的仓库名.git
git push -u origin main
```

`.data/` 已在 `.gitignore` 中，不要提交账户数据。

### 2. 在 Render 创建 Web Service

- 连接 GitHub 仓库
- Runtime 选择 Node
- Build Command：`npm install`
- Start Command：`npm start`
- 添加环境变量：
  - `HOST=0.0.0.0`
  - `DATA_DIR=/var/data`
  - `ALLOW_REGISTRATION=false`
- 添加 Persistent Disk：
  - Name：`site-data`
  - Mount Path：`/var/data`
  - Size：1 GB

也可以直接使用仓库里的 `render.yaml` 创建 Blueprint。持久化磁盘需要 Render 的付费实例，免费实例重启后可能丢失账户数据。

### 3. 创建首个管理员

打开部署后的域名，进入 `login.html`，注册第一个账户。

即使已经设置 `ALLOW_REGISTRATION=false`，空站点仍允许创建首个管理员；创建完成后，注册入口会自动隐藏，后续账户请从 `admin.html` 新建。

如果你已经在本机注册过管理员（例如 `hajikuo`），推荐在线上重新注册一次首个管理员，流程最简单。也可以在停机状态下，把本机 `DATA_DIR/store.json` 安全上传到线上持久化磁盘的同一路径，再启动服务；不要把这个文件提交到公开仓库。

### 4. 绑定域名

在 Render 的 Custom Domains 中添加你的域名，然后到域名服务商添加 Render 提供的 CNAME 记录。HTTPS 证书会自动签发。

如果服务器位于中国大陆，域名通常需要完成 ICP 备案。

## 方案 B 备选：Railway

- 从 GitHub 新建项目
- 添加 Volume，挂载到 `/data`
- 环境变量：
  - `HOST=0.0.0.0`
  - `DATA_DIR=/data`
  - `ALLOW_REGISTRATION=false`
- Start Command：`npm start`

## 方案 B 备选：VPS / Docker

项目里已经提供 `Dockerfile` 和 `docker-compose.yml`：

```bash
docker compose up -d --build
```

默认监听 `4173`，数据保存在 Docker volume `site-data`。生产环境建议前面加 Nginx 反向代理，并用 Certbot 配置 HTTPS。

## 上线检查清单

- [ ] 已挂载持久化磁盘，`DATA_DIR` 指向该磁盘
- [ ] 首个管理员已创建
- [ ] `ALLOW_REGISTRATION=false`
- [ ] 联系方式和 GitHub 链接正确
- [ ] 域名 HTTPS 正常
- [ ] 定期备份 `.data/store.json` 或磁盘快照
- [ ] 不要公开 `.data/`、密码哈希或服务器文件

## 数据备份

完整版的数据在 `DATA_DIR/store.json`。备份时复制整个数据目录即可；恢复时停止服务、替换数据目录，再启动服务。
