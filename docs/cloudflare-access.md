# Cloudflare Access for EdgeDrive v2

EdgeDrive uses Cloudflare Access only for the admin workspace. Public `/p`, `/s` and `/c` routes are protected by their capability codes and optional share password.

## Configure

1. Zero Trust → Access → Applications → Add an application → Self-hosted.
2. Add the EdgeDrive admin hostname. If your plan supports path rules, scope it to `/admin*` and `/api/admin/*`; otherwise protect the hostname and add public bypass rules for `/p/*`, `/s/*`, `/c/*`, `/unlock/*` and `/api/health`.
3. Add an Allow policy for the intended user or group.
4. Copy the Access Team slug or hostname and the application AUD. For example, use `acme` or `acme.cloudflareaccess.com`; do not enter the application hostname such as `drive.example.com`.
5. Open `/admin` and complete the one-time setup form.

The Worker normalizes the Team value to its tenant slug. It accepts the Access JWT from `cf-access-jwt-assertion` or the `CF_Authorization` cookie and verifies issuer, audience, signature and time claims. Once enabled, missing or invalid identity fails closed.

## Optional setup token

Set a Worker secret before first visit to prevent another visitor from claiming the open setup flow:

```bash
npx wrangler secret put SETUP_TOKEN
```

## Operator recovery

If the team domain or AUD is incorrect, use the D1 console:

```sql
UPDATE app_settings
SET access_enabled = 0, cf_access_team = '', cf_access_aud = ''
WHERE id = 1;
```

Reopen `/admin` and complete setup with the correct values. Do not expose D1 console access to application users.

## Publishing safely

Keep real team names, application hostnames, account IDs, AUD values and database UUIDs out of committed examples. `wrangler.resolved.json` and local build/state directories are intentionally ignored; use Cloudflare Worker Secrets for secrets and D1 for runtime Access settings.
