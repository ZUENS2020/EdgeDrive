"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { logoGlyph } from "@/lib/types";
import { safeInternalPath } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  siteName,
  subtitle,
  logoText,
  brandColor,
}: {
  siteName: string;
  subtitle: string;
  logoText: string;
  brandColor: string;
}) {
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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

  return (
    <div className="login-wrap" style={{ ["--brand" as string]: brandColor }}>
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{logoGlyph({ site_name: siteName, logo_text: logoText })}</div>
          <div>
            <div className="brand-name">{siteName}</div>
            {subtitle ? <div className="brand-sub">{subtitle}</div> : null}
          </div>
        </div>
        {error ? <p className="err">{error}</p> : null}
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
    </div>
  );
}
