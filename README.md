# EdgeDrive

跑在 **Cloudflare Workers 边缘网络**上的 **Serverless** 文件服务：没有常驻服务器，按请求在就近节点执行。后台上传、设有效期、按文件夹整理；过期后下载返回 410。

公开侧：

- `/dl/文件路径` 下载
- `/dl/文件路径/view` 落地页（图片、音视频、PDF 可预览）
- 过期后返回 410

管理台可改标记颜色、分页和默认有效期。产品名固定为 **EdgeDrive**。

---

## 部署

需要：Cloudflare 账号、本仓库的 Git 权限。线上用 Cloudflare 绑定仓库自动部署，不要走 GitHub Actions。

不要在 `wrangler.jsonc` 里填数据库 ID 或桶名。代码里的绑定名必须是 **DB**（D1）和 **FILES**（R2）。

- **新 Worker**：第一次部署时还没有 Bindings，wrangler 会自动建一套 D1 和 R2 并绑上（名称类似 `edgedrive-db`、`edgedrive-files`）。
- **已经绑过**：Settings → Bindings 里已有 `DB` / `FILES` 时，部署会沿用，不会另建。

### 1. Fork 或导入本仓库

把代码放到你自己的 GitHub / GitLab 上，后面 Cloudflare 要连这个仓库。

### 2. 在 Cloudflare 里接上仓库

1. 打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Import a repository**，选第 1 步的仓库  
   如果 Worker 已经建好：点进该 Worker → **Settings** → **Build** → **Connect**
3. Worker 名称保持和仓库里的一致（默认 `edgedrive`）。若要换名，同时改 `wrangler.jsonc` 的 `name`
4. 生产分支选 `main`
5. 创建页通常**只让填构建命令**。构建命令填 `npm run build`（默认即可），部署命令不用填——Cloudflare 会自己跑 `npx wrangler deploy`。仓库会拦住这次部署：没有绑定就自动建 D1/R2，有绑定就沿用，然后跑数据库迁移并种齐 Variables and Secrets 字段名。
6. **Save and Deploy** / **部署**。

### 3. 想用已有的 D1 / R2（可选）

若账号里已经有库和桶，不想用自动建的那套：导入仓库后、第一次部署前，打开该 Worker → **Settings → Bindings**：

1. 添加 D1，变量名填 `DB`，下拉选已有数据库
2. 添加 R2，变量名填 `FILES`，下拉选已有桶

之后部署会沿用这里选的资源。若已经自动建过一套，把 Bindings 改成你的库/桶再部署即可。

### 4. 配置登录（必做）

部署成功后，打开该 Worker → **Settings** → **Variables and Secrets**。字段名已经在，不用再 Add，点进去把 `NULL` 改成真值即可。

`AUTH_MODE` 默认是 `password`（账密）。两种写法：

| `AUTH_MODE` | 还要改哪些 |
| --- | --- |
| `password` | `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD` |
| `access` | 管理入口由 Cloudflare Access 保护。GitHub / Google 等 OAuth 在 Access 里配，站点不再弹登录页 |

账密登录至少改这四项：

| 名称 | 填什么 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 随机字符串，至少 32 位。可在本机执行 `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | 浏览器访问本站的地址，不要末尾斜杠。例如 `https://edgedrive.你的账号.workers.dev`，绑了自定义域名就填那个 |
| `ADMIN_USERNAME` | 管理员用户名 |
| `ADMIN_PASSWORD` | 管理员密码 |

第一次打开站点后会按这两项创建管理员。已经有管理员之后，再改这两个 Secret 不会覆盖现有账号；要改密请进管理台。

改完 Secret 不用重新部署，刷新即可。值为 `NULL` 的项表示未配置，程序会当成没填。

可选：`CRON_SECRET` 给定时清理过期文件用。

### 5. 自定义域名（可选）

该 Worker → **Settings** → **Domains & Routes** → 绑你的域名。

绑好后，把 Secret 里的 `BETTER_AUTH_URL` 改成新地址（含 `https://`，不要末尾 `/`）。

### 6. 登录使用

打开站点首页，点「进入后台」（或直接访问 `/admin`）。用第 4 步设的账号登录。

之后可以：上传文件、设有效期、建文件夹、改标记颜色。下载路径是 `/dl/文件夹/文件名`。

统计页默认只显示本站数据。若要看 R2 / 数据库用量，把已有的 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 从 `NULL` 改成真值（Token 需 Account Analytics 读）。账号里有多套 Worker / R2 / D1 时，再改 `CF_WORKER_NAME`、`CF_R2_BUCKET`、`CF_D1_DATABASE_ID` 用来过滤，不是绑定本身。

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
