import { fileExpiryLabel, formatSize, formatTime, isInlineSafe, previewKind, type PreviewKind } from "./format";
import { DEFAULT_LOCALE, htmlLang, parseLocale, t, type Locale } from "./i18n";
import { PRODUCT_NAME, PRODUCT_SHORT } from "./product";
import { escapeHtml } from "./sanitize";
import type { PublicThemeVars } from "./themes";
import type { FileRow } from "./types";

export const TEXT_PREVIEW_MAX_BYTES = 512 * 1024;

export { isInlineSafe, previewKind };

const CDN = {
  marked: "https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js",
  purify: "https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js",
  mermaid: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
  hljs: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js",
  hljsLight: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css",
  hljsDark: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css",
};

export type RenderViewPageOpts = {
  origin: string;
  key: string;
  meta: FileRow;
  theme?: PublicThemeVars;
  locale?: Locale;
};

function dlPath(origin: string, key: string): string {
  return `${origin.replace(/\/$/, "")}/dl/${key.split("/").map(encodeURIComponent).join("/")}`;
}

const VIEW_CSS = `* { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:16px/1.5 "Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif; }
    .wrap { max-width:880px; margin:0 auto; padding:40px 20px 64px; }
    .brand { display:flex; gap:10px; align-items:center; margin-bottom:20px; }
    .logo { min-width:28px; height:28px; padding:0 6px; border-radius:6px; background:var(--brand); color:#fff; display:grid; place-items:center; font-weight:600; font-size:10px; letter-spacing:.06em; }
    h1 { font-size:22px; font-weight:600; letter-spacing:-.03em; margin:0 0 12px; word-break:break-all; }
    .info { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px 16px; margin:0 0 16px; padding:12px 14px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
    .info dt { color:var(--text-3); font-size:11px; letter-spacing:.04em; text-transform:uppercase; margin:0 0 2px; }
    .info dd { margin:0; font-size:13px; word-break:break-all; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 20px; }
    a.btn, button.btn { display:inline-flex; align-items:center; justify-content:center; height:32px; padding:0 12px; background:var(--brand); color:#fff; text-decoration:none; border:0; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; }
    a.btn.ghost, button.btn.ghost { background:transparent; color:var(--text); border:1px solid var(--line); }
    .preview-media { max-width:100%; width:100%; height:auto; border:1px solid var(--line); border-radius:8px; background:var(--surface); margin:0 0 20px; display:block; }
    img.preview-media { cursor:zoom-in; }
    audio.preview-media { height:40px; }
    .preview-frame { max-width:100%; max-height:70vh; overflow:auto; border:1px solid var(--line); border-radius:8px; background:var(--surface); margin:0 0 20px; }
    .preview-frame.pdf-frame { padding:0; }
    .preview-frame iframe.pdf { width:100%; height:70vh; border:0; display:block; background:var(--surface); }
    .preview-frame .txt { margin:0; padding:16px 18px; white-space:pre-wrap; word-break:break-word; font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .preview-frame .md { padding:16px 20px; }
    .preview-frame .md :first-child { margin-top:0; }
    .preview-frame .md :last-child { margin-bottom:0; }
    .preview-frame .md pre { overflow:auto; padding:12px; border-radius:6px; background:color-mix(in srgb, var(--text) 8%, var(--surface)); }
    .preview-frame .md code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
    .preview-frame .md img { max-width:100%; }
    .preview-frame .md table { border-collapse:collapse; width:100%; }
    .preview-frame .md th, .preview-frame .md td { border:1px solid var(--line); padding:6px 8px; }
    .preview-frame .md .mermaid { margin:12px 0; text-align:center; overflow:auto; }
    .hint { color:var(--text-3); font-size:13px; margin:0 0 20px; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
    .footer a { color:var(--text-3); text-decoration:none; font-size:13px; }
    .footer a:hover { color:var(--brand); }
    .lightbox { position:fixed; inset:0; background:rgba(0,0,0,.88); display:none; z-index:50; align-items:center; justify-content:center; }
    .lightbox.open { display:flex; }
    .lightbox img { max-width:92vw; max-height:82vh; transform:rotate(var(--rot,0deg)) scale(var(--zoom,1)); transition:transform .15s ease; }
    .lightbox .tools { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:8px; }
    @media (max-width:640px) {
      .wrap { padding:24px 14px 48px; }
      .preview-media, video.preview-media, img.preview-media { width:100%; }
      .preview-frame iframe.pdf { height:60vh; }
      .actions { flex-direction:column; }
      a.btn, button.btn { width:100%; }
    }`;

function embedHtml(kind: PreviewKind, inline: string, name: string, locale: Locale): string {
  const src = escapeHtml(inline);
  const alt = escapeHtml(name);
  if (kind === "img") {
    return `<img class="preview-media" id="ed-img" src="${src}" alt="${alt}">
<div class="lightbox" id="ed-box">
  <img id="ed-box-img" alt="${alt}">
  <div class="tools">
    <button type="button" class="btn ghost" data-lb="zoom-out">${escapeHtml(t(locale, "viewPage.zoomOut"))}</button>
    <button type="button" class="btn ghost" data-lb="zoom-in">${escapeHtml(t(locale, "viewPage.zoomIn"))}</button>
    <button type="button" class="btn ghost" data-lb="rot">${escapeHtml(t(locale, "viewPage.rotate"))}</button>
    <button type="button" class="btn" data-lb="close">${escapeHtml(t(locale, "viewPage.close"))}</button>
  </div>
</div>`;
  }
  if (kind === "vid") {
    return `<video class="preview-media" controls playsinline preload="metadata" src="${src}"></video>`;
  }
  if (kind === "audio") {
    return `<audio class="preview-media" controls preload="metadata" src="${src}"></audio>`;
  }
  if (kind === "pdf") {
    return `<div class="preview-frame pdf-frame"><iframe class="pdf" src="${src}" title="${alt}"></iframe></div>`;
  }
  if (kind === "md") {
    return `<div class="preview-frame" id="ed-md"><p class="hint" style="padding:16px">${escapeHtml(t(locale, "viewPage.renderingMd"))}</p></div>`;
  }
  if (kind === "txt") {
    return `<div class="preview-frame" id="ed-txt"><p class="hint" style="padding:16px">${escapeHtml(t(locale, "viewPage.loadingText"))}</p></div>`;
  }
  return `<p class="hint">${escapeHtml(t(locale, "viewPage.unsupported"))}</p>`;
}

function infoRow(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

export type ViewPageClientMessages = {
  copied: string;
  copyFailed: string;
  truncated: string;
  loadFailed: string;
};

export function viewPageClientMessages(locale: Locale = DEFAULT_LOCALE): ViewPageClientMessages {
  return {
    copied: t(locale, "viewPage.copied"),
    copyFailed: t(locale, "viewPage.copyFailed"),
    truncated: t(locale, "viewPage.truncated"),
    loadFailed: t(locale, "viewPage.loadFailed"),
  };
}

/** Client script for copy / lightbox / markdown. Kept as a plain string (no TS template holes except MAX). */
export function viewPageClientJs(messages: ViewPageClientMessages = viewPageClientMessages()): string {
  const copied = JSON.stringify(messages.copied);
  const copyFailed = JSON.stringify(messages.copyFailed);
  const truncated = JSON.stringify(messages.truncated);
  const loadFailed = JSON.stringify(messages.loadFailed);
  return [
    "(function(){",
    "  var cfg = window.__ED_VIEW || {};",
    "  var MAX = " + String(TEXT_PREVIEW_MAX_BYTES) + ";",
    "  function toast(msg){",
    '    var n = document.getElementById("ed-toast");',
    '    if(!n){ n=document.createElement("div"); n.id="ed-toast"; n.style.cssText="position:fixed;bottom:24px;right:20px;background:var(--brand);color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;z-index:60"; document.body.appendChild(n); }',
    '    n.textContent=msg; n.style.display="block";',
    '    clearTimeout(n._t); n._t=setTimeout(function(){ n.style.display="none"; },1600);',
    "  }",
    "  function copy(text){",
    "    function fallback(){",
    '      var ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select();',
    "      try{ document.execCommand(\"copy\"); toast(" +
      copied +
      "); }catch(e){ toast(" +
      copyFailed +
      "); }",
    "      ta.remove();",
    "    }",
    "    if(navigator.clipboard && navigator.clipboard.writeText){",
    "      return navigator.clipboard.writeText(text).then(function(){ toast(" +
      copied +
      "); }).catch(fallback);",
    "    }",
    "    return fallback();",
    "  }",
    '  document.querySelectorAll("[data-copy]").forEach(function(btn){',
    '    btn.addEventListener("click", function(){ copy(btn.getAttribute("data-copy") || location.href); });',
    "  });",
    '  var img = document.getElementById("ed-img");',
    '  var box = document.getElementById("ed-box");',
    '  var boxImg = document.getElementById("ed-box-img");',
    "  if(img && box && boxImg){",
    "    var zoom=1, rot=0;",
    '    function apply(){ boxImg.style.setProperty("--zoom", String(zoom)); boxImg.style.setProperty("--rot", rot+"deg"); }',
    '    function openBox(){ boxImg.src=img.getAttribute("src")||""; box.classList.add("open"); zoom=1; rot=0; apply(); }',
    '    function closeBox(){ box.classList.remove("open"); }',
    '    img.addEventListener("click", openBox);',
    '    box.addEventListener("click", function(e){ if(e.target===box) closeBox(); });',
    '    document.addEventListener("keydown", function(e){ if(e.key==="Escape") closeBox(); });',
    '    box.querySelectorAll("[data-lb]").forEach(function(btn){',
    '      btn.addEventListener("click", function(e){',
    "        e.stopPropagation();",
    '        var a=btn.getAttribute("data-lb");',
    '        if(a==="close") closeBox();',
    '        else if(a==="zoom-in"){ zoom=Math.min(4, +(zoom+0.25).toFixed(2)); apply(); }',
    '        else if(a==="zoom-out"){ zoom=Math.max(0.25, +(zoom-0.25).toFixed(2)); apply(); }',
    "        else if(a===\"rot\"){ rot=(rot+90)%360; apply(); }",
    "      });",
    "    });",
    "  }",
    "  function esc(s){ return String(s).replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\"); }",
    "  function extractMermaid(src){",
    "    var blocks=[];",
    "    var md=String(src).replace(/```mermaid\\\\s*\\\\n([\\\\s\\\\S]*?)```/g, function(_m, code){",
    "      var i=blocks.length; blocks.push(code);",
    '      return "\\n\\nEDMERMAIDPLACEHOLDER"+i+"ENDPLACEHOLDER\\n\\n";',
    "    });",
    "    return {md:md, blocks:blocks};",
    "  }",
    "  function renderMarkdown(el, src, sliced){",
    "    var extracted = extractMermaid(src);",
    "    var parsed = extracted.md;",
    "    if(window.marked) parsed = window.marked.parse(extracted.md, {breaks:true,gfm:true});",
    "    if(window.DOMPurify) parsed = window.DOMPurify.sanitize(parsed, {USE_PROFILES:{html:true}});",
    "    extracted.blocks.forEach(function(code, i){",
    '      var token = "EDMERMAIDPLACEHOLDER"+i+"ENDPLACEHOLDER";',
    '      var div = \'<div class="mermaid">\'+esc(code)+"</div>";',
    "      parsed = parsed.replace(new RegExp(\"<p>\\\\s*\"+token+\"\\\\s*</p>\",\"g\"), div);",
    "      parsed = parsed.split(token).join(div);",
    "    });",
    '    el.innerHTML = \'<div class="md">\'+parsed+"</div>";',
    "    if(sliced){",
    '      var p=document.createElement("p"); p.className="hint";',
    "      p.textContent=" + truncated + '.replace("{kb}", String(Math.round(MAX/1024)));',
    "      el.appendChild(p);",
    "    }",
    "    if(window.hljs){ el.querySelectorAll(\"pre code\").forEach(function(node){ window.hljs.highlightElement(node); }); }",
    "    if(window.mermaid && extracted.blocks.length){",
    '      window.mermaid.run({ querySelector: ".preview-frame .mermaid" }).catch(function(){});',
    "    }",
    "  }",
    "  function loadText(kind){",
    '    var el = document.getElementById(kind==="md" ? "ed-md" : "ed-txt");',
    "    if(!el || !cfg.inline) return;",
    "    fetch(cfg.inline).then(function(res){",
    '      if(!res.ok) throw new Error("load-failed");',
    "      return res.arrayBuffer();",
    "    }).then(function(buf){",
    "      var sliced = buf.byteLength > MAX;",
    "      var view = sliced ? buf.slice(0, MAX) : buf;",
    '      var text = new TextDecoder("utf-8").decode(view);',
    '      if(kind==="txt"){',
    '        el.innerHTML = "";',
    '        var pre=document.createElement("pre"); pre.className="txt"; pre.textContent=text;',
    "        el.appendChild(pre);",
    "        if(sliced){",
    '          var note=document.createElement("p"); note.className="hint"; note.style.padding="0 18px 16px";',
    "          note.textContent=" + truncated + '.replace("{kb}", String(Math.round(MAX/1024)));',
    "          el.appendChild(note);",
    "        }",
    "        return;",
    "      }",
    "      renderMarkdown(el, text, sliced);",
    "    }).catch(function(){",
    '      el.innerHTML = "";',
    '      var p=document.createElement("p"); p.className="hint"; p.style.padding="16px";',
    "      p.textContent=" + loadFailed + ";",
    "      el.appendChild(p);",
    "    });",
    "  }",
    "  function boot(){",
    '    if(cfg.kind==="md" && window.mermaid){',
    "      window.mermaid.initialize({startOnLoad:false, theme: cfg.dark ? \"dark\" : \"default\", securityLevel:\"strict\"});",
    "    }",
    '    if(cfg.kind==="md") loadText("md");',
    '    if(cfg.kind==="txt") loadText("txt");',
    "  }",
    '  function libsReady(){ return !!(window.marked && window.DOMPurify && window.mermaid && window.hljs); }',
    "  function wait(){",
    '    if(cfg.kind!=="md"){ boot(); return; }',
    "    var n=0;",
    "    (function tick(){ if(libsReady() || n>80) boot(); else { n+=1; setTimeout(tick, 50); } })();",
    "  }",
    '  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", wait);',
    "  else wait();",
    "})();",
  ].join("\n");
}

export function extractMermaidBlocks(src: string): { markdown: string; blocks: string[] } {
  const blocks: string[] = [];
  const markdown = src.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_full: string, code: string) => {
    const i = blocks.length;
    blocks.push(String(code));
    return `\n\nEDMERMAIDPLACEHOLDER${i}ENDPLACEHOLDER\n\n`;
  });
  return { markdown, blocks };
}

export function renderViewPage(opts: RenderViewPageOpts): string {
  const locale = parseLocale(opts.locale);
  const origin = opts.origin.replace(/\/$/, "");
  const dl = dlPath(origin, opts.key);
  const inline = `${dl}?inline=1`;
  const kind = previewKind(opts.meta.name, opts.meta.mime);
  const theme = opts.theme;
  const dark = theme?.dark ?? true;
  const status = fileExpiryLabel(opts.meta.expires, Date.now(), locale);
  const mimeLabel = opts.meta.mime || kind || "application/octet-stream";
  const embed = embedHtml(kind, inline, opts.meta.name, locale);
  const needsMd = kind === "md";
  const payload = JSON.stringify({ inline, kind, dark }).replace(/</g, "\\u003c");

  const extraHead = needsMd
    ? [
        `<link rel="stylesheet" href="${escapeHtml(dark ? CDN.hljsDark : CDN.hljsLight)}">`,
        `<script src="${escapeHtml(CDN.marked)}" defer></script>`,
        `<script src="${escapeHtml(CDN.purify)}" defer></script>`,
        `<script src="${escapeHtml(CDN.mermaid)}" defer></script>`,
        `<script src="${escapeHtml(CDN.hljs)}" defer></script>`,
      ].join("\n  ")
    : "";

  return `<!doctype html>
<html lang="${htmlLang(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.meta.name)} · ${escapeHtml(PRODUCT_NAME)}</title>
  <style>
    :root { --brand:${escapeHtml(theme?.brand ?? "#171717")}; --bg:${escapeHtml(theme?.bg ?? "#f6f5f2")}; --text:${escapeHtml(theme?.text ?? "#171717")}; --text-3:${escapeHtml(theme?.text3 ?? "#737373")}; --surface:${escapeHtml(theme?.surface ?? "#fff")}; --line:${escapeHtml(theme?.line ?? "rgba(23,23,23,.1)")}; }
    ${VIEW_CSS}
  </style>
  ${extraHead}
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">${escapeHtml(PRODUCT_SHORT)}</div>
      <div>${escapeHtml(PRODUCT_NAME)}</div>
    </div>
    <h1>${escapeHtml(opts.meta.name)}</h1>
    <dl class="info">
      ${infoRow(t(locale, "viewPage.filename"), opts.meta.name)}
      ${infoRow(t(locale, "viewPage.size"), formatSize(opts.meta.size))}
      ${infoRow(t(locale, "viewPage.type"), mimeLabel)}
      ${infoRow(t(locale, "viewPage.uploaded"), formatTime(opts.meta.created_at))}
      ${infoRow(t(locale, "viewPage.expires"), status)}
      ${opts.meta.path ? infoRow(t(locale, "viewPage.path"), opts.meta.path) : ""}
    </dl>
    ${embed}
    <div class="actions">
      <a class="btn" href="${escapeHtml(dl)}">${escapeHtml(t(locale, "viewPage.download"))}</a>
      <button type="button" class="btn ghost" data-copy="${escapeHtml(dl)}">${escapeHtml(t(locale, "viewPage.copyDl"))}</button>
      <button type="button" class="btn ghost" data-copy="${escapeHtml(`${dl}/view`)}">${escapeHtml(t(locale, "viewPage.copyView"))}</button>
    </div>
    <div class="footer">
      <span style="color:var(--text-3);font-size:13px">${escapeHtml(PRODUCT_NAME)} · ${escapeHtml(t(locale, "product.tagline"))}</span>
      <a href="https://github.com/ZUENS2020/EdgeDrive" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
  <script>window.__ED_VIEW=${payload};</script>
  <script>${viewPageClientJs(viewPageClientMessages(locale))}</script>
</body>
</html>`;
}
