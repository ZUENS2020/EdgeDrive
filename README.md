# 直链盘

自建文件直链：后台上传、设有效期、按文件夹管理；公开侧 `GET /dl/<路径>` 直接下载，`/dl/<路径>/view` 给人看的落地页，过期返回 410。

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
| 鉴权 | `password` 账密、`oauth`（GitHub/Google）、`access`（Cloudflare Access）三选一 |

直链逻辑在 `src/app/dl/[...path]/route.ts`：

- `/dl/<key>`：R2 流式下载，`Content-Disposition: attachment`，支持 Range
- `/dl/<key>/view`：落地页（图片/音视频/PDF 可预览）
- 已过期：`410 Gone`（宽限期内对象仍在 R2，过了保留天数可清理）
- `expires IS NULL` 视为永久
- 完整下载 GET（非 `?inline=1`、非续传）时 `download_count + 1`

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
| `AUTH_MODE` | `password`（默认，别名 `better-auth`）、`oauth`、`access`（别名 `none`） |
| `BETTER_AUTH_SECRET` | 会话密钥，至少 32 字符。`password` / `oauth` 必填 |
| `BETTER_AUTH_URL` | 站点 origin，本地 `http://localhost:3000`，线上换成绑到 Worker 的域名 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅 `password` 模式、且 `admin` 表为空时写入 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | `oauth` 模式可选，配了才显示 GitHub 按钮 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `oauth` 模式可选，配了才显示 Google 按钮 |
| `OAUTH_ALLOW_EMAILS` | 可选，额外允许的邮箱。也可在设置页改 |
| `CRON_SECRET` | 选填，默认空。定时清理：`Authorization: Bearer <secret>` 调 `POST /api/cron/purge` |
| `CLOUDFLARE_ACCOUNT_ID` | 选填，默认空。填了才能在「统计」里拉 Cloudflare 分析 |
| `CLOUDFLARE_API_TOKEN` | 选填，默认空。需 **Account Analytics 读**。不要提交真实值 |
| `CF_WORKER_NAME` / `CF_R2_BUCKET` / `CF_D1_DATABASE_ID` | 统计过滤用，与 `wrangler.jsonc` 里的 Worker 名、R2 桶名、D1 `database_id` 一致 |

`wrangler.jsonc` 的 `vars` 里已有 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`（空字符串）。复制 `.env.example` / `.dev.vars.example` 也会带上空键。不填不影响上传和直链，统计页只显示本盘数据。

**密钥不要写进源码。** 登录相关线上用 Worker secrets：

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
# oauth 时再 put GITHUB_* / GOOGLE_*
```

若要开启统计里的 R2 A/B、D1 查询量和 Worker 调用：本地写入 `.dev.vars` / `.env.local`；线上把空 vars 覆盖成 secret（不要把 Token 填进 `wrangler.jsonc` 再提交）：

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

`AUTH_MODE`、`CF_WORKER_NAME`、`CF_R2_BUCKET`、`CF_D1_DATABASE_ID` 以及上述两个空的 `CLOUDFLARE_*` 都在 `wrangler.jsonc` 的 `vars` 里。改绑定时一并改 `CF_*`。

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

仓库 Secrets（GitHub，只给 CI 部署用，和统计页那两个选填项不是一回事）：

- `CLOUDFLARE_API_TOKEN`（Workers 编辑 + D1）
- `CLOUDFLARE_ACCOUNT_ID`

管理员密码和 Better Auth 密钥只存在 Cloudflare Worker secrets，不要放进 GitHub。

## 鉴权

三种主模式互斥，由 `AUTH_MODE` 决定。不要 Access 套完再弹登录页。

### `password`（默认，`better-auth` 等同）

- `/login` 用户名密码
- 首次启动用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 种管理员
- 设置页可改密；关闭注册

### `oauth`

- `/login` 只有已配置的 GitHub / Google 按钮
- 回调：`{BETTER_AUTH_URL}/api/auth/callback/github` 与 `.../google`
- 设置里「允许的邮箱」；名单为空时，**第一个**成功登录的账号成为唯一管理员
- 之后名单外的账号不能注册

### `access`（`none` 等同）

应用层不登录。必须用 Cloudflare Access（或同等网关）保护 `/admin*` 和 `/api/*`，放行 `/`、`/dl/*`、`/health`。

`password` / `oauth` 下：`/admin*` 服务端守卫；`/api/files*` `/api/folders` `/api/stats` `/api/settings` 再校验 session。RSC 里 `getSession` 使用 `disableRefresh` + `disableCookieCache`。

## 直链

```
GET|HEAD /dl/<文件夹路径/文件名>        短链，直接下载（attachment）
GET      /dl/<文件夹路径/文件名>/view  长链，落地页（可预览图片/音视频/PDF）
```

过期返回 `410`。完整下载（非 `?inline=1`、非续传）时 `download_count + 1`。

管理台可改文件名、把文件挪到其它文件夹（目标有同名则拒绝）。过期文件可按「保留天数」手动或 `POST /api/cron/purge` 清理，永久文件不会被删。

## 统计

管理页 `/admin/usage`：

- **本盘**：D1 目录里的文件数、文件夹、合计大小、下载次数、各表行数
- **R2**：对象容量、对象数、**Class A**（写 / 列举 / 分片）、**Class B**（读 / Head）、免费删除类操作
- **D1**：库体积、读/写查询次数、扫描行、写入行
- **Worker**：请求数、错误、子请求、CPU p50/p99、调用状态

时间范围：24 小时 / 7 天 / 本月。本月对照 Cloudflare 免费档（R2 10 GB / 100 万 A / 1000 万 B，D1 5 GB），**不是账单**。

`CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN` **默认空、选填**。模板（`wrangler.jsonc` vars、`.env.example`、`.dev.vars.example`）里已经建好空键，复制后按需填写即可，不必先 `secret put`。空着时统计页只有本盘数据；填上后才走 [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/) 拉 R2 Class A/B、D1 查询量和 Worker 调用（Token 要有 Account Analytics 读权限）。过滤名：`CF_WORKER_NAME`、`CF_R2_BUCKET`、`CF_D1_DATABASE_ID`。

`GET /api/usage?range=month|7d|24h`（需登录）返回同一份 JSON。未填时 `analytics.configured` 为 `false`。

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
