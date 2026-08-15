"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PRODUCT_LOGIN_SUBTITLE, PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { safeInternalPath } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ brandColor }: { brandColor: string }) {
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

  return (
    <div className="login-wrap" style={{ ["--brand" as string]: brandColor }}>
      <div className="login-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{PRODUCT_SHORT}</div>
          <div>
            <div className="brand-name">{PRODUCT_NAME}</div>
            <div className="brand-sub">{PRODUCT_LOGIN_SUBTITLE}</div>
          </div>
        </div>
        {error ? <p className="err">{error}</p> : null}

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
      </div>
    </div>
  );
}
