# EdgeDrive v2

> [中文](README.zh-CN.md) · English

Private file storage and capability-based sharing on Cloudflare Workers. R2 stores immutable blobs, D1 stores catalog metadata, and Cloudflare Access protects the admin workspace.

EdgeDrive v2 is a clean deployment. It intentionally does not migrate or serve the v1 schema, API, or share URLs.

## What is included

- Streaming single-part and R2 multipart uploads with a browser SHA-256 worker
- Real content deduplication: multiple file records can reference one stable blob
- Nested folders, search, starred/recent/expiring views, move, copy, recycle bin, restore and purge
- File and batch shares with separate 10-character preview/download codes
- Share password, lockout, expiry, revoke, preview permission, download permission and per-file download limit
- Safe public previews for images, video, audio, PDF, text, Markdown, Mermaid and highlighted code
- Local D1 overview for logical/physical bytes, dedupe savings, downloads and lifecycle queues
- Onyx, Porcelain and Nocturne themes; Chinese and English UI
- Cloudflare Access verification, same-origin mutation checks, daily cleanup and fail-closed schema checks

## Architecture

```text
Browser
  ├─ /admin + /api/admin/*     Cloudflare Access protected
  ├─ /p/{preview-code}         public preview page
  ├─ /s/{download-code}        public download landing
  └─ /c/{code}/{file-id}       range-capable R2 content

Worker / OpenNext
  ├─ D1: app_settings, folders, files, blobs
  ├─ D1: shares, share_items, share_codes
  ├─ D1: upload_sessions
  └─ R2: blobs/{random-uuid}
```

File names and folder moves never rename R2 objects. A physical blob is deleted only after its final file reference is purged.

## Deploy

Requirements: Node.js 20.9+, a Cloudflare account, D1 and R2.

```bash
npm install
npm run typecheck
npm test
npm run deploy
```

The committed defaults provision independent v2 resources:

- D1: `edgedrive-v2-db`, binding `DB`
- R2: `edgedrive-v2`, binding `FILES`
- migrations: `migrations-v2/`
- cleanup: daily at `04:00 UTC`

For local migration and preview:

```bash
npm run db:migrate:local
npm run preview
```

The first request also bootstraps an empty D1 database from the generated SQL. A partial, legacy, stale, or newer schema fails closed instead of being guessed or silently modified.

## First-run security

1. Create a Cloudflare Zero Trust → Access → Self-hosted application for your admin hostname or `/admin*` paths.
2. Add an Allow policy for the intended administrators.
3. Open `/admin` and enter:
   - Access Team: `acme` or `acme.cloudflareaccess.com`
   - Application AUD tag
   - Optional `SETUP_TOKEN` Worker secret, if configured
4. After setup, every admin page and `/api/admin/*` request requires a verified Access JWT. Share and content routes remain capability-controlled.

The Access Team is the tenant that issues the JWT; it is not the EdgeDrive application hostname such as `drive.example.com`. EdgeDrive normalizes either the team slug or the full `cloudflareaccess.com` hostname.

If the Access configuration is wrong, edit the v2 settings row from the D1 console:

```sql
UPDATE app_settings
SET access_enabled = 0, cf_access_team = '', cf_access_aud = ''
WHERE id = 1;
```

Then revisit `/admin` and complete setup again. Restrict D1 console access because this bypass is intentionally an operator-only recovery path.

## Development

```bash
npm run dev
npm run typecheck
npm test
npm run schema:check
npm run build
```

Important directories:

```text
src/app/api/admin/        authenticated API routes
src/server/v2/            catalog, upload, share and HTTP services
src/components/admin-v2/  admin workspace
src/components/public-*   public transfer experience
migrations-v2/            canonical fresh-deploy schema
scripts/generate-bootstrap.mjs
```

`src/lib/d1-bootstrap-sql.ts` is generated from `migrations-v2/*.sql`; do not edit it by hand.

## API outline

All admin mutations require a same-origin browser request and Cloudflare Access authentication.

| Area | Endpoints |
|---|---|
| Files | `GET /api/admin/files`, `PATCH /api/admin/files/{id}`, `POST /api/admin/files/actions` |
| Content | `GET /api/admin/files/{id}/content`; `HEAD` on the same path |
| Folders | `GET`, `POST /api/admin/folders`; `PATCH`, `DELETE /api/admin/folders/{id}` |
| Uploads | `POST /api/admin/uploads`, `PUT /uploads/{id}`, multipart parts + complete/abort |
| Shares | `GET`, `POST /api/admin/shares`; `PATCH`, `DELETE /api/admin/shares/{token}` |
| System | `GET /api/admin/overview`, `GET|PATCH /api/admin/settings`, `GET /api/health` |

Requests and responses are validated by the contracts in `src/lib/v2-contracts.ts`. List endpoints use stable cursor pagination and return `{ data, meta: { total, nextCursor } }`.

## Security notes

- Public HTML, SVG, XML and JavaScript content is forced to attachment to prevent stored XSS.
- Markdown is sanitized before rendering; Mermaid uses strict security mode.
- Share password cookies are HttpOnly, SameSite=Lax, time-limited and bound to the share token.
- Five failed password attempts lock a share for ten minutes.
- SQL values are parameterized. Batch operations are capped at 100 IDs.

## Repository privacy

Committed source and documentation use fictional examples only. Do not commit real account IDs, email addresses, custom domains, Access audiences, D1 UUIDs, API tokens, or generated deployment configuration. Account-specific `wrangler.resolved.json`, `.wrangler/`, `.dev.vars`, `.env*`, `.next/` and `.open-next/` files are ignored. Keep production secrets in Cloudflare Worker Secrets and runtime identity settings in D1.

Before publishing a fork, review both file content and Git author history; removing a value in a later commit does not remove it from earlier commits.
- Expired and trashed records are purged by retention policy; failed R2 deletion remains retryable as `delete_pending`.

## License

See [LICENSE](LICENSE).
