# 直链盘

Serverless 下载管理工具。在后台上传文件、设有效期、按文件夹整理；别人用一条直链就能下载。跑在 Cloudflare 上，不用自己买服务器。

公开侧：

- `/dl/文件路径` 直接下载
- `/dl/文件路径/view` 落地页（图片、音视频、PDF 可预览）
- 过期后返回 410

管理台可改站点名称、文案和颜色，不必改代码。

---

## 部署

需要：Cloudflare 账号、本仓库的 Git 权限。线上用 Cloudflare 绑定仓库自动部署，不要走 GitHub Actions。

仓库里的 `dl-platform`、`dl-db`、`dl-files` 和全 0 的数据库 ID 只是占位，必须换成你账号里真实创建出来的名称和 ID。

### 1. Fork 或导入本仓库

把代码放到你自己的 GitHub / GitLab 上，后面 Cloudflare 要连这个仓库。

### 2. 创建存储

打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)。

**数据库（D1）**

1. 左侧 **Workers & Pages** → **D1** → **Create**
2. 名称填 `dl-db`（想换名也可以，后面要一起改）
3. 创建完成后复制 **database ID**

**文件桶（R2）**

1. 左侧 **R2** → **Create bucket**
2. 名称填 `dl-files`（想换名也可以，后面要一起改）

也可以在本机装好 Node 后用命令创建：

```bash
npx wrangler login
npx wrangler d1 create dl-db
npx wrangler r2 bucket create dl-files
```

第一条命令会打印 `database_id`，记下。

### 3. 填进配置

打开仓库根目录的 `wrangler.jsonc`，改这几处，保持和上一步一致：

| 字段 | 改成 |
| --- | --- |
| `name` | Worker 名，默认 `dl-platform`。Dashboard 里创建的 Worker 必须同名 |
| `d1_databases[0].database_name` | D1 名称，默认 `dl-db` |
| `d1_databases[0].database_id` | 上一步复制的数据库 ID（不要留全 0） |
| `r2_buckets[0].bucket_name` | R2 桶名，默认 `dl-files` |
| `vars.CF_WORKER_NAME` | 与 `name` 相同 |
| `vars.CF_R2_BUCKET` | 与桶名相同 |
| `vars.CF_D1_DATABASE_ID` | 与数据库 ID 相同 |

如果 D1 不叫 `dl-db`，把 `package.json` 里 `db:migrate` / `db:migrate:local` 后面的库名一并改掉。

提交并推送到你的仓库。

### 4. 在 Cloudflare 里接上仓库

1. 打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Import a repository**，选上一步的仓库  
   如果 Worker 已经建好：点进该 Worker → **Settings** → **Build** → **Connect**
3. Worker 名称必须和 `wrangler.jsonc` 里的 `name` 完全一致（默认 `dl-platform`）
4. 生产分支选 `main`
5. 构建设置填：

| 项 | 填 |
| --- | --- |
| **Build command** | `npm run build` |
| **Deploy command** | `npm run cf-deploy` |
| **Non-production deploy** | `npx wrangler versions upload` |
| **Root directory** | `/` |

Cloudflare 自动填的 Build command 可以保留。**Deploy command 不要用** `npx wrangler deploy`，改成 `npm run cf-deploy`。

6. **Save and Deploy**。第一次会自动构建并发布。之后每次 push `main` 都会再部署一次。

若已经失败过：改好 Deploy command 后，在该 Worker 的 **Deployments / Builds** 里点 **Retry**。

部署失败时，先核对：Worker 名是否一致、`database_id` 是否已换成真实 ID、D1 / R2 是否在同一个账号里。

### 5. 配置登录（必做）

部署成功后，打开该 Worker → **Settings** → **Variables and Secrets** → **Add** → 类型选 **Secret**。

默认是账密登录，至少加这四项：

| 名称 | 填什么 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 随机字符串，至少 32 位。可在本机执行 `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | 浏览器访问本站的地址，不要末尾斜杠。例如 `https://dl-platform.你的账号.workers.dev`，绑了自定义域名就填那个 |
| `ADMIN_USERNAME` | 管理员用户名 |
| `ADMIN_PASSWORD` | 管理员密码 |

第一次打开站点后会按这两项创建管理员。已经有管理员之后，再改这两个 Secret 不会覆盖现有账号；要改密请进管理台。

改完 Secret 不用重新部署，刷新即可。

可选：

| 名称 | 什么时候要 |
| --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 用 GitHub 登录 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 用 Google 登录 |
| `OAUTH_ALLOW_EMAILS` | 限制哪些邮箱能登录（也可在设置页改） |
| `CRON_SECRET` | 定时清理过期文件时用 |

如果要用 GitHub / Google 登录，把 `wrangler.jsonc` 里的 `AUTH_MODE` 改成 `oauth` 再推送。回调地址填：

```
https://你的站点/api/auth/callback/github
https://你的站点/api/auth/callback/google
```

如果管理入口已经由 Cloudflare Access 保护，把 `AUTH_MODE` 改成 `access`，站点本身不再弹登录页。

### 6. 自定义域名（可选）

该 Worker → **Settings** → **Domains & Routes** → 绑你的域名。

绑好后，把 Secret 里的 `BETTER_AUTH_URL` 改成新地址（含 `https://`，不要末尾 `/`）。

### 7. 登录使用

打开站点首页，点「管理后台」（或直接访问 `/admin`）。用第 5 步设的账号登录。

之后可以：上传文件、设有效期、建文件夹、改站点名称和文案。直链形式是 `/dl/文件夹/文件名`。

统计页默认只显示本盘数据。若要看 R2 / 数据库用量：

1. 在 Cloudflare 建一个有 **Account Analytics 读** 权限的 API Token
2. 把 Worker 上的 Secret `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 从 `NULL` 改成真实值  
   （第一次部署如果还没有这两项，会自动建成值为 `NULL` 的 Secret，直接改即可）

---

## 本机开发（可选）

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars：管理员账密、BETTER_AUTH_SECRET 等
npm ci
npm run db:migrate:local
npm run dev
```

打开 http://localhost:3000 。不要把 `.dev.vars` 提交进 Git。
