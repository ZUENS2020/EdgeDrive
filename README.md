# 直链盘

自建文件直链：后台上传、设有效期、按文件夹管理；公开侧只有 `GET /dl/<路径>` 下载，过期返回 410。

运行在 **Cloudflare Workers** 上。元数据进 **D1**，文件进 **R2**。站点名、首页文案、登录页、侧栏、标记颜色都可以在 `/admin/settings` 改，不必改代码。

## 实现方式

```
浏览器
  └─ Cloudflare Worker（OpenNext 把 Next.js App Router 编成 Worker）
        ├─ D1  `DB`     文件/文件夹/管理员/设置/Better Auth 表
        └─ R2  `FILES`  对象本体
```

| 层 | 做什么 |
| --- | --- |
| Next.js 16 App Router | 页面与 Route Handler。公开：`/`、`/dl/...`、`/health`。管理：`/admin`、`/login`、`/api/*` |
| OpenNext (`@opennextjs/cloudflare`) | `npm run deploy` 产出 `.open-next/worker.js`，用 wrangler 部署成 Worker，不是 Pages 静态站 |
| D1 | `files` / `folders` / `admin` / `settings`（key-value）以及 Better Auth 的 `user` / `session` / `account` / `verification` |
| R2 | 对象 key 与库里的 `path/name` 一致。本地下载走 `arrayBuffer()`，线上走 stream |
| 鉴权 | 默认 Better Auth 单管理员；也可关掉应用鉴权，改用 Cloudflare Access 挡 `/admin*` |

直链逻辑在 `src/app/dl/[...path]/route.ts`：

- 未过期：从 R2 流出，`Content-Disposition: attachment`，支持 Range
- 已过期：`410 Gone`（对象仍留在 R2，只是链接失效）
- `expires IS NULL` 视为永久
- 完整 GET（非续传）时 `download_count + 1`

设置存在 D1 `settings` 表，由 `src/lib/settings.ts` 读写。管理页「设置」分三块：站点（名称 / 简介 / 标记文字与颜色）、首页与登录（副标题、直链说明、按钮、页脚、是否露出后台入口）、管理与上传（侧栏副标题、分页、默认有效期）。

### Worker 上必须遵守的约束

OpenNext 跑在 Workers 上，**不要在 RSC 渲染阶段写 cookie**，否则管理页 500：

- `getSession` 必须带 `disableRefresh` + `disableCookieCache`（见 `src/lib/auth-guard.ts`）
- 登录成功用 `window.location.assign` 整页跳转，不要用 App Router 软导航
- **不要**加 `proxy.ts` / Node middleware

本地 `next dev` 通过 `initOpenNextCloudflareForDev()` 模拟 D1 / R2。本地往 R2 `put` 前要先 `arrayBuffer()`。

## 部署

需要：Node.js 20.9+、Cloudflare 账号、Wrangler（随项目 `npm ci` 安装）。

绑定名固定为 `DB` 和 `FILES`。Worker 名、D1 库名/ID、R2 桶名写在 `wrangler.jsonc`，必须指向你账号里真实存在的资源。复制到新账号时先创建资源，再改这个文件。

### 1. 创建 Cloudflare 资源（新账号）

```bash
npx wrangler d1 create <你的-d1-名>
npx wrangler r2 bucket create <你的-r2-桶名>
```

把输出的 `database_id` 和名称填进 `wrangler.jsonc`，并改 `name`（Worker 名）。`package.json` 里的 `db:migrate*` 脚本也要改成同一个 D1 名。

已有绑定可跳过这一步。

### 2. 环境变量

复制模板：

```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```

| 变量 | 说明 |
| --- | --- |
| `AUTH_MODE` | `better-auth`（默认）或 `none` |
| `BETTER_AUTH_SECRET` | 会话密钥，至少 32 字符。`better-auth` 必填 |
| `BETTER_AUTH_URL` | 站点 origin，本地 `http://localhost:3000`，线上换成正式域名 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅在 D1 `admin` 表为空时写入（bcrypt）。已有管理员则忽略 |

**密钥不要写进 `wrangler.jsonc` 或源码。** 线上用 Worker secrets：

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

`AUTH_MODE` 已在 `wrangler.jsonc` 的 `vars` 里。

### 3. 本地开发

```bash
npm ci
npx wrangler d1 migrations apply <你的-d1-名> --local
# 或：npm run db:migrate:local
npm run dev
```

打开 <http://localhost:3000>，管理页 <http://localhost:3000/admin>。账号密码以 `.dev.vars` 为准。

本地预览（先 OpenNext 再 wrangler）：

```bash
npm run preview
```

### 4. 发布到 Cloudflare

先迁远程库，再构建部署：

```bash
npx wrangler d1 migrations apply <你的-d1-名> --remote
npm run deploy
# 等价于：npx opennextjs-cloudflare build && npx wrangler deploy
```

自定义域名在 Workers 设置里绑到该 Worker。`BETTER_AUTH_URL` 必须与浏览器实际访问的 origin 一致。

### 5. GitHub Actions

push `main` 会跑 `.github/workflows/deploy.yml`：应用 D1 迁移 → OpenNext build → `wrangler deploy`。

仓库 Secrets（GitHub）：

- `CLOUDFLARE_API_TOKEN`（Workers 编辑 + D1）
- `CLOUDFLARE_ACCOUNT_ID`

管理员密码和 Better Auth 密钥只存在 Cloudflare Worker secrets，不要放进 GitHub。

## 鉴权

### `AUTH_MODE=better-auth`（默认）

- `/login` 账号密码登录
- `/admin*` 服务端守卫，未登录跳转登录页
- `/api/files*` `/api/folders` `/api/stats` `/api/settings` 再校验 session
- 关闭注册；只有首次启动用环境变量种一个管理员

### `AUTH_MODE=none`

应用层不登录。必须用 Cloudflare Access（或同等网关）保护 `/admin*` 和 `/api/*`，放行 `/`、`/dl/*`、`/health`。

## 数据模型

见 `migrations/`。`0001_init.sql` 建表；后续迁移只追加设置项（`INSERT OR IGNORE`，不覆盖你已改过的值）。

- `files`：`id` / `name` / `path` / `size` / `mime` / `expires`（null=永久）/ `download_count` / `created_at` / `tags`
- `folders`：`id` / `name` / `parent_id` / `created_at`
- `admin`：用户名与密码哈希
- `settings`：文案与分页等 key-value

## 目录

```
src/app/           页面与 API（含 /dl、/admin、/login）
src/components/    管理台 UI
src/lib/           D1/R2、鉴权、设置、过期时间
migrations/        D1 schema
wrangler.jsonc     Worker / D1 / R2 绑定
.open-next/        构建产物（不入库）
```
