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
