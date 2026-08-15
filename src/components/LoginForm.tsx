"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export function LoginForm({ siteName }: { siteName: string }) {
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
    // Full document navigation avoids OpenNext RSC 500 on login → /admin.
    window.location.assign(search.get("next") || "/admin");
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="logo">{siteName.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="brand-name">{siteName}</div>
            <div className="brand-sub">管理员登录</div>
          </div>
        </div>
        {error ? <p className="err">{error}</p> : null}
        <Field label="用户名">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="密码">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Button variant="primary" wide type="submit" disabled={pending}>
          {pending ? "登录中…" : "登录"}
        </Button>
      </form>
    </div>
  );
}
