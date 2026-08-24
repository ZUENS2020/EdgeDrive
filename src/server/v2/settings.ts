import type { AppSettingsDto } from "@/lib/v2-contracts";
import { normalizeAccessTeam } from "@/lib/access-jwt";
import { randomSecret } from "@/lib/app-config";
import { DomainError } from "./errors";

type SettingsRow = {
  theme_name: "onyx" | "porcelain" | "nocturne";
  language: "zh" | "en";
  page_size: number;
  default_expires: string;
  expired_retention_days: number;
  trash_retention_days: number;
  access_enabled: number;
  cf_access_team: string;
  cf_access_aud: string;
  cron_secret: string;
};

function toDto(row: SettingsRow): AppSettingsDto {
  return {
    themeName: row.theme_name,
    language: row.language,
    pageSize: Number(row.page_size),
    defaultExpires: row.default_expires,
    expiredRetentionDays: Number(row.expired_retention_days),
    trashRetentionDays: Number(row.trash_retention_days),
    accessEnabled: Boolean(row.access_enabled),
    cfAccessTeam: row.cf_access_team || "",
    cfAccessAud: row.cf_access_aud || "",
    cronSecretSet: Boolean(row.cron_secret),
  };
}

export async function readSettings(db: D1Database): Promise<AppSettingsDto> {
  const row = await db.prepare("SELECT * FROM app_settings WHERE id = 1").first<SettingsRow>();
  if (!row) throw new DomainError("schema-not-ready", 503);
  if (!row.cron_secret) {
    row.cron_secret = randomSecret();
    await db.prepare("UPDATE app_settings SET cron_secret = ?, updated_at = ? WHERE id = 1 AND cron_secret = ''")
      .bind(row.cron_secret, new Date().toISOString())
      .run();
  }
  return toDto(row);
}

export async function readAccessSettings(db: D1Database): Promise<{
  enabled: boolean;
  team: string;
  aud: string;
}> {
  const row = await db
    .prepare("SELECT access_enabled, cf_access_team, cf_access_aud FROM app_settings WHERE id = 1")
    .first<{ access_enabled: number; cf_access_team: string; cf_access_aud: string }>();
  if (!row) throw new DomainError("schema-not-ready", 503);
  return { enabled: Boolean(row.access_enabled), team: row.cf_access_team || "", aud: row.cf_access_aud || "" };
}

export async function updateSettings(
  db: D1Database,
  patch: Partial<{
    themeName: "onyx" | "porcelain" | "nocturne";
    language: "zh" | "en";
    pageSize: number;
    defaultExpires: string;
    expiredRetentionDays: number;
    trashRetentionDays: number;
    rotateCronSecret: boolean;
  }>,
): Promise<AppSettingsDto> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };
  if (patch.themeName != null) add("theme_name", patch.themeName);
  if (patch.language != null) add("language", patch.language);
  if (patch.pageSize != null) add("page_size", patch.pageSize);
  if (patch.defaultExpires != null) add("default_expires", patch.defaultExpires);
  if (patch.expiredRetentionDays != null) add("expired_retention_days", patch.expiredRetentionDays);
  if (patch.trashRetentionDays != null) add("trash_retention_days", patch.trashRetentionDays);
  if (patch.rotateCronSecret) add("cron_secret", randomSecret());
  if (sets.length) {
    sets.push("updated_at = ?");
    binds.push(new Date().toISOString());
    await db.prepare(`UPDATE app_settings SET ${sets.join(", ")} WHERE id = 1`).bind(...binds).run();
  }
  return readSettings(db);
}

export async function enableAccessV2(db: D1Database, team: string, aud: string): Promise<AppSettingsDto> {
  const current = await readSettings(db);
  if (current.accessEnabled) throw new DomainError("access-already-enabled", 409);
  const cleanTeam = normalizeAccessTeam(team);
  const cleanAud = aud.trim();
  if (!cleanTeam || !cleanAud) throw new DomainError("access-needs-team-aud", 400);
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE app_settings SET access_enabled = 1, cf_access_team = ?, cf_access_aud = ?, updated_at = ? WHERE id = 1")
    .bind(cleanTeam, cleanAud, now)
    .run();
  return readSettings(db);
}
