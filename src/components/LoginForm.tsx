"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { logoGlyph } from "@/lib/types";
import type { AuthMode, OAuthProviderId } from "@/lib/types";
import { safeInternalPath } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OAUTH_LABEL: Record<OAuthProviderId, string> = {
  github: "使用 GitHub 登录",
  google: "使用 Google 登录",
};

export function LoginForm({
  siteName,
  subtitle,
  logoText,
  brandColor,
  mode,
  oauthProviders,
}: {
  siteName: string;
  subtitle: string;
  logoText: string;
  brandColor: string;
  mode: AuthMode;
  oauthProviders: OAuthProviderId[];
}) {
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(search.get("error") ? "登录被拒绝或已取消" : "");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const { error: err } = await authClient.signIn.username({
      username,
      password,
    });
    setPending(false);
    if (err) {
      setError(err.message || "登录失败");
      return;
    }
    window.location.assign(safeInternalPath(search.get("next")));
  }

  async function onOauth(provider: OAuthProviderId) {
    setError("");
    setPending(true);
    const { error: err } = await authClient.signIn.social({
      provider,
      callbackURL: safeInternalPath(search.get("next")),
      errorCallbackURL: "/login",
    });
    setPending(false);
    if (err) setError(err.message || "登录失败");
  }

  return (
    <div className="login-wrap" style={{ ["--brand" as string]: brandColor }}>
      <div className="login-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{logoGlyph({ site_name: siteName, logo_text: logoText })}</div>
          <div>
            <div className="brand-name">{siteName}</div>
            {subtitle ? <div className="brand-sub">{subtitle}</div> : null}
          </div>
        </div>
        {error ? <p className="err">{error}</p> : null}

        {mode === "password" ? (
          <form onSubmit={onSubmit}>
            <div className="grid gap-2 mb-3">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="grid gap-2 mb-4">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "登录中…" : "登录"}
            </Button>
          </form>
        ) : null}

        {mode === "oauth" ? (
          oauthProviders.length ? (
            <div className="grid gap-2">
              {oauthProviders.map((id) => (
                <Button
                  key={id}
                  className="w-full"
                  type="button"
                  variant={oauthProviders.length > 1 ? "outline" : "default"}
                  disabled={pending}
                  onClick={() => onOauth(id)}
                >
                  {OAUTH_LABEL[id]}
                </Button>
              ))}
            </div>
          ) : (
            <p className="err">未配置 GitHub / Google。请设置对应的 CLIENT_ID 与 CLIENT_SECRET。</p>
          )
        ) : null}
      </div>
    </div>
  );
}
