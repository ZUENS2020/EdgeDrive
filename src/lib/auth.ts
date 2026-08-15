import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { headers } from "next/headers";
import { compare, hash } from "bcryptjs";
import { ensureAuthSecret, originFromHeaders } from "./app-config";
import { getAuthMode, getDB } from "./cloudflare";

const BCRYPT_ROUNDS = 10;

function adminEmail(usernameValue: string) {
  return `${usernameValue.toLowerCase()}@admin.local`;
}

export function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9._-]{1,64}$/.test(value);
}

export async function createAuth(req?: Request | Headers) {
  const mode = await getAuthMode();
  if (mode === "access") {
    throw new Error("createAuth is not used when auth_mode=access");
  }
  const db = await getDB();
  const secret = await ensureAuthSecret(db);
  await ensureBetterAuthUser(db);
  const hdrs = req instanceof Request ? req.headers : req ?? (await headers());
  const baseURL = originFromHeaders(hdrs);

  return betterAuth({
    secret,
    baseURL,
    database: db,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 1,
      password: {
        hash: (password) => hash(password, BCRYPT_ROUNDS),
        verify: ({ hash: hashed, password }) => compare(password, hashed),
      },
    },
    plugins: [
      username({
        minUsernameLength: 1,
        maxUsernameLength: 64,
        usernameValidator: (value) => isValidUsername(value),
      }),
      nextCookies(),
    ],
    trustedOrigins: authTrustedOrigins(baseURL),
    onAPIError: {
      errorURL: "/login",
    },
    advanced: {
      csrf: { enabled: process.env.NODE_ENV === "development" ? false : true },
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
  });
}

export async function createFirstAdmin(usernameValue: string, password: string) {
  const db = await getDB();
  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  const id = crypto.randomUUID();
  const inserted = await db
    .prepare(
      `INSERT INTO admin (id, username, password_hash, created_at)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM admin)`,
    )
    .bind(id, usernameValue, passwordHash, new Date().toISOString())
    .run();
  if (inserted.meta.changes === 0) {
    throw new Error("admin-exists");
  }
  await syncBetterAuthUser(db, usernameValue, passwordHash);
}

async function ensureBetterAuthUser(db: D1Database) {
  const admin = await db.prepare("SELECT username, password_hash FROM admin LIMIT 1").first<{
    username: string;
    password_hash: string;
  }>();
  if (!admin) return;
  await syncBetterAuthUser(db, admin.username, admin.password_hash);
}

async function syncBetterAuthUser(db: D1Database, usernameValue: string, passwordHash: string) {
  const user = await db
    .prepare('SELECT id FROM "user" WHERE username = ?')
    .bind(usernameValue)
    .first<{ id: string }>();
  if (user) return;
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const email = adminEmail(usernameValue);
  await db
    .prepare(
      'INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "username", "displayUsername") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(userId, usernameValue, email, 1, null, now, now, usernameValue, usernameValue)
    .run();
  await db
    .prepare(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(crypto.randomUUID(), userId, "credential", userId, passwordHash, now, now)
    .run();
}

function authTrustedOrigins(baseURL?: string): string[] | undefined {
  const origins = new Set<string>();
  if (baseURL) origins.add(baseURL.replace(/\/$/, ""));
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins.size ? [...origins] : undefined;
}

export { adminEmail, BCRYPT_ROUNDS };
