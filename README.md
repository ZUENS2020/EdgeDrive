# EdgeDrive

跑在 **Cloudflare Workers 边缘网络**上的 **Serverless 文件服务**：没有常驻服务器，按请求在就近节点执行。后台上传、设有效期、按文件夹整理；过期后下载返回 410。

**EdgeDrive = 一套完整的私人文件托管 + 临时直链服务**：R2 存文件、D1 管元数据、Cloudflare Access 管身份——全部跑在 Cloudflare 免费层上。

---

## 特性

- **Serverless**：无服务器、免运维、全球边缘节点就近响应
- **后台上传**：拖拽 / 批量 / 分片（>8MB 自动分片，大文件无上限）；相同内容 **秒传**（SHA-256 去重，只写新记录、不重复传字节）
- **文件夹**：树形目录（图标 + 箭头、移动端可滚动）、新建 / 重命名 / 删除 / **树状移动对话框**
- **回收站**：删除为软删除，可还原；30 天后由 purge cron 彻底清除（R2+D1）
- **标签 / 收藏 / 最近**：逗号标签筛选、行内星标、最近上传 tab
- **有效期**：行内三档（小时 / 天数 / 永久）+ 批量设置 + 过期自动 410
- **预览页**：`/dl/.../view` 图片灯箱（放大/缩小/旋转）、视频 Range 拖进度、音频、PDF、Markdown+Mermaid+代码高亮、TXT；Markdown/PDF/TXT 限高容器内滚动
- **复制预览链接**：单文件复制 `/view` 落地页；多选则生成**一条**批量预览链接
- **批量分享**：多选后批量栏「复制链接 / 复制预览链接」各生成一个 `/dl/batch/{token}` 网盘页（全部下载 + 逐文件预览/下载）
- **选中高亮**：列表主色底、网格 3px 描边——深色 / 浅色 / Nocturne 下都明显
- **主题系统**：Onyx（默认暗色）/ Porcelain（浅色）/ Nocturne（铃鹿夜空）——设置页卡片切换，D1 持久、公开页跟随
- **Range 下载**：支持断点续传 / 视频拖动播放
- **统计仪表盘**：R2 容量与 Class A/B、D1 读写、Worker 调用量（GraphQL Analytics）—— 响应式一屏展示
- **安全**：路径穿越多层防护、XSS 内容类型硬化、SQL 全参数化、Cloudflare Access JWT 真实验证（fail-closed）
- **一键部署**：Fork → 导入 Cloudflare → 自动建 D1/R2/跑迁移 → 首次访问配置 Access

---

## ⚡ 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ZUENS2020/EdgeDrive)

点击上方按钮 → 连接 GitHub + Cloudflare 账号 → 填写 Worker/资源名 → **自动 fork + 构建 + 部署**（D1/R2 自动创建并绑定）。部署完成后打开 Worker 域名，按「首次引导」配置 Access 即可。

## 快速部署（约 5 分钟）

### 前置

- 一个 [Cloudflare](https://dash.cloudflare.com) 账号（免费即可）
- 一个 GitHub 账号

### 步骤

1. **Fork 本仓库**（GitHub → Fork）

2. **导入 Cloudflare**：
   - 登录 Cloudflare 面板 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
   - 选你 fork 的仓库 → **Begin setup**
   - 框架预设：`Next.js`；构建命令 `npm run build`；输出目录留空
   - **Save and Deploy** —— 首次部署会自动创建：
     - D1 数据库（`edgedrive-db`）+ 自动跑迁移建表
     - R2 存储桶（`edgedrive`）
     - Worker 绑定（`DB` / `R2`）

3. **首次访问配置 Access（引导模式）**：
   - 打开部署后给你的 `*.workers.dev` 域名
   - 访问 `/admin` —— **未启用 Access 前无需登录**，只显示引导页
   - 填写 **Access Team** 与 **AUD**，点 **启用 Access**
   - 之后所有管理请求走 Access JWT（未认证一律 401）

   > ⚠️ 部署后请**立刻**完成引导并在 Zero Trust 里保护 `/admin*`。引导页在启用前是开放的；可选 Worker Secret `SETUP_TOKEN` 防止别人抢先配置。

4. **部署更新**：push 到 main 即自动重新部署（Cloudflare Pages Git 集成）

> 可选：绑定自定义域名（Workers & Pages → 你的项目 → Custom domains）—— 直链会变成 `https://你的域名/dl/...`

---

## 🔐 Access 认证配置（详细）

EdgeDrive 用 **Cloudflare Access** 做管理台认证（无密码可爆破——只有 Cloudflare 账号能进）。

### 第 1 步：创建 Access 应用

1. Cloudflare 面板 → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. **Application domain** 填：
   - 只保护管理台（推荐，`/dl` 分享链接保持公开）：`你的域名/admin*`
   - 或全站保护：`你的域名/*`
3. **Add** → 保存

### 第 2 步：查两个关键值

| 值 | 在哪查 |
|---|---|
| **Access Team** | Zero Trust 域名前缀：`https://<team>.cloudflareaccess.com` 中的 `<team>` |
| **AUD** | Access 应用 → **其他设置**（Settings）标签页 → **AUD 标签**（一串十六进制）|

> ⚠️ **AUD 是每个应用独有的**——重建应用/撤销令牌后会变——配置后别乱动应用。

### 第 3 步：在 EdgeDrive 引导页启用

- 打开 `你的域名/admin` → 引导页填 **Team + AUD** → 点「启用 Access」
- 之后管理台只认 Access JWT（未认证 → 401/跳 Access 登录）

### 第 4 步：配置 Access 策略（重要！）

Access 应用**默认全部拒绝**——必须加 Allow 规则，否则登录后也 403：

- 在应用的 **Policies** 标签页 → **Add a policy**
- **Action** 选 `Allow`；**Include** 选 `Everyone`（或指定邮箱/组）
- 若用了 `/admin*` 路径保护 + 想要 `/dl` 公开：
  - **第一条策略**：`/dl*` → Allow Everyone
  - **第二条策略**：`/admin*` → Allow 你的邮箱/Everyone

### 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 登录后 403 Forbidden | Policy 没有 Allow 规则（默认全拒）| 加 Allow 策略 |
| 管理台一直 401 | AUD 填错/过期 | 用应用「其他设置」里的真实 AUD |
| hostname 应用只传 cookie 不传 header | CF 边缘行为差异 | EdgeDrive 已双通道兼容（header + cookie）——无需处理 |
| workers.dev 子域上 hostname 应用失效 | CF 已知历史 bug | 绑定**自定义域名**后用 hostname 应用 |

> 完整手册（含截图路径）：[docs/cloudflare-access.md](docs/cloudflare-access.md)

---

## 使用

### 上传

- 拖拽文件到管理台，或点选文件（支持多选）
- 文件 >8MB 自动走分片上传（8MB/片、4 并发、失败重试）—— 大小无上限
- 上传时落到当前文件夹

### 有效期

- 行内 / 右键「有效期」：小时 / 天数 / 永久 / 自定义 / 立即过期
- 批量勾选 → 批量设过期 / 转永久 / 立即过期
- 文件过期后：`/dl` 下载返回 **410 Gone**；物理删除由 purge 任务（每日 04:00 UTC）执行

### 直链

- 下载：`/dl/<路径>/<文件名>`（强制 attachment 下载）
- 预览：`/dl/<路径>/<文件名>/view`（图片灯箱 / 视频 Range / 音频 / PDF / Markdown+Mermaid / TXT）
- Markdown、PDF、TXT 在限高容器内滚动，不会把整页撑长
- 支持 `Range` 头（断点续传、视频拖进度条）

### 回收站 / 标签 / 收藏

- 删除进回收站，可还原；超过 30 天由每日 purge 彻底删除
- 行内或右键编辑标签，列表可按标签筛选
- 星标收藏；「最近」按上传时间倒序

### 秒传

上传前浏览器计算 SHA-256，命中已有文件则复制 R2 对象到新 key 并写 D1 记录，不传文件内容。

### 批量分享

多选文件后，批量栏直接两个按钮（无二级弹窗）：

| 按钮 | 复制的链接 | 打开后 |
|---|---|---|
| **复制链接** | `/dl/batch/{token}?mode=download` | 网盘列表 + **自动逐个触发下载** |
| **复制预览链接** | `/dl/batch/{token}` | 网盘列表，逐文件预览 / 下载 + 「全部下载」 |

- 每次点击都会新建一条 batch（高熵 token，32 字节 base64url）
- 一次最多 100 个文件；有效期取所选文件的**最短过期时间**，全部永久则 batch 也永久
- 页面列出类型图标 / 名称 / 大小 / 过期状态；已删除的文件会被跳过
- **不做服务端 ZIP**（Workers CPU 限制）——「全部下载」= 浏览器里每隔 300ms 点一次 `<a download>`
- 浏览器可能拦截无手势的多文件下载：页面会提示「如被拦截请点下方「全部下载」或允许浏览器下载」
- 过期 batch 返回 **410**；无效 token 返回 **404**
- 单文件行内 / 右键操作不变（仍是 `/dl/xx` 与 `/dl/xx/view`）

### 管理台界面

- **批量栏**（勾选 ≥1 个文件后出现在工具栏下方）：已选数量、复制链接、复制预览链接、移动、有效期、删除、取消
- **移动**：树状文件夹选择（根目录 + 可展开子目录），不是下拉框
- **选中**：列表行主色半透明底；网格卡片 3px 主色描边
- **主题**：设置页三张卡片（Onyx / Porcelain / Nocturne），保存后管理台与公开 `/dl` 页一起换肤

> 截图需要登录管理台才能拍。本机未接 Access 时无法自动截取线上 UI；部署后可在管理台多选文件对照上面两张表验证。

### 统计

- 管理台 → 统计：R2 容量与操作数、D1 读写与行数、Worker 请求与错误（来自 GraphQL Analytics）
- 在 **设置 → 账号** 里填 Cloudflare 账号 ID 与 API Token 后启用（Token 只需 `Account Analytics Read` 权限）
- 免费额度条仅作对照，账单以账号套餐为准

---

## 认证：首次引导 → Cloudflare Access

**没有密码登录。** Better-Auth 已移除。身份只认 Cloudflare Access JWT。

| 阶段 | 行为 |
|---|---|
| **未启用 Access** | `/admin` 免认证，只显示引导页（填 Team / AUD → 启用 Access） |
| **已启用 Access** | `requireAdmin` 只验 Access JWT；未认证返回 401 页（不跳 `/login`） |

公开下载 `/dl/*` 始终匿名可访问。

### 第 1 步：创建 Access Application

1. Cloudflare 面板 → **Zero Trust** → **Access → Applications** → **Add an application**
2. 类型选 **Self-hosted**；**Application domain 填 `<你的域名>/admin*`**（如 `edgedrive.example.com/admin*` 或 `*.workers.dev/admin*`）—— ⚠️ **只保护管理台路径**，公开下载 `/dl/*` 保持匿名可访问
3. Policy：配置允许访问的成员（如你的邮箱 / 组织）
4. 创建完成后，进入应用 → **其他设置（Other settings）** 标签页 → 筛选 **AUD 标签** → 复制 **令牌（Token）** 值（一串 UUID 长串）

### 第 2 步：在引导页填写并启用

| 字段 | 值（在哪查）|
|---|---|
| **Access Team** | Zero Trust 团队名 = **你的 Access 域名前缀**（`https://<team>.cloudflareaccess.com` 的 `<team>` 部分） |
| **Access AUD** | 第 1 步拿到的 AUD Token |

保存后写入 D1（`cf_access_team` / `cf_access_aud` / `access_enabled`）。**重新部署不会清空。**

> 💡 Team **不是** Account ID。Team 就是 `xxx.cloudflareaccess.com` 的前缀 `xxx`。

### 第 3 步：启用后

访问 `/admin` 会被 Cloudflare Access 拦截 → 登录后带 JWT 放行 → Worker 验签通过 → 进入管理台。

设置页只显示已配置状态，不能从 UI 关闭 Access（防把自己锁成「全开放」）。

> 回退：在 CF 面板临时关掉 Access Application **不会**重新打开引导页——Worker 仍 fail-closed。需要改 D1 `access_enabled` 才能回到引导。

### ⚠️ 关键：JWT 双通道读取（踩坑总结）

EdgeDrive 从**两个地方**取 Access JWT：

1. 请求头 `cf-access-jwt-assertion`（**Worker 级保护**会注入——**hostname 级应用可能不注入**）
2. `CF_Authorization` **cookie**（hostname 级应用通常只传这个——cookie 本身就是 JWT，验签方式相同）

> **不要**因为「登录后仍看到 401 页」就去改 Access 配置——先确认是不是 JWT 通道问题（hostname 级应用只传 cookie 是正常行为——EdgeDrive 已兼容）。

### 🩺 排障速查

| 现象 | 原因 | 解决 |
|---|---|---|
| `/admin` 直接 401 页（没弹 Access 登录）| Access 没保护该 URL | 检查 Target 路径（应为 `admin*`）|
| Access 登录后仍 401 | ① D1 的 AUD 是旧值 ② JWT 读不到 | ① 同步 D1（`UPDATE settings SET value='<新AUD>' WHERE key='cf_access_aud'`）② 确认 EdgeDrive ≥ 双通道版本 |
| 403 Forbidden（Access 页）| Policy 拒绝 | Policy 加 Allow 规则（你的邮箱 / Everyone）|
| Bypass 策略 | 不注入 JWT 且等于没保护 | 改用 **Allow** |

> **AUD 会变**：重建 Access 应用 / 点「撤销现有令牌」后 AUD 重新生成——必须同步 D1（否则验证失败）。

### 📖 完整手册

详细的每一步配置 + 验证方法 + 调试技巧见 **[docs/cloudflare-access.md](docs/cloudflare-access.md)**。

---

## 环境变量 / Secrets

| 名称 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `CF_API_TOKEN` | Secret | 可选 | 启用用量统计时用（优先于设置页填写的 Token）|
| `SETUP_TOKEN` | Secret | 可选 | 保护首次引导。未配则首次开放；配了则引导页必须填同一令牌 |

> 站点配置、cron 令牌、Access Team/AUD 默认全部存在 D1 —— 无需配置即可部署。

---

## 本机开发（可选）

```bash
npm install
npx wrangler d1 create edgedrive-db   # 建本地 D1（或按 README 部署流程自动建）
npm run dev
```

需要 `wrangler.jsonc` 里的绑定（D1 / R2）可用。类型检查：`npm run typecheck`；测试：`npm test`。

---

## 测试

```bash
npm test        # Vitest：sanitize / JWT / 有效期 / Access 守卫 / 批量分享 / 主题 / LIKE
npm run typecheck
npm run build   # 生成 D1 bootstrap SQL（含 batch_links）+ OpenNext Worker
```

GitHub Actions 会在每次 push 时自动跑测试 + 类型检查。

---

## 项目结构

```
migrations/                 D1 迁移（0010_batch_links.sql → schema_version 10）
src/
  app/
    admin/                  管理台（文件 / 统计 / 设置）
    api/
      batch/                POST 创建批量分享（Access 保护）
      files/                列表、上传、MPU、批量过期/删除
      cron/purge/           过期文件 + 过期 batch 清理
    dl/
      [...path]/            单文件下载 / /view 预览页
      batch/[token]/        批量分享页（公开）
  components/admin/         FileManager、FolderTree、MoveDialog、主题设置、统计
  lib/
    batch.ts                token / 最短过期 / CRUD
    batch-page.ts           批量页 HTML
    themes.ts               Onyx / Porcelain / Nocturne
    store.ts                files / folders / D1
scripts/                    cf-build / cf-deploy / wrangler shim
```

---

## 技术栈

- [Next.js 16](https://nextjs.org)（App Router）+ [OpenNext](https://opennext.js.org) → Cloudflare Workers
- [Cloudflare D1](https://developers.cloudflare.com/d1/)（SQLite 元数据 + 配置 + `batch_links`）
- [Cloudflare R2](https://developers.cloudflare.com/r2/)（对象存储，免费 10GB + 零出口流量费）
- [Refine](https://refine.dev) + [MUI](https://mui.com)（管理台 hooks / 表格 / 对话框）
- Cloudflare Access（JWT 认证）
- Vitest（测试）

## License

[GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）—— 网络服务同样适用 copyleft：修改后对外提供网络服务，须以同样许可证开源完整源码。
