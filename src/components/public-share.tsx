import { Download, File, FolderArchive, LockKeyhole, ShieldCheck } from "lucide-react";
import type { PublicShare } from "@/server/v2/shares";
import { PublicPreview } from "./public-preview-client";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const unit = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

function canEmbed(name: string, mime: string | null): boolean {
  return Boolean(mime && /^(image|audio|video)\//.test(mime)) || mime === "application/pdf" || Boolean(mime?.startsWith("text/")) || /\.(md|txt|log|json|csv|ya?ml|toml)$/i.test(name);
}

export function PublicShareView({ share, unlocked }: { share: PublicShare; unlocked: boolean }) {
  if (share.status !== "active") {
    return <PublicShareState title="This link is no longer available" detail="It may have expired, been revoked, or reached its download limit." />;
  }
  if (share.hasPassword && !unlocked) {
    return (
      <main className="public-shell public-unlock">
        <div className="public-mark"><LockKeyhole size={20} /></div>
        <p className="eyebrow">Protected transfer</p>
        <h1>Enter the access key</h1>
        <p className="public-muted">This link is encrypted with a share password.</p>
        <form className="unlock-form" action={`/unlock/${encodeURIComponent(share.code)}`} method="post">
          <input name="password" type="password" required autoComplete="current-password" placeholder="Access key" aria-label="Access key" />
          <input name="next" type="hidden" value={`/${share.mode === "preview" ? "p" : "s"}/${share.code}`} />
          <button type="submit">Unlock</button>
        </form>
        <div className="trust-line"><ShieldCheck size={15} /> Password attempts are rate-limited</div>
      </main>
    );
  }

  const primary = share.files[0];
  const previewable = share.mode === "preview" && share.allowPreview && primary && canEmbed(primary.name, primary.mime);
  return (
    <main className="public-shell public-transfer">
      <header className="public-header">
        <a className="public-brand" href="/">EDGEDRIVE <span>TRANSFER</span></a>
        <div className="trust-line"><ShieldCheck size={15} /> Private, expiring access</div>
      </header>
      {previewable ? (
        <section className="preview-stage" aria-label={`Preview ${primary.name}`}>
          <PublicPreview file={primary} />
        </section>
      ) : null}
      <section className="transfer-panel">
        <div className="transfer-title">
          <div className="public-file-icon">{share.kind === "batch" ? <FolderArchive size={22} /> : <File size={22} />}</div>
          <div>
            <p className="eyebrow">{share.kind === "batch" ? `${share.files.length} files` : "Shared file"}</p>
            <h1>{share.kind === "batch" ? "File collection" : primary?.name}</h1>
          </div>
          {share.expiresAt ? <span className="expiry-note">Expires {new Date(share.expiresAt).toLocaleDateString()}</span> : null}
        </div>
        <div className="transfer-list">
          {share.files.map((file) => (
            <div className="transfer-row" key={file.id}>
              <File size={18} />
              <div><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
              {share.allowDownload ? <a className="icon-action" href={file.downloadUrl} aria-label={`Download ${file.name}`}><Download size={18} /></a> : null}
            </div>
          ))}
        </div>
        {share.allowDownload && share.files.length === 1 ? <a className="public-primary" href={primary?.downloadUrl}><Download size={17} /> Download file</a> : null}
      </section>
    </main>
  );
}

export function PublicShareState({ title, detail }: { title: string; detail: string }) {
  return <main className="public-shell public-unlock"><div className="public-mark"><File size={20} /></div><h1>{title}</h1><p className="public-muted">{detail}</p></main>;
}
