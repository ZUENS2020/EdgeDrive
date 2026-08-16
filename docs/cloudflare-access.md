# EdgeDrive × Cloudflare Access 配置指南

> 本文档是 EdgeDrive 接入 Cloudflare Access（Zero Trust）的**完整配置手册**——从建应用到排障——每一步都有验证方法。2026-08-16 实战验证。

## 架构概览

```
浏览器 → Cloudflare Access（边缘验证）→ EdgeDrive Worker → D1/R2
              │
              ├─ /admin*  → 需要登录（Access 放行）
              └─ /dl/*    → 公开（匿名可下载）
```

- **认证模式**：EdgeDrive 只支持 Cloudflare Access（无密码登录——首次部署走引导页配置）
- **Access 配置存 D1**（`cf_access_team` / `cf_access_aud` / `access_enabled`）——**重新部署不丢**
- **JWT 验证**：EdgeDrive 双通道读取（请求头 `cf-access-jwt-assertion` **或** `CF_Authorization` cookie）——都做完整验签（RS256 签名 / iss / aud / exp）

---

## 第 1 步：创建 Access Application

1. 登录 Cloudflare 面板 → **Zero Trust** → **Access → Applications** → **Add an application**
2. 类型选 **Self-hosted**
3. **Target（目标）**配置：
   - 子域：`dlp`（或你想要的）
   - 域：`zuens2020.work`（你的域名）
   - **路径（关键）**：`admin*`
   - → 效果：**只保护 `dlp.zuens2020.work/admin*`**——`/dl/*` 公开下载不受影响
4. **Policy（策略）**：
   - **第一条**：Action **Allow** → Include **Everyone**（或你的邮箱）→ 路径条件 `Path equals /admin*`
   - （可选第二条）**Allow** → 你的邮箱 → `Path equals /dl*`（不配也行——默认不保护）
   - ⚠️ **不要用 Bypass**（Bypass 不注入 JWT——且等于没保护）
   - Service Auth 策略会优先评估（期望服务令牌）——普通浏览器访问不受影响（不匹配即跳过）
5. **保存**

### 验证
```
curl -I https://dlp.zuens2020.work/admin
# 期望：302 → https://zuens2020.cloudflareaccess.com/cdn-cgi/access/login/...
curl -I https://dlp.zuens2020.work/dl/test.txt
# 期望：200/404（EdgeDrive 响应——没被 Access 拦）
```

---

## 第 2 步：获取 AUD 与 Team

### AUD（Application Audience）
1. Access → Applications → 你的应用（dlp）→ **其他设置（Other settings）** 标签
2. 筛选 **AUD 标签** → 复制 **令牌（Token）** 值
   - 形如：`43cacb479097059dff8e52f3f43a2c239e2d6dcae813d99938c122078380fd86`
3. ⚠️ **AUD 会变**：重建应用 / 点「撤销现有令牌」后 AUD 重新生成——**D1 里的值必须同步更新**（否则 JWT 验证失败）

### Team（Zero Trust 团队名）
- **Team = 你的 Access 域名前缀**：`https://<team>.cloudflareaccess.com` 的 `<team>` 部分
- 通常等于你的 Cloudflare 账号用户名（如 `zuens2020`）
- ⚠️ **Team ≠ Account ID**（`c02febc3...` 那种 32 位 hex 是 Account ID——用不上）

### 验证 Team
```
curl https://zuens2020.cloudflareaccess.com/cdn-cgi/access/certs
# 返回 200 + JSON（含 keys）→ Team 有效
```

---

## 第 3 步：配置 EdgeDrive（引导页）

### 首次部署（全新）
1. 部署 EdgeDrive 后访问 `/admin` → 显示**引导页**（未启用 Access 前免认证）
2. 填入 **Team** 和 **AUD** → 点「**启用 Access**」
3. 之后所有管理请求走 Access JWT 验证（fail-closed）

### 已有 Access 配置的站点
- D1 里已有 `cf_access_team` / `cf_access_aud` 的站点——**迁移自动置 `access_enabled=1`**（已启用——不会显示引导页）

### 防抢配（可选）
- 配置 Worker Secret `SETUP_TOKEN`——引导页提交时需要该令牌（未配置则首次开放）

### 更新 AUD（AUD 变了的情况）
```
npx wrangler d1 execute edgedrive-db --remote --command \
  "UPDATE settings SET value='<新AUD>' WHERE key='cf_access_aud'"
```

---

## 第 4 步：验证登录

1. 访问 `https://dlp.zuens2020.work/admin`
2. 期望：**Cloudflare Access 登录页**（选邮箱 / Google 登录）
3. 登录后自动带 JWT 重定向回 `/admin` → **进入管理台**

### 排障速查

| 现象 | 原因 | 解决 |
|---|---|---|
| `/admin` 直接到 EdgeDrive 401 页（没弹 Access 登录）| Access 没保护该 URL | 检查 Target 路径（应为 `admin*`）|
| Access 登录后**踢回 /login** | ① AUD 不匹配 ② EdgeDrive 读不到 JWT | ① 同步 D1 的 aud ② EdgeDrive 需双通道（见下）|
| **JWT 头 MISSING（只有 cookie）** | hostname 级 Access 应用**不注入** `cf-access-jwt-assertion` 头（只传 `CF_Authorization` cookie）——**这是正常行为** | EdgeDrive 已兼容 cookie 读取（双通道）——**无需改配置** |
| 403 Forbidden（Access 页）| Policy 拒绝 | Policy 加 Allow 规则（Include 你的邮箱/Everyone）|

> 💡 **关键知识点**：`Worker 级保护`（Workers → Access 标签）**保证注入 JWT 头**；`hostname 级应用`（自定义域名）**可能只传 cookie**。应用必须**双通道兼容**：优先读 `cf-access-jwt-assertion` 头，缺失时解析 `CF_Authorization` cookie（cookie 本身就是 JWT——验签方式相同）。

---

## 第 5 步：公开下载不受影响

- `https://dlp.zuens2020.work/dl/<文件路径>` → **匿名直接下载**（不经过 Access）
- 文件过期后返回 **410 Gone**
- 分享链接长这样：`https://dlp.zuens2020.work/dl/报告.pdf`

---

## 附：调试技巧

### 看 JWT 头是否存在（wrangler tail）
```bash
# 在 auth-guard.ts 的 requireAdmin 里临时加：
console.warn("[auth-debug] jwt=", jwt ? "present" : "MISSING", "| aud=", settings.aud.slice(0,8));

# 部署后抓日志（注意：python 管道有缓冲——用 grep --line-buffered）：
npx wrangler tail edgedrive --format pretty 2>&1 | grep --line-buffered -iE "auth-debug|access-jwt"
```

### 直接查 D1 配置
```bash
npx wrangler d1 execute edgedrive-db --remote --command \
  "SELECT key, value FROM settings WHERE key IN ('cf_access_team','cf_access_aud','access_enabled')"
```
