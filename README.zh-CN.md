# EdgeDrive v2

> 中文 · [English](README.md)

运行在 Cloudflare Workers 上的私人文件存储与能力链接共享服务。R2 保存不可变对象，D1 保存目录元数据，Cloudflare Access 保护管理工作区。

EdgeDrive v2 采用全新部署，刻意不迁移、不继续提供 v1 数据库结构、API 或旧分享 URL。

## 主要能力

- 浏览器 SHA-256 Worker、流式单文件上传与 R2 分片上传
- 真正的内容去重：多个文件记录可引用同一个稳定 Blob
- 嵌套文件夹、搜索、星标/最近/即将过期视图、移动、复制、回收站、恢复和永久清理
- 单文件/批量共享，预览与下载使用独立的 10 位短码
- 分享密码、错误锁定、到期、撤销、预览/下载权限与单文件下载次数限制
- 图片、视频、音频、PDF、文本、Markdown、Mermaid 和代码高亮安全预览
- 基于 D1 本地数据的容量、去重收益、下载量和生命周期概览
- Onyx、Porcelain、Nocturne 三主题与中英文界面
- Cloudflare Access、同源写请求校验、每日清理和数据库版本故障关闭

## 架构

```text
浏览器
  ├─ /admin + /api/admin/*     Cloudflare Access 保护
  ├─ /p/{预览短码}             公开预览页
  ├─ /s/{下载短码}             公开下载落地页
  └─ /c/{短码}/{文件ID}        支持 Range 的 R2 内容

Worker / OpenNext
  ├─ D1: app_settings, folders, files, blobs
  ├─ D1: shares, share_items, share_codes
  ├─ D1: upload_sessions
  └─ R2: blobs/{随机UUID}
```

重命名和移动文件不会改 R2 Key；只有最后一个文件引用被永久清理后，物理对象才会删除。

## 部署

需要 Node.js 20.9+、Cloudflare 账号、D1 与 R2。

```bash
npm install
npm run typecheck
npm test
npm run deploy
```

默认会创建独立 v2 资源：

- D1：`edgedrive-v2-db`，绑定名 `DB`
- R2：`edgedrive-v2`，绑定名 `FILES`
- 迁移目录：`migrations-v2/`
- 清理任务：每日 `04:00 UTC`

本地迁移与预览：

```bash
npm run db:migrate:local
npm run preview
```

首次请求也会从生成的 SQL 初始化空 D1。若绑定的是残缺、旧版、过期或高于当前代码版本的数据库，系统会故障关闭，不会猜测或静默改表。

## 首次安全配置

1. 在 Cloudflare Zero Trust → Access → Applications 创建 Self-hosted 应用，保护管理域名或 `/admin*`。
2. 为管理员添加 Allow Policy。
3. 打开 `/admin`，填写：
   - Access Team：`acme` 或 `acme.cloudflareaccess.com`
   - 应用 AUD Tag
   - 可选 Worker Secret `SETUP_TOKEN`
4. 配置完成后，管理页与 `/api/admin/*` 都必须通过 Access JWT；分享页继续由能力短码控制。

Access Team 是签发 JWT 的租户，不是 `drive.example.com` 这类 EdgeDrive 应用域名。EdgeDrive 同时接受 Team 短名和完整的 `cloudflareaccess.com` 主机名，并统一规范化保存。

若 Access 配置错误，可在 D1 控制台执行运维恢复：

```sql
UPDATE app_settings
SET access_enabled = 0, cf_access_team = '', cf_access_aud = ''
WHERE id = 1;
```

之后重新访问 `/admin` 完成配置。D1 控制台权限必须严格限制，因为这是刻意保留给运维人员的恢复通道。

## 开发与验证

```bash
npm run dev
npm run typecheck
npm test
npm run schema:check
npm run build
```

主要目录：

```text
src/app/api/admin/        认证后的管理 API
src/server/v2/            目录、上传、共享与 HTTP 服务
src/components/admin-v2/  新管理工作区
src/components/public-*   公开传输体验
migrations-v2/            全新部署的唯一数据库结构
scripts/generate-bootstrap.mjs
```

`src/lib/d1-bootstrap-sql.ts` 由 `migrations-v2/*.sql` 生成，请勿手工修改。

## API 概览

| 范围 | 接口 |
|---|---|
| 文件 | `GET /api/admin/files`、`PATCH /api/admin/files/{id}`、`POST /api/admin/files/actions` |
| 内容 | `GET /api/admin/files/{id}/content`；同路径支持 `HEAD` |
| 文件夹 | `GET`、`POST /api/admin/folders`；`PATCH`、`DELETE /api/admin/folders/{id}` |
| 上传 | `POST /api/admin/uploads`、单文件 PUT、分片上传/完成/取消 |
| 共享 | `GET`、`POST /api/admin/shares`；`PATCH`、`DELETE /api/admin/shares/{token}` |
| 系统 | `GET /api/admin/overview`、`GET|PATCH /api/admin/settings`、`GET /api/health` |

请求和响应契约位于 `src/lib/v2-contracts.ts`。列表接口使用稳定游标，返回 `{ data, meta: { total, nextCursor } }`。

## 安全说明

- HTML、SVG、XML、JavaScript 公开内容强制下载，避免存储型 XSS。
- Markdown 渲染前消毒；Mermaid 使用 strict 安全模式。
- 分享密码 Cookie 使用 HttpOnly、SameSite=Lax，有效期有限且绑定分享 Token。
- 连续 5 次密码错误会锁定 10 分钟。
- SQL 值全部参数化；批量操作最多 100 个 ID。
- 到期和回收站项目按策略清理；R2 删除失败会保留 `delete_pending` 供下次重试。

## 仓库隐私

提交到仓库的源码和文档只使用虚构示例。不要提交真实账号 ID、邮箱、自定义域名、Access AUD、D1 UUID、API Token 或生成的部署配置。账号相关的 `wrangler.resolved.json`、`.wrangler/`、`.dev.vars`、`.env*`、`.next/` 和 `.open-next/` 均已忽略；生产密钥应保存在 Cloudflare Worker Secrets，运行时身份配置保存在 D1。

发布派生仓库前，需要同时检查文件内容和 Git 作者历史；在后续提交中删除某个值，并不会把它从历史提交中移除。

## License

见 [LICENSE](LICENSE)。
