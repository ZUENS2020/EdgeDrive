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

不要在 `wrangler.jsonc` 里填数据库 ID 或桶名。先自己建 D1 和 R2，再到该 Worker 的 **Settings → Bindings** 里选中它们。代码里的绑定名必须是 **DB**（D1）和 **FILES**（R2）。部署不会自动新建库或桶。

### 1. Fork 或导入本仓库

把代码放到你自己的 GitHub / GitLab 上，后面 Cloudflare 要连这个仓库。

### 2. 创建存储

打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)。名称可以自定，不必和仓库里的 Worker 名一致。

**数据库（D1）**

1. 左侧 **Workers & Pages** → **D1** → **Create**
2. 填一个你认得的名称，创建即可（不用复制 ID）

**文件桶（R2）**

1. 左侧 **R2** → **Create bucket**
2. 填一个你认得的名称，创建即可

也可以在本机：

```bash
npx wrangler login
npx wrangler d1 create 你的库名
npx wrangler r2 bucket create 你的桶名
```

### 3. 在 Cloudflare 里接上仓库

1. 打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Import a repository**，选第 1 步的仓库  
   如果 Worker 已经建好：点进该 Worker → **Settings** → **Build** → **Connect**
3. Worker 名称保持和仓库里的一致（默认 `dl-platform`）。若要换名，同时改 `wrangler.jsonc` 的 `name`
4. 生产分支选 `main`
5. 构建设置：

| 项 | 填 |
| --- | --- |
| **Build command** | `npm run build`（默认即可） |
| **Deploy command** | `npm run cf-deploy` |
| **Root directory** | `/` |

`npm run cf-deploy` 会：沿用 Bindings 里已有的 D1/R2（不自动建新的）、跑数据库迁移、并把 Variables and Secrets 里的字段名全部种上。不要用默认的 `npx wrangler deploy`。

6. 先 **Save**。若已经自动跑过一次部署并因缺少绑定失败，先做下一步再 **Retry**。

### 4. 绑定已有 D1 / R2

打开该 Worker → **Settings → Bindings**：

1. 添加 D1，变量名填 `DB`，下拉选第 2 步建的数据库
2. 添加 R2，变量名填 `FILES`，下拉选第 2 步建的桶

配置文件只声明了绑定名、没有写资源 ID，之后再部署会沿用这里选的资源，不会冲掉，也不会另建一套。

绑好后，在 **Deployments / Builds** 里点 **Retry**（或 **Save and Deploy**）。

### 5. 配置登录（必做）

部署成功后，打开该 Worker → **Settings** → **Variables and Secrets**。字段名已经在，不用再 Add，点进去把 `NULL` 改成真值即可。

`AUTH_MODE` 默认是 `password`（账密）。三种写法：

| `AUTH_MODE` | 还要改哪些 |
| --- | --- |
| `password` | `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD` |
| `oauth` | `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`，以及 GitHub / Google 的 `CLIENT_ID` 和 `CLIENT_SECRET` |
| `access` | 管理入口由 Cloudflare Access 保护，站点不再弹登录页 |

账密登录至少改这四项：

| 名称 | 填什么 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 随机字符串，至少 32 位。可在本机执行 `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | 浏览器访问本站的地址，不要末尾斜杠。例如 `https://dl-platform.你的账号.workers.dev`，绑了自定义域名就填那个 |
| `ADMIN_USERNAME` | 管理员用户名 |
| `ADMIN_PASSWORD` | 管理员密码 |

第一次打开站点后会按这两项创建管理员。已经有管理员之后，再改这两个 Secret 不会覆盖现有账号；要改密请进管理台。

改完 Secret 不用重新部署，刷新即可。值为 `NULL` 的项表示未配置，程序会当成没填。

OAuth 回调地址填：

```
https://你的站点/api/auth/callback/github
https://你的站点/api/auth/callback/google
```

可选：`OAUTH_ALLOW_EMAILS` 限制哪些邮箱能登录（也可在设置页改）；`CRON_SECRET` 给定时清理过期文件用。

### 6. 自定义域名（可选）

该 Worker → **Settings** → **Domains & Routes** → 绑你的域名。

绑好后，把 Secret 里的 `BETTER_AUTH_URL` 改成新地址（含 `https://`，不要末尾 `/`）。

### 7. 登录使用

打开站点首页，点「管理后台」（或直接访问 `/admin`）。用第 5 步设的账号登录。

之后可以：上传文件、设有效期、建文件夹、改站点名称和文案。直链形式是 `/dl/文件夹/文件名`。

统计页默认只显示本盘数据。若要看 R2 / 数据库用量，把已有的 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 从 `NULL` 改成真值（Token 需 Account Analytics 读）。账号里有多套 Worker / R2 / D1 时，再改 `CF_WORKER_NAME`、`CF_R2_BUCKET`、`CF_D1_DATABASE_ID` 用来过滤，不是绑定本身。

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
