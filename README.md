# zuens-dl-platform

通用的下载资源管理平台：Next.js App Router + Cloudflare（OpenNext）+ D1 元数据 + R2 对象存储。

适合自建「带有效期的直链盘」——管理页可建文件夹、批量改期、搜索与统计；公开侧只有 `/dl/<路径>` 直链。

## 功能

- **双模式鉴权**：`AUTH_MODE=better-auth`（默认，Better Auth 单管理员账号密码）或 `AUTH_MODE=none`（应用层不鉴权，用 Cloudflare Access 保护 `/admin*`）
- **文件管理**：拖拽/批量上传、文件夹树、有效期三档（永久 / 限时 / 自定义）、批量操作、文件名搜索、仪表盘统计
- **下载**：`/dl/<路径>` 流式返回，`Content-Disposition: attachment`，Range，过期 410，下载计数 +1
- **可配置 UI**：站点名、描述、主色、每页条数、默认有效期（D1 `settings`）
- **零密钥**：代码不含 Cloudflare / 管理员密钥，全部走环境变量

## 技术栈

- Next.js 16（App Router）+ TypeScript + Tailwind CSS 4
- `@opennextjs/cloudflare` 部署到 Cloudflare Workers
- D1：`zuens-dl-db`（绑定名 `DB`）
- R2：`zuens-dl`（绑定名 `FILES`）
- Better Auth + bcryptjs（管理员哈希写入 `admin` 表）

## 快速开始（本地）

需要 Node.js 20.9+。

```bash
git clone <this-repo>
cd zuens-dl-platform
npm ci
cp .env.example .env.local
cp .dev.vars.example .dev.vars
# 编辑 .env.local 与 .dev.vars：BETTER_AUTH_SECRET / ADMIN_* / AUTH_MODE
npx wrangler d1 migrations apply zuens-dl-db --local
npm run dev
```

打开 http://localhost:3000 。管理页：http://localhost:3000/admin （默认账号见 `.dev.vars.example`）。

`next.config.ts` 里调用了 `initOpenNextCloudflareForDev()`，`npm run dev` 会用 wrangler 本地模拟 D1 / R2。

本地生产预览：

```bash
npm run preview
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `AUTH_MODE` | `better-auth`（默认）或 `none` |
| `BETTER_AUTH_SECRET` | Better Auth 会话密钥，至少 32 字符。`better-auth` 模式必填 |
| `BETTER_AUTH_URL` | 站点 origin，如 `https://dl.example.com` |
| `ADMIN_USERNAME` | 首次启动写入 D1 `admin` 表的用户名 |
| `ADMIN_PASSWORD` | 首次启动明文密码，bcrypt 后入库。已有 admin 时忽略 |
| `CLOUDFLARE_API_TOKEN` | 仅 CI / wrangler CLI，**不要**写进 `src/` |
| `CLOUDFLARE_ACCOUNT_ID` | 同上 |

Cloudflare 上用 secrets，不要写进 `wrangler.jsonc`：

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put BETTER_AUTH_URL
```

`AUTH_MODE` 已在 `wrangler.jsonc` 的 `vars` 里，可按部署改。

## 鉴权两种模式

### 1. `AUTH_MODE=better-auth`（默认）

- 登录页 `/login`，Better Auth 会话 cookie
- Next.js 16 `proxy.ts` 保护 `/admin*`（未登录跳转 `/login`）
- API `/api/files*` `/api/folders` `/api/stats` `/api/settings` 再校验 session
- 首次请求若 `admin` 表为空，用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 初始化（bcrypt）

### 2. `AUTH_MODE=none`

- 应用不检查登录，管理页直接可用
- **必须**在 Cloudflare Access（或同等网关）保护 `/admin*` 与 `/api/*`，放行 `/`、`/dl/*`、`/health`
- 适合已经用 Access 套在域名前面的部署（与旧版 `zuens-dl` Worker 相同模型）

## Cloudflare 资源

部署者改 `wrangler.jsonc` 里的绑定即可（保留结构，换成自己的 ID / 桶名）：

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "zuens-dl-db", "database_id": "<your-d1-id>" }]
"r2_buckets": [{ "binding": "FILES", "bucket_name": "zuens-dl" }]
```

创建示例：

```bash
npx wrangler d1 create zuens-dl-db
npx wrangler r2 bucket create zuens-dl
npx wrangler d1 migrations apply zuens-dl-db --remote
```

## 部署

OpenNext 1.x 产出的是 **Cloudflare Worker**（`main: .open-next/worker.js`），不是旧的 Pages 静态目录。

```bash
npm run deploy
# 等价于：npx opennextjs-cloudflare build && npx wrangler deploy
```

GitHub Actions：push `main` 后自动 `opennextjs-cloudflare build` + `wrangler deploy`。仓库 Secrets：

- `CLOUDFLARE_API_TOKEN`（Workers 脚本编辑 + D1 权限）
- `CLOUDFLARE_ACCOUNT_ID`

Worker secrets（`BETTER_AUTH_*` / `ADMIN_*`）在 Cloudflare Dashboard 或 `wrangler secret put` 配置一次即可。

自定义域名在 Workers 设置里绑到该 Worker。

## 数据模型（D1）

见 `migrations/0001_init.sql`：

- `files`：id / name / path（文件夹）/ size / mime / expires（null=永久）/ download_count / created_at / tags
- `folders`：id / name / parent_id / created_at
- `admin`：id / username / password_hash / created_at
- `settings`：key / value
- Better Auth：`user` / `session` / `account` / `verification`

## 直链

```
GET|HEAD /dl/<文件夹路径/文件名>
```

- 未过期：R2 流式下载，支持 Range
- 已过期：`410 Gone`
- 永久：`expires IS NULL`
- GET 且非续传（Range 起点为 0）时 `download_count + 1`

## 二次开发

组件都在 `src/components/`（Sidebar / FolderTree / FileTable / ExpireDialog / BatchBar / SettingsForm）。样式变量：`--brand`、`--accent`、`--bg` 等，管理页设置可改主色。

## License

Private until published. Add a license before making the repository public.
