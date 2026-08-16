# EdgeDrive

> **[中文](README.zh-CN.md) · English**

![License](https://img.shields.io/github/license/ZUENS2020/EdgeDrive)
![GitHub stars](https://img.shields.io/github/stars/ZUENS2020/EdgeDrive)
![Tests](https://img.shields.io/badge/tests-178%20passing-brightgreen)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20OpenNext%20%2B%20Cloudflare-blue)

**A Serverless file-sharing service running on the Cloudflare Workers edge network** — no server to rent, no Docker to run, no ops to babysit. Upload with a background queue, set expiry dates, organize into folders — expired downloads return `410`.

**EdgeDrive = a complete private file hosting + temporary direct-link service**: R2 stores files, D1 manages metadata, Cloudflare Access handles identity — all running on the Cloudflare free tier.

---

## ✨ Features

- **Serverless**: no server, no ops, global edge nodes respond locally
- **Background uploads**: drag & drop / batch / multipart (auto-shards >8MB, no size limit); identical content **instant-upload** (SHA-256 dedupe — writes a new record, transfers zero bytes)
- **Folders**: tree structure (icons + expand arrows, scrollable on mobile), create / rename / delete / **tree-style move dialog**
- **Recycle bin**: deletes are soft — restorable; purge cron permanently removes after 30 days (R2 + D1)
- **Tags / Star / Recent**: comma-tag filtering, inline star toggle, recent-uploads tab
- **Expiry**: three inline presets (hours / days / permanent) + bulk set + auto `410`
- **Preview pages**: `/dl/.../view` — image lightbox (zoom/rotate), video Range streaming (seekable), audio, PDF, Markdown+Mermaid+code highlight, TXT; Markdown/PDF/TXT scroll inside height-limited containers
- **Copy preview link**: copy `/view` landing page per file; multi-select generates **one** batch preview link
- **Batch sharing**: multi-select → bulk bar "Copy link / Copy preview link" → `/dl/batch/{token}` web-disk page (download all + per-file preview/download)
- **Selection highlight**: primary-tinted rows in list view, 3px outline in grid view — visible in dark / light / Nocturne themes
- **Theme system**: Onyx (default dark) / Porcelain (light) / Nocturne — switch from Settings, persisted in D1, public pages follow
- **Range downloads**: resumable / video seeking
- **Stats dashboard**: R2 capacity & Class A/B, D1 reads/writes, Worker invocations (GraphQL Analytics) — responsive single-screen
- **Security**: multi-layer path traversal protection, XSS content-type hardening, fully parameterized SQL, real Cloudflare Access JWT verification (fail-closed)
- **One-click deploy**: fork → import to Cloudflare → auto-provisions D1/R2/runs migrations → first-visit Access onboarding

---

## ⚡ One-Click Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ZUENS2020/EdgeDrive)

Click the button → connect GitHub + Cloudflare accounts → pick Worker/resource names → **auto fork + build + deploy** (D1/R2 created & bound automatically). Open the Worker domain and complete the Access onboarding.

> **Troubleshooting: "Unable to fetch repository contents"**
>
> The deploy tool validates the repo URL from **your browser** (frontend fetches the GitHub API directly). If it fails, your egress IP likely hit GitHub's **anonymous rate limit** (60 req/h per IP — common on shared/NAT networks).
>
> - **Verify**: open `https://api.github.com/repos/ZUENS2020/EdgeDrive` in your browser — a rate-limit error means you're affected
> - **Fix 1**: switch networks (phone hotspot) and retry — a fresh IP resets the quota
> - **Fix 2**: wait ~1 hour (quota resets hourly)
> - **Fix 3**: skip the button — use the manual flow below (Cloudflare's backend fetches the repo, unaffected by your IP quota)

## 🚀 Quick Deploy (~5 min)

### Prerequisites

- A [Cloudflare](https://dash.cloudflare.com) account (free tier is fine)
- A GitHub account

### Steps

1. **Fork this repo** (GitHub → Fork)

2. **Import to Cloudflare**:
   - Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
   - Pick your fork → **Begin setup**
   - Framework preset: `Next.js`; build command `npm run build`; output directory empty
   - **Save and Deploy** — first deploy auto-creates:
     - D1 database (`edgedrive-db`) + runs migrations
     - R2 bucket (`edgedrive`)
     - Worker bindings (`DB` / `R2`)

3. **First-visit Access onboarding (guided mode)**:
   - Open your `*.workers.dev` domain
   - Visit `/admin` — **no login required until Access is enabled**, only the onboarding page shows
   - Fill in **Access Team** and **AUD**, click **Enable Access**
   - From then on, all admin requests go through Access JWT (401 without auth)

   > ⚠️ Complete onboarding and protect `/admin*` in Zero Trust **immediately** after deploying. The onboarding page is open until enabled; optional Worker Secret `SETUP_TOKEN` prevents others from hijacking the setup.

4. **Updates**: push to `main` → auto redeploy (Cloudflare Pages Git integration)

> Optional: bind a custom domain (Workers & Pages → your project → Custom domains) — direct links become `https://your.domain/dl/...`

---

## 🔐 Access Authentication (Detailed)

EdgeDrive uses **Cloudflare Access** for admin authentication (no brute-forceable passwords — only Cloudflare-account holders get in).

### Step 1: Create an Access application

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. **Application domain**:
   - Protect only the admin (recommended — `/dl` share links stay public): `your.domain/admin*`
   - Or protect everything: `your.domain/*`
3. **Add** → save

### Step 2: Find the two key values

| Value | Where |
|---|---|
| **Access Team** | Zero Trust domain prefix: the `<team>` in `https://<team>.cloudflareaccess.com` |
| **AUD** | Access app → **Other settings** tab → **AUD Tag** (hex string) |

> ⚠️ **AUD is unique per application** — it changes if you recreate the app or revoke tokens. Don't touch the app after configuring.

### Step 3: Enable in the EdgeDrive onboarding page

- Open `your.domain/admin` → onboarding page → fill **Team + AUD** → click **Enable Access**
- The admin now only accepts Access JWTs (401 / redirected to Access login otherwise)

### Step 4: Configure Access policies (important!)

Access apps **deny everything by default** — you must add an Allow rule or you'll get 403 after logging in:

- In the app's **Policies** tab → **Add a policy**
- **Action** = `Allow`; **Include** = `Everyone` (or specific email/group)
- If you protect `/admin*` and want `/dl` public:
  - **Policy 1**: `/dl*` → Allow Everyone
  - **Policy 2**: `/admin*` → Allow your email / Everyone

### Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| 403 Forbidden after login | No Allow rule (default deny-all) | Add an Allow policy |
| Admin keeps returning 401 | AUD wrong/outdated | Use the real AUD from "Other settings" |
| Hostname-level app sends cookie only, no header | CF edge behavior | EdgeDrive reads both (header + cookie) — nothing to do |
| Hostname apps on `workers.dev` subdomains fail | Known CF bug | Bind a **custom domain** for hostname apps |

> Full manual (with verification steps): [docs/cloudflare-access.md](docs/cloudflare-access.md)

### Troubleshooting: locked out by a wrong AUD

**Symptom**: Access login succeeds but EdgeDrive keeps returning 401; or you need to change AUD after onboarding but can't reach `/admin`.

**How it works**: Access config lives in the D1 `settings` table (`cf_access_team` / `cf_access_aud` / `access_enabled`) — edit D1 directly, no admin UI needed.

**① View current config**:

```bash
# run from the project directory (where wrangler.jsonc is)
npx wrangler d1 execute edgedrive-db --remote \
  --command "SELECT key, value FROM settings WHERE key IN ('cf_access_team','cf_access_aud','access_enabled')"
```

**② Fix the AUD** (copy from Access app → Other settings → AUD Tag):

```bash
npx wrangler d1 execute edgedrive-db --remote \
  --command "UPDATE settings SET value='YOUR_CORRECT_AUD' WHERE key='cf_access_aud'"
```

**③ Back to onboarding mode** (to reconfigure): set `access_enabled` back to `0` — `/admin` shows the onboarding page again:

```bash
npx wrangler d1 execute edgedrive-db --remote \
  --command "UPDATE settings SET value='0' WHERE key='access_enabled'"
```

**⚠️ If wrangler says "Couldn't find a D1 DB"**: your `wrangler.jsonc` has no `database_id` — temporarily add `"database_id": "<your D1 database ID>"` to `d1_databases` (Cloudflare dashboard → D1 → your database → ID), or pass `--database-id <ID>`.

**⚠️ After re-onboarding**: remember to set `access_enabled` back to `1` (or click "Enable Access" on the onboarding page, which writes it back).

---

## 📖 Usage

### Upload

- Drag files into the admin, or pick files (multi-select supported)
- Files >8MB auto-multipart (8MB parts, 4 concurrent, retry on failure) — no size limit
- Uploads land in the current folder

### Expiry

- Inline / context menu "Expiry": hours / days / permanent / custom / expire-now
- Bulk select → bulk set expiry / make permanent / expire now
- After expiry: `/dl` returns **410 Gone**; physical deletion runs in the daily purge (04:00 UTC)

### Direct links

- Download: `/dl/<path>/<filename>` (forces attachment)
- Preview: `/dl/<path>/<filename>/view` (image lightbox / video Range / audio / PDF / Markdown+Mermaid / TXT)
- Markdown, PDF, TXT scroll inside height-limited containers — never stretch the page
- Supports `Range` headers (resume, video seeking)

### Recycle bin / Tags / Star

- Deletes go to the recycle bin (restorable); daily purge permanently removes after 30 days
- Edit tags inline or via context menu; filter the list by tag
- Star favorites; "Recent" sorts by upload time desc

### Instant upload

The browser computes SHA-256 before upload; if a file with the same hash exists, the R2 object is copied to the new key with a new D1 record — **zero file bytes transferred**.

### Batch sharing

Multi-select → bulk bar has two buttons (no nested dialogs):

| Button | Copied link | What opens |
|---|---|---|
| **Copy link** | `/dl/batch/{token}?mode=download` | Web-disk list + **auto-triggered per-file downloads** |
| **Copy preview link** | `/dl/batch/{token}` | Web-disk list, per-file preview / download + "Download all" |

- Each click creates a new batch (high-entropy token, 32-byte base64url)
- Up to 100 files; expiry = **shortest expiry among selected files**; all-permanent → batch is permanent
- Page lists type icon / name / size / expiry status; deleted files are skipped
- **No server-side ZIP** (Workers CPU limit) — "Download all" = browser clicks `<a download>` every 300ms
- Browsers may block gesture-less multi-downloads: the page shows "if blocked, click Download all below or allow downloads"
- Expired batch → **410**; invalid token → **404**
- Single-file inline / context actions unchanged (`/dl/xx` and `/dl/xx/view`)

### Admin UI

- **Bulk bar** (appears when ≥1 file selected): count, copy link, copy preview link, move, expiry, delete, clear
- **Move**: tree-style folder picker (root + expandable children), not a dropdown
- **Selection**: list rows get primary-tinted background; grid cards get 3px primary outline
- **Themes**: three cards in Settings (Onyx / Porcelain / Nocturne); saved → admin and public `/dl` pages switch together

### Stats

- Admin → Stats: R2 capacity & operations, D1 reads/writes & rows, Worker requests & errors (from GraphQL Analytics)
- Enable by filling Cloudflare Account ID + API Token in **Settings → Account** (token only needs `Account Analytics Read`)
- Free-tier usage bar is for reference; billing follows your plan

---

## 🔑 Auth: First-visit onboarding → Cloudflare Access

**There is no password login.** Better-Auth has been removed. Identity is Cloudflare Access JWT only.

| Stage | Behavior |
|---|---|
| **Access not enabled** | `/admin` is unauthenticated, shows only the onboarding page (Team / AUD → Enable Access) |
| **Access enabled** | `requireAdmin` verifies Access JWT only; unauthenticated → 401 page (no `/login` redirect) |

Public downloads `/dl/*` stay anonymous.

### Key: JWT dual-channel reading (lessons learned)

EdgeDrive reads the Access JWT from **two places**:

1. `cf-access-jwt-assertion` header (injected by **Worker-level** protection — **hostname-level apps may not inject it**)
2. `CF_Authorization` **cookie** (hostname-level apps usually send only this — the cookie is the JWT itself, same verification)

> Don't "fix" Access config just because you see 401 after login — first check whether it's the JWT channel (hostname-level apps sending cookie-only is normal — EdgeDrive already handles both).

### Quick troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/admin` returns 401 page (no Access login) | Access doesn't protect that URL | Check Target path (should be `admin*`) |
| 401 after Access login | ① D1 AUD is stale ② JWT unreadable | ① sync D1 (`UPDATE settings SET value='<newAUD>' WHERE key='cf_access_aud'`) ② confirm dual-channel build |
| 403 Forbidden (Access page) | Policy denies | Add Allow rule (your email / Everyone) |
| Bypass policy | No JWT injected and effectively unprotected | Use **Allow** instead |

> **AUD changes**: recreating the Access app / clicking "revoke tokens" regenerates AUD — you must sync D1 or verification fails.

---

## ⚙️ Environment Variables / Secrets

| Name | Type | Required | Description |
|---|---|---|---|
| `CF_API_TOKEN` | Secret | Optional | For usage stats (takes priority over the token entered in Settings) |
| `SETUP_TOKEN` | Secret | Optional | Protects first-time onboarding. Unset = open; set = onboarding requires this token |

> Site config, cron tokens, Access Team/AUD all live in D1 by default — deploy with zero configuration.

---

## 🛠 Local Development (optional)

```bash
npm install
npx wrangler d1 create edgedrive-db   # create a local D1 (or let the deploy flow create it)
npm run dev
```

Requires the D1 / R2 bindings in `wrangler.jsonc`. Typecheck: `npm run typecheck`; tests: `npm test`.

---

## ✅ Testing

```bash
npm test        # Vitest: sanitize / JWT / expiry / Access guard / batch share / themes / LIKE
npm run typecheck
npm run build   # generates D1 bootstrap SQL (incl. batch_links) + OpenNext Worker
```

GitHub Actions runs tests + typecheck on every push.

---

## 📁 Project Structure

```
migrations/                 D1 migrations (→ schema_version 12)
src/
  app/
    admin/                  Admin (files / stats / settings)
    api/
      batch/                POST create batch share (Access protected)
      files/                list, upload, MPU, batch expiry/delete, copy, check (instant upload)
      cron/purge/           expired files + expired batches cleanup
    dl/
      [...path]/            single-file download / /view preview page
      batch/[token]/        batch share page (public)
  components/admin/         FileManager, FolderTree, PickFolderDialog, theme settings, stats
  lib/
    batch.ts                token / shortest-expiry / CRUD
    batch-page.ts           batch page HTML
    themes.ts               Onyx / Porcelain / Nocturne
    store.ts                files / folders / D1
scripts/                    cf-build / cf-deploy / wrangler shim
```

---

## 🧰 Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) + [OpenNext](https://opennext.js.org) → Cloudflare Workers
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite metadata + config + `batch_links`)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) (object storage, free 10GB + zero egress)
- [Refine](https://refine.dev) + [MUI](https://mui.com) (admin hooks / tables / dialogs)
- Cloudflare Access (JWT auth)
- Vitest (tests)

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0) — network copyleft: modified versions served over a network must be released under the same license with full source.
