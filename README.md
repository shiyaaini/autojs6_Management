# AutoJs6 管理平台（服务端 + Web）

> 仓库地址：https://github.com/shiyaaini/autojs6_Management

本项目包含两个子模块：
- `seaver`：Node.js 服务端，提供设备管理、脚本管理、APK分发、配置管理以及管理员登录能力
- `web`：React 前端，提供可视化管理界面（设备列表、屏幕墙、脚本仓库、设置等）

## 项目结构

```
autojs6/
├─ seaver/                 # 服务端（Express + ws + sqlite3）
│  ├─ src/                 # TypeScript 源码
│  ├─ dist/                # 构建输出
│  ├─ data/seaver.sqlite   # 本地数据库（自动创建）
│  ├─ config.yaml          # 管理员配置（自动创建）
│  └─ all_scripts / all_apk# 脚本仓库、APK仓库目录
├─ web/                    # 前端（React + Ant Design + Vite）
│  ├─ src/                 # 源码
│  └─ dist/                # 构建输出
└─ README.md
```

## 功能特性

- 管理员登录与凭据修改
  - 默认用户名与密码：`admin / admin`
  - 登录失败累计 20 次，自动锁定 6 小时
  - 登录成功发放令牌，默认有效期 24 小时
  - 凭据持久化存储在 `seaver/config.yaml`
- 设备管理
  - 设备列表、详情、远程控制、运行脚本、查看日志等
- 脚本仓库
  - 查看、拉取、推送、更新、删除脚本
- 屏幕墙与软件分发
  - 屏幕墙展示、APK批量安装等
- 配置管理
  - 管理平台秘钥（`matchCode`）读取与更新（前后端交互）

## 快速开始

### 1. 启动服务端（seaver）

- 安装依赖并启动开发模式：
  ```bash
  cd seaver
  npm install
  npm run dev
  ```
- 生产构建与启动：
  ```bash
  npm run build
  npm run start
  ```
- 默认端口：`4000`（可通过 `.env` 设置 `PORT`）

### 2. 启动前端（web）

- 安装依赖并启动开发模式：
  ```bash
  cd web
  npm install
  npm run dev
  ```
- 生产构建与预览：
  ```bash
  npm run build
  npm run preview
  ```
- 前端默认后端地址：
  - `web/src/config.ts` 默认指向 `http(s)://<当前主机>:4000`
  - 如需自定义后端地址，设置环境变量 `VITE_API_BASE_URL`

## 配置说明（服务端）

- 环境变量（`.env`）：
  - `PORT`：服务端端口，默认 `4000`
  - `CORS_ORIGIN`：跨域白名单，默认 `*`
  - `MATCH_CODE`：设备连接校验码（也在前端设置页展示和更新）
  - `SCRIPTS_REPO_ROOT`：脚本仓库根目录，默认 `seaver/all_scripts`
  - `APK_REPO_ROOT`：APK仓库根目录，默认 `seaver/all_apk`
- 管理员凭据（持久化文件）：
  - `seaver/config.yaml`：
    ```yaml
    adminUsername: admin
    adminPassword: admin
    ```
  - 可在前端的“设置 → 管理员设置”中安全更新账号与密码

## 鉴权与路由守卫（前端）

- 登录页面：`/login`
- 路由守卫：未登录访问任意业务页面，自动跳转到 `/login`
- 登录成功后，自动跳回用户尝试访问的原始页面
- 参考实现：
  - 前端守卫：`web/src/App.tsx:84`
  - 登录页：`web/src/pages/LoginPage.tsx:1`
  - 设置页管理员模块：`web/src/pages/SettingsPage.tsx:235`

## 后端接口（核心）

- 鉴权相关（参考 `seaver/src/routes/authRoutes.ts:12`）：
  - `GET /api/auth/status`：查询锁定状态与剩余错误次数
  - `POST /api/auth/login`：登录，成功返回 `{ token }`
  - `POST /api/auth/logout`：退出登录（需要 `Authorization: Bearer <token>`）
  - `POST /api/auth/change`：修改管理员凭据（需要 `Bearer token` 与 `currentPassword`）
- 配置秘钥（参考 `seaver/src/routes/configRoutes.ts:6`）：
  - `GET /api/config/secret`：获取 `matchCode`
  - `POST /api/config/secret`：更新 `matchCode`
- 设备与脚本等接口已内置（详见 `seaver/src/routes/*`）

## 安全建议

- 首次部署后立即更改默认管理员密码
- 使用反向代理（如 Nginx）限制外网访问的范围
- 仅对需要的接口开放端口和路径

## 部署参考

- 后端：Node.js 18+，Windows/Linux 均可运行
- 前端：`web/dist` 产物可置于任何静态资源服务器（Nginx、Netlify 等）
- 反向代理示例（伪示例）：
  ```nginx
  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
  }
  location /ws/device {
    proxy_pass http://127.0.0.1:4000/ws/device;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
  ```

## Docker 一键部署

- 需要 Docker 与 Docker Compose v2
- 在项目根目录执行：
  ```bash
  docker compose up -d --build
  ```
- 访问地址：
  - 前端：`http://localhost:8080`
  - 后端（可选直连调试）：`http://localhost:4000`
- 国内源：已在镜像构建中设置 npm 源为 `https://registry.npmmirror.com`（见 `.npmrc` 与 Dockerfile），加速依赖安装。

### 组成与映射

- 构建文件：
  - 服务端：`seaver/Dockerfile`
  - 前端：`web/Dockerfile`
  - Nginx 代理：`web/nginx.conf`
  - 编排：`docker-compose.yml`
- 目录与配置映射（见 `docker-compose.yml`）：
  - `seaver_data:/app/data`（sqlite 持久化）
  - `./seaver/config.yaml:/app/config.yaml`（管理员配置）
  - `./seaver/all_scripts:/app/all_scripts`（脚本仓库）
  - `./seaver/all_apk:/app/all_apk`（APK 仓库）
- Nginx 代理规则（默认）：
  - `/api/*` → `seaver:4000`
  - `/ws/device` → `seaver:4000/ws/device`

### 自定义

- 修改后端环境变量（`docker-compose.yml` → `seaver.environment`）：
  - `PORT`、`CORS_ORIGIN`、`MATCH_CODE` 等
- 若仅希望通过前端访问后端，可移除 `seaver.ports` 的 `4000:4000` 映射。
- 前端构建使用相对路径请求后端（`/api/...`、`/ws/device`），无需额外跨域配置。

## 关键实现位置（便于开发者查阅）

- 服务端入口与 WS：`seaver/src/server.ts:1`
- 配置与管理员凭据读写：`seaver/src/config.ts:33`、`seaver/src/config.ts:59`
- 登录锁定与令牌管理：`seaver/src/store/authStore.ts:1`
- 前端登录页：`web/src/pages/LoginPage.tsx:1`
- 前端路由守卫：`web/src/App.tsx:84`
- 设置页管理员模块：`web/src/pages/SettingsPage.tsx:235`

---

如需提交到 GitHub，请直接将本仓库推送到：`https://github.com/shiyaaini/autojs6_Management`