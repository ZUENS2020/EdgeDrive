import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { compare, hash } from "bcryptjs";
import { envString, getCfEnv, readAuthMode } from "./cloudflare";

const BCRYPT_ROUNDS = 10;

function adminEmail(usernameValue: string) {
  return `${usernameValue.toLowerCase()}@admin.local`;
}

export async function createAuth() {
  const env = await getCfEnv();
  const secret =
    envString(env, "BETTER_AUTH_SECRET") ||
    (process.env.NODE_ENV !== "production" ? "dev-only-change-me-use-32-chars-min" : "");
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required when AUTH_MODE=better-auth");
  }
  const baseURL = envString(env, "BETTER_AUTH_URL") || process.env.BETTER_AUTH_URL;

  await ensureAdmin(env);

  return betterAuth({
    secret,
    baseURL,
    database: env.DB,
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
        usernameValidator: (value) => /^[a-zA-Z0-9._-]+$/.test(value),
      }),
      nextCookies(),
    ],
    trustedOrigins: authTrustedOrigins(baseURL),
    advanced: {
      csrf: { enabled: process.env.NODE_ENV === "development" ? false : true },
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
  });
}

export async function ensureAdmin(env?: CloudflareEnv) {
  const cf = env ?? (await getCfEnv());
  if (readAuthMode(cf) === "none") return;
  const db = cf.DB;
  if (!db) return;

  const existing = await db.prepare("SELECT * FROM admin LIMIT 1").first<{
    id: string;
    username: string;
    password_hash: string;
  }>();

  let admin = existing;
  if (!admin) {
    const usernameValue = envString(cf, "ADMIN_USERNAME");
    const password = envString(cf, "ADMIN_PASSWORD");
    if (!usernameValue || !password) {
      throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required to seed the first admin");
    }
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO admin (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, usernameValue, passwordHash, new Date().toISOString())
      .run();
    admin = { id, username: usernameValue, password_hash: passwordHash };
  }

  const user = await db
    .prepare('SELECT id FROM "user" WHERE username = ?')
    .bind(admin.username)
    .first<{ id: string }>();
  if (user) return;

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const email = adminEmail(admin.username);
  await db
    .prepare(
      'INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "username", "displayUsername") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(userId, admin.username, email, 1, null, now, now, admin.username, admin.username)
    .run();
  await db
    .prepare(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(crypto.randomUUID(), userId, "credential", userId, admin.password_hash, now, now)
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

export { adminEmail };
