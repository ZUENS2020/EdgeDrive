import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { compare, hash } from "bcryptjs";
import {
  envString,
  getCfEnv,
  listOAuthProviders,
  readAuthMode,
} from "./cloudflare";
import { getSettings, parseEmailList } from "./settings";

const BCRYPT_ROUNDS = 10;

function adminEmail(usernameValue: string) {
  return `${usernameValue.toLowerCase()}@admin.local`;
}

async function oauthEmailAllowed(email: string, env: CloudflareEnv): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  let fromSettings: string[] = [];
  try {
    const settings = await getSettings(env.DB);
    fromSettings = parseEmailList(settings.oauth_allow_emails);
  } catch {
    fromSettings = [];
  }
  const fromEnv = parseEmailList(envString(env, "OAUTH_ALLOW_EMAILS"));
  const allow = new Set([...fromSettings, ...fromEnv]);
  if (allow.size) return allow.has(normalized);
  const count = await env.DB.prepare('SELECT COUNT(*) as n FROM "user"').first<{ n: number }>();
  return (count?.n || 0) === 0;
}

export async function createAuth() {
  const env = await getCfEnv();
  const mode = readAuthMode(env);
  if (mode === "access") {
    throw new Error("createAuth is not used when AUTH_MODE=access");
  }
  const secret =
    envString(env, "BETTER_AUTH_SECRET") ||
    (process.env.NODE_ENV !== "production" ? "dev-only-change-me-use-32-chars-min" : "");
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required when AUTH_MODE is password or oauth");
  }
  const baseURL = envString(env, "BETTER_AUTH_URL") || process.env.BETTER_AUTH_URL;

  if (mode === "password") await ensureAdmin(env);

  const providers = listOAuthProviders(env);
  const socialProviders: {
    github?: { clientId: string; clientSecret: string; scope?: string[] };
    google?: { clientId: string; clientSecret: string };
  } = {};
  if (mode === "oauth") {
    if (providers.includes("github")) {
      socialProviders.github = {
        clientId: envString(env, "GITHUB_CLIENT_ID")!,
        clientSecret: envString(env, "GITHUB_CLIENT_SECRET")!,
        scope: ["read:user", "user:email"],
      };
    }
    if (providers.includes("google")) {
      socialProviders.google = {
        clientId: envString(env, "GOOGLE_CLIENT_ID")!,
        clientSecret: envString(env, "GOOGLE_CLIENT_SECRET")!,
      };
    }
  }

  return betterAuth({
    secret,
    baseURL,
    database: env.DB,
    emailAndPassword: {
      enabled: mode === "password",
      disableSignUp: true,
      minPasswordLength: mode === "password" ? 1 : 8,
      password: {
        hash: (password) => hash(password, BCRYPT_ROUNDS),
        verify: ({ hash: hashed, password }) => compare(password, hashed),
      },
    },
    socialProviders: mode === "oauth" ? socialProviders : undefined,
    plugins: [
      ...(mode === "password"
        ? [
            username({
              minUsernameLength: 1,
              maxUsernameLength: 64,
              usernameValidator: (value) => /^[a-zA-Z0-9._-]+$/.test(value),
            }),
          ]
        : []),
      nextCookies(),
    ],
    trustedOrigins: authTrustedOrigins(baseURL),
    databaseHooks:
      mode === "oauth"
        ? {
            user: {
              create: {
                before: async (user) => {
                  if (!(await oauthEmailAllowed(user.email, env))) return false;
                  const existing = await env.DB.prepare('SELECT COUNT(*) as n FROM "user"').first<{
                    n: number;
                  }>();
                  if ((existing?.n || 0) > 0) return false;
                },
              },
            },
          }
        : undefined,
    onAPIError: {
      errorURL: "/login",
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["github", "google"],
      },
    },
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
  if (readAuthMode(cf) !== "password") return;
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

export { adminEmail, BCRYPT_ROUNDS };
