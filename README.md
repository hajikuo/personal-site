# 吕芫瑨 · 个人网站

## 本地运行（完整账户后台）

在站点目录运行：

```bash
node server.js
```

然后打开 <http://127.0.0.1:4173>。

首次注册的账户会自动成为管理员。注册完成后会进入 `admin.html`，可以：

- 搜索、筛选账户
- 新建账户、修改用户名、调整角色
- 停用 / 启用、删除账户
- 发布与删除网站更新日志

账户数据保存在 `.data/store.json`，密码使用 `scrypt` 加盐哈希。不要把这个目录上传到公开静态托管。

## 静态部署

如果只把 HTML / CSS / JS 上传到 WorkBuddy 等静态托管：

- 登录页会自动切换为邮箱验证码模式（WorkBuddy Cloud Auth）
- 用户名会保存在当前浏览器，用于站点导航显示
- 管理后台需要 Node 服务，静态部署时会显示“后台服务未连接”

完整的 Render / Railway / Docker / VPS 上线步骤见 [DEPLOY.md](DEPLOY.md)。

## 可调整项

- 端口：`PORT=8080 node server.js`
- 监听地址：`HOST=0.0.0.0 node server.js`（部署到服务器时使用）
- 数据目录：`DATA_DIR=/path/to/data node server.js`
- 关闭公开注册（已有账户后）：`ALLOW_REGISTRATION=false node server.js`
- 联系方式：在 `index.html` 的 `#contact` 区块中维护

## 页面

- `index.html`：主页、项目、笔记、工作台、更新日志
- `login.html`：登录 / 注册
- `admin.html`：账户与更新日志管理
- `changelog.html`：完整更新日志
