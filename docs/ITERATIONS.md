# EdgeDrive 第二十三轮迭代（R23 · 2026-08-17）

## 目标

全短链：创建分享自动生成下载/预览两条 `/s/{code}`；所有复制入口只出短链（长链 `/dl/...` 仍可访问但不展示）。行内直放「复制下载」「复制预览」图标；删除「复制链接」；row_actions 同步为 `copy_download` / `copy_preview`。

## 改动

- 迁移 0017：`share_short_codes(code, token, mode)`，下载码与预览码各一条；默认行操作改为 `copy_download` / `copy_preview`
- 创建分享始终分配两个 6–8 位 base62 短码（查重 `share_links.short_code` + `share_short_codes.code`）
- `/s/{code}`：mode 短码分别 302 到下载/预览落地；权限关闭则 404；旧 `share_links.short_code` 仍走原落地；`/dl?...` 长链兼容
- 行内图标：复制下载 / 复制预览（不藏右键）；「新建分享」留在 ⋮ / 右键；设置页勾选项同步
- 新建分享成功面板、分享页复制、公开预览页「复制*」均输出短链

## 验证

- `npm test`：42 files / 278 tests 全绿
- `tsc --noEmit`（`noUnusedLocals`）通过
- `npm run build` 通过

---

# EdgeDrive 第二十二轮迭代（R22 · 2026-08-17）

## 目标

R21 分享语义补充：新建分享成功后同时给出下载 + 预览两条可复制链接；分享页可改已有链接的 `allow_download` / `allow_preview`（PATCH）；预览页内下载按钮由 `allow_download` 控制（`=1` 时预览页也能下）。

## 权限语义（修正）

| allow_download | allow_preview | 行为 |
|---|---|---|
| 1 | 1 | 下载链接可用 + 预览页可开（页内也能下载） |
| 1 | 0 | 下载链接可用 + 预览页 404 |
| 0 | 1 | 下载链接 404 + 预览页可开但页内下载禁用 |
| 0 | 0 | 创建/PATCH 均 400 |

预览链接是「打开预览界面」的入口，不是「只能看」；页内下载能力单独由 `allow_download` 决定。`inline=1` 仍跟预览走（嵌入内容），附件下载走 `allow_download`。

## 改动

- 新建分享对话框：创建成功后停留并显示两条绝对 URL（`copyAbsoluteUrl`），按开关启用/禁用对应栏
- 分享页：复制打开双链接面板；菜单可分别复制；新增「权限设置」→ PATCH
- `toShareView` / `shareCopyPaths`：始终返回真实下载/预览路径（权限只挡访问，不改 URL 形状）
- `PATCH /api/share/[token]`：支持 `allow_download` / `allow_preview`，结果为 0/0 则 400（不写库）
- 老链接 `allow_download`/`allow_preview` 为 null 仍视为 1

## 验证

- `npm test`：42 files / 268 tests 全绿
- `tsc --noEmit`（`noUnusedLocals`）通过
- `npm run build` 通过

---

# EdgeDrive 第十二轮迭代（R12 · 2026-08-16）

## 目标

网盘增强 6 项：回收站（软删除 + 还原 + 30 天清）、标签筛选、收藏星标、最近文件、秒传（SHA-256）、预览体验（视频 Range / 图片灯箱 / 音频 / PDF / Markdown+Mermaid / TXT / 限高滚动 / 响应式）。

## 验证

- `npm test` / `tsc --noUnusedLocals` / `npm run build`

---

# EdgeDrive 第八轮迭代（R8 · 2026-08-16）

## 目标

- 认证改「首次引导模式」：删密码 / Better-Auth；未启用 Access 前 `/admin` 免认证只显示引导页；启用后全走 Access JWT
- 管理台 UI 用 Refine + MUI 重写（Cloudreve 风格：面包屑 / 右键菜单 / 多选 / 拖拽上传 / 文件夹树）
- 清理 `authModeLocked`、登录密码、Better-Auth 表

## 验证

- `npm test` / `tsc` / `npm run build`

---

# EdgeDrive 第四轮迭代（fix/review-r4）


日期：2026-08-16

## 目标

按审查报告收口剩余 P1：测试+CI、分片并发、下载计数异步、purge 定时、Secret 分模式、部署 shim 防护、migrations 统一。

## 迭代

### R4.1 测试骨架与纯函数

- Vitest + `npm test` + GitHub Actions `test` + `tsc`
- `sanitizeKey` 增加循环解码，挡住 `%252e` 双编码穿越
- 覆盖 sanitize 14 项、expires、JWT、LIKE、auth gate

### R4.2 上传 / 下载 / cron / secret / schema

- MPU 并发池 4、单片重试 2 次（1s/2s）、失败 abort
- 下载计数 `waitUntil` / fire-and-forget
- `GET /api/cron/purge` + `triggers.crons` `0 4 * * *`；构建后注入 `scheduled` 转 GET
- `CF_API_TOKEN` env 优先于 D1
- wrangler postinstall：结构变化则 exit 1；README 写明 `npm run deploy`
- 核心表齐全才算 ready；`schema_version` 落后则硬报错

### R4.3 验证

- `npm test`：8 files / 45 tests 全绿
- `npm run typecheck`（tsc --noEmit）全绿
- MPU：`runPool` 实测并发上限 3、失败中止；AdminApp 走 `uploadMpuParts`（>16MB 即 ≥3 片 / 8MB）
- 下载计数：`scheduleDownloadIncrement` 不阻塞，交给 `ctx.waitUntil`
- purge：GET/POST 同源 Bearer；wrangler `0 4 * * *`；构建注入 `scheduled` → GET `/api/cron/purge`
- OpenNext `worker.js` 仍含 `export default { async fetch... }` 注入针（已核对）
