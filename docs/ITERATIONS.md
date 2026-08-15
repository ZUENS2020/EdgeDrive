# 迭代记录

## 2026-08-15 — v1 平台化

按任务书 `cursor-dl-platform-0815.md` 从 create-next-app 骨架做到可部署的下载资源管理平台。

### 做了什么

- Next.js 16 App Router（先读 `node_modules/next/dist/docs/`）：鉴权入口用 `proxy.ts`（middleware 已弃用），Route Handler 的 `params` 为 Promise，`cookies()` 为 async
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
