# 迭代记录

## 2026-08-15 — v2 修 RSC / 管理 UI 做全

按任务书 `cursor-dl-platform-r2-0815.md`。

### 根因

- 文档 GET `/admin`（带 cookie）在 OpenNext 下是 200，管理 HTML 能 SSR。
- 用非法 `Next-Router-State-Tree` 的 curl 会 500（`The router state header was sent but could not be parsed`）——这是 Next 16 schema，不代表浏览器真挂。
- 真浏览器登录后 RSC 导航本地 wrangler / 线上均可 200。仍加固：RSC 读 session 禁止写 cookie（`disableRefresh` + `disableCookieCache`）；登录后 `window.location.assign` 硬跳，避开软导航类 500。
- 手机 `<860px` 原先直接 `display:none` 整个侧栏，上传/文件夹/设置进不去。

### 做了什么

- `requireAdminPage()`：RSC 守卫不刷新 session cookie；失败则 307 `/login`
- 登录/退出改为整页跳转；`admin/error.tsx` 错误边界
- 手机顶栏 + 侧栏抽屉；上传按钮；Toast；上传后自动勾选（API 回 `id`）
- 文件夹「全部」vs「根目录」；复制链接降级 + 提示
- 设置页主色选择器，保存后 `--brand/--accent` 立刻生效
- `initOpenNextCloudflareForDev()` 补回 `next.config.ts`；README 去掉已删除的 `proxy.ts`

### 线上验收（workers.dev，Playwright Chromium）

1. 登录后 `/admin` 200，侧栏 + 文件表完整渲染（桌面/手机截图 `docs/screenshots/r2-0815/`）
2. 新建文件夹 → 上传进文件夹并自动勾选 → 行内设永久 → 复制链接 Toast → 搜索 LIKE → 筛选 → 统计数值 → 批量立即过期/转永久
3. `/dl/<folder>/<file>` 200 + `Content-Disposition: attachment`
4. 设置页改站点名/主色，首页与按钮色立即变化；再改回
5. 过期直链 410
6. 手机顶栏 + 菜单抽屉可进文件夹/上传/设置

curl 带非法 `Next-Router-State-Tree` 仍会 500（Next 16 schema），真实浏览器登录跳转不再走这条路径（硬跳 `/admin`）。

## 2026-08-15 — v1 平台化

按任务书 `cursor-dl-platform-0815.md` 从 create-next-app 骨架做到可部署的下载资源管理平台。

### 做了什么

- Next.js 16 App Router（先读 `node_modules/next/dist/docs/`）：第一轮曾用 `proxy.ts`，后改为 `admin/layout.tsx` 服务端守卫；Route Handler 的 `params` 为 Promise，`cookies()` 为 async
- Better Auth + D1 原生绑定；`AUTH_MODE=better-auth|none`；首次用 `ADMIN_USERNAME`/`ADMIN_PASSWORD` bcrypt 写入 `admin` 表并同步 `user`/`account`
- 文件：R2 存储 + D1 元数据；文件夹树；有效期三档；批量；搜索；统计；`/dl/` 流式、Range、410、计数
- Linear 暗色管理页（参考 `~/zuens-dl/src/admin-ui.js`），组件拆在 `src/components/`
- D1 `migrations/0001_init.sql`；`.env.example`；GitHub Actions
- OpenNext 1.20 部署目标是 Worker（`wrangler deploy`），不是 Pages 静态目录；`wrangler.jsonc` 去掉混用的 `pages_build_output_dir`，`main` 改为 `.open-next/worker.js`
- 本地 Miniflare R2 `put` 需要已知长度 body，上传改为 `arrayBuffer()` 再写入

### 本地验收（`npm run dev` + D1 `--local`）

1. `/`、`/health` 200；未登录 `/admin` → `/login`；`/api/files` 401
2. Better Auth `sign-in/username` 200 并种 cookie；建文件夹、上传、搜索、统计、批量改期/删除、文件夹重命名改 R2 key
3. `/dl/forever.txt` 200 + `Content-Disposition: attachment` + 计数 +1；Range 206；过期文件 410
4. `AUTH_MODE=none`：`/admin` 与 `/api/files` 不登录可进；`/login` 跳到 `/admin`
5. 管理页 HTML 含 sidebar / Linear 色板 / 拖拽上传
6. `src/` 无 `CLOUDFLARE_API_TOKEN`
