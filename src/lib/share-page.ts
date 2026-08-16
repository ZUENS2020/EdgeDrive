import { DEFAULT_LOCALE, htmlLang, parseLocale, t, type Locale } from "./i18n";
import { PRODUCT_NAME, PRODUCT_SHORT } from "./product";
import { escapeHtml } from "./sanitize";
import type { PublicThemeVars } from "./themes";

export type PasswordPageState = "form" | "wrong" | "locked" | "gone" | "missing";

export type RenderPasswordPageOpts = {
  token: string;
  next: string;
  theme: PublicThemeVars;
  locale?: Locale;
  state?: PasswordPageState;
  minutes?: number;
};

function css(theme: PublicThemeVars): string {
  return `:root { --brand:${escapeHtml(theme.brand)}; --bg:${escapeHtml(theme.bg)}; --text:${escapeHtml(theme.text)}; --text-3:${escapeHtml(theme.text3)}; --surface:${escapeHtml(theme.surface)}; --line:${escapeHtml(theme.line)}; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:16px/1.5 "Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif; }
    .wrap { max-width:420px; margin:0 auto; padding:48px 20px 64px; }
    .brand { display:flex; gap:10px; align-items:center; margin-bottom:24px; }
    .logo { min-width:28px; height:28px; padding:0 6px; border-radius:6px; background:var(--brand); color:#fff; display:grid; place-items:center; font-weight:600; font-size:10px; letter-spacing:.06em; }
    h1 { font-size:22px; font-weight:600; letter-spacing:-.03em; margin:0 0 8px; }
    .meta { color:var(--text-3); font-size:14px; margin:0 0 20px; }
    .banner { margin:0 0 16px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--text-3); font-size:13px; }
    .banner.err { color:var(--text); border-color:color-mix(in srgb, var(--brand) 40%, var(--line)); }
    form { display:flex; flex-direction:column; gap:12px; }
    label { font-size:13px; color:var(--text-3); }
    input[type=password] { height:40px; padding:0 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--text); font:inherit; }
    button.btn { display:inline-flex; align-items:center; justify-content:center; height:40px; padding:0 14px; background:var(--brand); color:#fff; border:0; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--text-3); font-size:13px; }
    @media (max-width:640px) { .wrap { padding:24px 14px 48px; } }`;
}

export function renderPasswordPage(opts: RenderPasswordPageOpts): string {
  const locale = parseLocale(opts.locale ?? DEFAULT_LOCALE);
  const state = opts.state ?? "form";
  const gone = state === "gone";
  let banner = "";
  if (state === "wrong") banner = t(locale, "passwordPage.wrong");
  else if (state === "locked") banner = t(locale, "passwordPage.locked", { minutes: opts.minutes ?? 10 });
  else if (state === "missing") banner = t(locale, "passwordPage.missing");
  else if (state === "gone") banner = t(locale, "passwordPage.gone");

  const form = gone
    ? ""
    : `<form method="post" action="/api/share/${encodeURIComponent(opts.token)}/verify">
      <input type="hidden" name="next" value="${escapeHtml(opts.next)}">
      <label for="ed-pw">${escapeHtml(t(locale, "passwordPage.label"))}</label>
      <input id="ed-pw" type="password" name="password" autocomplete="current-password" required>
      <button class="btn" type="submit">${escapeHtml(t(locale, "passwordPage.submit"))}</button>
    </form>`;

  return `<!doctype html>
<html lang="${htmlLang(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t(locale, "passwordPage.title"))} · ${escapeHtml(PRODUCT_NAME)}</title>
  <style>${css(opts.theme)}</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">${escapeHtml(PRODUCT_SHORT)}</div>
      <div>${escapeHtml(PRODUCT_NAME)}</div>
    </div>
    <h1>${escapeHtml(t(locale, gone ? "passwordPage.gone" : "passwordPage.title"))}</h1>
    <p class="meta">${escapeHtml(t(locale, "passwordPage.body"))}</p>
    ${banner ? `<p class="banner${state === "form" ? "" : " err"}">${escapeHtml(banner)}</p>` : ""}
    ${form}
    <div class="footer">${escapeHtml(PRODUCT_NAME)} · ${escapeHtml(t(locale, "product.tagline"))}</div>
  </div>
</body>
</html>`;
}
