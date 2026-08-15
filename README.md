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

设置存在 D1 `settings` 表，由 `src/lib/settings.ts` 读写。管理页「设置」分三类：**外观**（站点名、标记、公开页与登录页文案）、**文件**（分页、默认有效期、过期后保留天数与立即清理）、**账号**（账密改密，或 OAuth 允许邮箱；Access 模式下这里只说明网关管登录）。

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
| `CRON_SECRET` | 可选。定时清理：`Authorization: Bearer <secret>` 调 `POST /api/cron/purge` |

**密钥不要写进 `wrangler.jsonc` 或源码。** 线上用 Worker secrets：

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
# oauth 时再 put GITHUB_* / GOOGLE_*
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

## HTTP API

除特别标明外，JSON 出错时形如 `{ "error": "..." }`。

### 公开（无需登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` `HEAD` | `/dl/<key>` | 从 R2 下载。`Content-Disposition: attachment`。支持 `Range`。已过期 `410`，不存在 `404` |
| `GET` | `/dl/<key>/view` | HTML 落地页。图片 / 音视频 / PDF 可预览 |
| `OPTIONS` | `/dl/...` | CORS 预检 |
| `GET` | `/health`、`/api/health` | `{ ok, ts }` 探活 |

`/dl/<key>?inline=1`：对安全类型改为 `inline`（预览页里的媒体用）。HTML/SVG/JS 不会当 inline。路径按 `/` 分段，每段 `encodeURIComponent`。

### 管理接口鉴权

`password` / `oauth`：需要 Better Auth 会话 cookie。未登录返回 `401 { "error": "unauthorized" }`。

`access`：应用层不校验登录，由 Cloudflare Access（或同等网关）保护 `/admin*` 与 `/api/*`（放行 `/`、`/dl/*`、`/health`）。

登录相关由 Better Auth 挂在 `/api/auth/*`（`AUTH_MODE=access` 时该前缀返回 404）。OAuth 回调：

```
{BETTER_AUTH_URL}/api/auth/callback/github
{BETTER_AUTH_URL}/api/auth/callback/google
```

### 文件

`GET /api/files`

| 查询 | 说明 |
| --- | --- |
| `q` | 按文件名模糊搜。有 `q` 时忽略 `path` |
| `path` | 精确文件夹路径。空字符串=根目录。不传=全部 |
| `filter` | `all`（默认）`ok` `soon`（24h 内到期）`expired` |
| `page` | 从 1 起 |
| `pageSize` | 1–200，默认站点设置 |

返回 `{ files, total, page, pageSize }`。`files[]` 含 `id` `name` `path` `size` `mime` `expires`（`null`=永久）`download_count` `created_at` `key` `url` `viewUrl` `expired`。

`PATCH /api/files`

```json
{ "id": "<单个id>", "name": "新文件名" }
{ "ids": ["id1", "id2"], "path": "目标文件夹路径" }
```

`path` 空字符串表示根目录。一次只能改一个文件名。成功 `{ ok, moved }`。冲突：`file-exists` / `folder-not-found` / `rename-single` → 409。

`POST /api/files/batch`

```json
{ "ids": ["..."], "action": "delete" }
{ "ids": ["..."], "action": "permanent" }
{ "ids": ["..."], "action": "expireNow" }
{ "ids": ["..."], "action": "expire", "hours": 24 }
{ "ids": ["..."], "action": "expire", "days": 7 }
{ "ids": ["..."], "action": "expire", "expires": "2026-12-31T15:00:00.000Z" }
```

`delete` 同时删 D1 行和 R2 对象，返回 `{ ok, deleted }`。改期返回 `{ ok, expires }`（永久时 `expires` 为 `null`）。

### 上传

小文件：`PUT` 或 `POST /api/files/upload`

- Query：`name`、`path`（文件夹，可空）、可选 `hours` / `days` / `expires` / `permanent=1`
- Body：原始字节，或 `multipart/form-data` 字段 `file`（可另带 `name` `path`）
- 未指定有效期时用设置里的默认值
- 成功 `{ ok, id, key, url, expires }`

大于约 8MB 用分片 `/api/files/mpu`：

1. `POST /api/files/mpu?action=create&key=<对象key>` → `{ key, uploadId, expires }`
2. `PUT /api/files/mpu?action=part&key=...&uploadId=...&partNumber=<从1起>`，body 为该分片 → `{ etag }`
3. `POST /api/files/mpu?action=complete&key=...&uploadId=...`，JSON `{ "parts": [{ "partNumber", "etag" }] }` → `{ ok, id, key, url }`
4. 失败可 `DELETE /api/files/mpu?key=...&uploadId=...`（204）中止

`key` 为 `文件夹/文件名`，根目录则只有文件名。

### 文件夹

树形节点：`id` `name` `parent_id` `path` `children[]`。

| 方法 | 路径 | Body / Query | 成功 |
| --- | --- | --- | --- |
| `GET` | `/api/folders` | | `{ folders }` 嵌套树，不是平铺列表 |
| `POST` | `/api/folders` | `{ "name", "parent_id"? }` `parent_id` 空=根下 | `{ ok, folder }` |
| `PATCH` | `/api/folders` | `{ "id", "name" }` | `{ ok, folder }` |
| `DELETE` | `/api/folders?id=` | | `{ ok, deletedFiles, deletedFolders }` 含子文件夹 |

同名冲突 409。

### 设置、统计、账号、清理

`GET /api/settings` → `{ settings, authMode }`。`authMode` 为 `password` | `oauth` | `access`。

`PUT /api/settings` 部分字段即可，返回 `{ ok, settings }`。常用键：

- 外观：`site_name` `site_description` `logo_text` `brand_color` `admin_subtitle` `home_kicker` `home_dl_hint` `home_cta` `footer_note` `show_admin_link`
- 文件：`page_size` `default_expires`（`permanent` / `24h` / `7d` / `30d`）`purge_after_days`
- 账号：`oauth_allow_emails`（逗号或换行）

`GET /api/stats` → `{ fileCount, totalSize, downloadTotal, expiredCount, soonCount, soon }`。`soon` 为 24 小时内到期的文件摘要。

`POST /api/account/password` 仅 `password` 模式：`{ "currentPassword", "newPassword" }`，新密码至少 8 位。成功 `{ ok: true }`。当前密码不对 `bad-current`，否则 `password-mode-only`。

`POST /api/cron/purge` 删除「已过期且超过保留天数」的对象（永久文件不删）。两种授权：

- 已登录的管理员会话
- `Authorization: Bearer <CRON_SECRET>`（配置了 `CRON_SECRET` 时）

返回 `{ ok, deleted, batches, graceDays }`。

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
