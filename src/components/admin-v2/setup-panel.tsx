"use client";

import { Cloud, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function SetupPanelV2({ tokenRequired }: { tokenRequired: boolean }) {
  const [team, setTeam] = useState("");
  const [aud, setAud] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team, aud, setup_token: token }) });
    if (response.ok) location.reload();
    else { const body = await response.json().catch(() => ({})) as { error?: string }; setError(body.error || "setup-failed"); setBusy(false); }
  };
  return <main className="setup-shell"><section className="setup-card"><div className="setup-brand"><Cloud size={21} /><strong>EDGEDRIVE</strong><span>V2</span></div><p className="eyebrow">FIRST-RUN SECURITY</p><h1>Connect Cloudflare Access</h1><p className="setup-intro">EdgeDrive is fail-closed after setup. Add your Access team domain and application audience to protect every admin request.</p><form onSubmit={(event) => void submit(event)}><label className="field"><span>Team domain</span><input required value={team} onChange={(event) => setTeam(event.target.value)} placeholder="acme.cloudflareaccess.com" /></label><label className="field"><span>Application audience (AUD)</span><input required value={aud} onChange={(event) => setAud(event.target.value)} placeholder="Access application AUD" /></label>{tokenRequired ? <label className="field"><span>Setup token</span><input required type="password" value={token} onChange={(event) => setToken(event.target.value)} /></label> : null}{error ? <p className="form-error">{error}</p> : null}<button className="button primary setup-submit" disabled={busy} type="submit"><ShieldCheck size={16} />{busy ? "Enabling…" : "Enable secure admin"}</button></form><div className="setup-note"><KeyRound size={15} />This operation can only run once.</div></section></main>;
}
