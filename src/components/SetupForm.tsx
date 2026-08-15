"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { safeInternalPath } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm({ brandColor }: { brandColor: string }) {
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setPending(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setPending(false);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        data.error === "admin-exists"
          ? "已经有管理员了，请直接登录"
          : data.error === "bad-username"
            ? "用户名只能用字母、数字、点、下划线和短横线"
            : data.error === "password-min-8"
              ? "密码至少 8 位"
              : "创建失败",
      );
      return;
    }
    const { error: err } = await authClient.signIn.username({ username, password });
    setPending(false);
    if (err) {
      setError(err.message || "已创建账号，但登录失败，请再试一次");
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
            <div className="brand-sub">创建管理员</div>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 16 }}>
          第一次使用，先在这里创建管理员。账号存在本站数据库里，不用去 Cloudflare 填密钥。
        </p>
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
          <div className="grid gap-2 mb-3">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2 mb-4">
            <Label htmlFor="confirm">再输一次密码</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "创建中…" : "创建并进入后台"}
          </Button>
        </form>
      </div>
    </div>
  );
}
