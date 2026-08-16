/**
 * Audit /admin/usage layout at 10 viewports.
 * Fail on clip (overflow:hidden + content taller) or horizontal overflow.
 * Page/card scroll is allowed.
 *
 *   node scripts/shot-usage.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "ui-shots");
const CHROME =
  process.env.CHROME ||
  "/home/zuens2020/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const PW =
  process.env.PLAYWRIGHT_CORE ||
  "/home/zuens2020/.hermes/hermes-agent/node_modules/playwright-core/index.js";

const cssDir = path.join(ROOT, ".next/static/chunks");
const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css"));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${cssFiles.map((f) => `<link rel="stylesheet" href="/css/${f}" />`).join("\n  ")}
</head>
<body>
<div class="admin-root" style="--brand:#171717;flex:1">
  <div class="mobile-bar">
    <button type="button">菜单</button>
    <strong>E</strong>
    <span class="header-sp"></span>
    <span>统计</span>
  </div>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">E</div>
        <div>
          <div class="brand-name">EdgeDrive</div>
          <div class="brand-sub">边缘网盘</div>
        </div>
      </div>
      <nav>
        <a class="nav-item" href="#">文件</a>
        <a class="nav-item active" href="#">统计</a>
        <a class="nav-item" href="#">设置</a>
      </nav>
    </aside>
    <div class="main usage-main">
      <div class="usage-fit">
        <div class="header usage-head">
          <h1>统计</h1>
          <div class="header-sp"></div>
          <div class="filters usage-filters">
            <button class="filter" type="button">24 小时</button>
            <button class="filter" type="button">7 天</button>
            <button class="filter on" type="button">本月</button>
          </div>
        </div>
        <p class="usage-lead">R2 容量与 Class A/B、D1 读写、Worker 调用量来自 Cloudflare GraphQL Analytics。账号 ID 与 Token 在 设置 → 账号里选填。</p>
        <div class="usage-page">
          <div class="usage-hero">
            <div class="usage-hero-card"><span class="k">文件</span><span class="v">128</span></div>
            <div class="usage-hero-card"><span class="k">容量</span><span class="v">3.4 GB</span></div>
            <div class="usage-hero-card"><span class="k">下载总数</span><span class="v">4,210</span></div>
            <div class="usage-hero-card"><span class="k">Worker 请求</span><span class="v">18,402</span></div>
          </div>
          <div class="usage-grid">
            ${card("本站", "D1 里登记的文件与文件夹，不等于账单存储（以 R2 实测为准）。", [
              ["文件", "128"],
              ["文件夹", "12"],
              ["目录合计", "3.1 GB"],
              ["下载次数", "4,210"],
              ["即将过期", "2"],
              ["已过期", "0"],
            ], [
              ["文件", 80],
              ["下载", 100],
              ["文件夹", 20],
              ["即将过期", 8],
            ], true, 0)}
            ${card("R2", "对象容量、Class A（写/列举）与 Class B（读/Head）。删除类操作为免费。", [
              ["对象容量", "3.4 GB"],
              ["对象数", "128"],
              ["元数据", "2.1 MB"],
              ["未完成分片", "0"],
              ["Class A", "12,480"],
              ["Class B", "88,210"],
              ["免费操作", "340"],
              ["其它", "12"],
            ], [
              ["GetObject", 100],
              ["PutObject", 42],
              ["ListObjects", 18],
              ["HeadBucket", 30],
            ], false, 3)}
            ${card("D1", "查询次数、扫描/写入行数、库体积。行数是计费口径，不是结果行数。", [
              ["库体积", "24 MB"],
              ["读查询", "9,201"],
              ["写查询", "640"],
              ["扫描行", "120,000"],
              ["写入行", "3,100"],
              ["查询平均耗时", "1.20 ms"],
            ], [
              ["扫描行", 100],
              ["读查询", 40],
              ["写入行", 18],
              ["写查询", 8],
            ], false, 1)}
            ${card("Worker", "调用次数、错误、子请求，以及 CPU 分位（微秒换算为毫秒）。", [
              ["请求", "18,402"],
              ["错误", "3"],
              ["子请求", "2,110"],
              ["CPU p50", "1.80 ms"],
              ["CPU p99", "12.40 ms"],
            ], [
              ["成功", 100],
              ["客户端断开", 12],
              ["脚本异常", 4],
            ], false, 0)}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

function quotas(n) {
  if (!n) return "";
  const rows = [
    ["容量 / 10 GB 免费档", "3.4 GB / 10 GB", 34],
    ["Class A / 100 万", "12,480 / 1,000,000", 1],
    ["Class B / 1000 万", "88,210 / 10,000,000", 1],
  ]
    .slice(0, n)
    .map(
      ([label, meta, pct]) =>
        `<div class="usage-quota"><div class="usage-quota-meta"><span>${label}</span><span>${meta}</span></div><div class="usage-quota-bar"><i style="width:${pct}%"></i></div></div>`,
    )
    .join("");
  return `<div class="usage-quotas">${rows}</div>`;
}

function card(title, hint, metrics, bars, table, quotaN) {
  const ms = metrics
    .map(([k, v]) => `<div class="usage-metric"><span class="k">${k}</span><span class="v">${v}</span></div>`)
    .join("");
  const bs = bars
    .map(
      ([label, pct]) =>
        `<div class="usage-bar"><span class="usage-bar-label">${label}</span><span class="usage-bar-track"><i style="width:${pct}%"></i></span><span class="usage-bar-n">${pct}</span></div>`,
    )
    .join("");
  const tb = table
    ? `<table class="usage-table"><thead><tr><th>D1 表</th><th>行数</th></tr></thead><tbody>
        <tr><td>files</td><td>128</td></tr>
        <tr><td>folders</td><td>12</td></tr>
        <tr><td>settings</td><td>18</td></tr>
      </tbody></table>`
    : "";
  return `<section class="usage-card">
    <h2>${title}</h2>
    <p class="hint">${hint}</p>
    <div class="usage-metrics">${ms}</div>
    ${quotas(quotaN)}
    <div class="usage-chart" role="img">${bs}</div>
    ${tb}
  </section>`;
}

fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/css/")) {
    const file = path.join(cssDir, path.basename(url.pathname));
    if (fs.existsSync(file)) {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}/`;

const { chromium } = createRequire(import.meta.url)(PW);
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const viewports = [
  { name: "1920x1080", width: 1920, height: 1080, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1366x768", width: 1366, height: 768, mobile: false },
  { name: "1366x600", width: 1366, height: 600, mobile: false },
  { name: "1280x800", width: 1280, height: 800, mobile: false },
  { name: "1280x600", width: 1280, height: 600, mobile: false },
  { name: "1024x768", width: 1024, height: 768, mobile: false },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "375x667", width: 375, height: 667, mobile: true },
];

const report = [];
for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const clipsHidden = (v) => v === "hidden" || v === "clip";
    const canScroll = (v) => v === "auto" || v === "scroll";
    const watch = [
      ".admin-root",
      ".app",
      ".usage-main",
      ".usage-fit",
      ".usage-page",
      ".usage-grid",
      ".usage-card",
      ".usage-chart",
      ".usage-hero",
      ".usage-metrics",
      ".usage-quotas",
    ];
    const clips = [];
    for (const sel of watch) {
      for (const el of document.querySelectorAll(sel)) {
        const st = getComputedStyle(el);
        const yOverflow = el.scrollHeight - el.clientHeight;
        const xOverflow = el.scrollWidth - el.clientWidth;
        const yClip = clipsHidden(st.overflowY) && yOverflow > 2;
        const xClip = clipsHidden(st.overflowX) && xOverflow > 2;
        if (yClip || xClip) {
          clips.push({
            sel,
            title: el.querySelector("h2")?.textContent || "",
            yClip,
            xClip,
            overflowY: st.overflowY,
            overflowX: st.overflowX,
            scrollH: el.scrollHeight,
            clientH: el.clientHeight,
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
          });
        }
      }
    }

    const cards = [...document.querySelectorAll(".usage-card")].map((el) => {
      const st = getComputedStyle(el);
      const last = el.lastElementChild;
      const cr = el.getBoundingClientRect();
      const lr = last ? last.getBoundingClientRect() : cr;
      const lastOutside = last && lr.bottom > cr.bottom + 2;
      const scrollable = canScroll(st.overflowY) || canScroll(getComputedStyle(document.querySelector(".usage-page")).overflowY);
      return {
        title: el.querySelector("h2")?.textContent || "",
        scrollH: el.scrollHeight,
        clientH: Math.round(el.clientHeight),
        overflowY: st.overflowY,
        lastOutside: Boolean(lastOutside),
        lastTag: last?.className || last?.tagName,
        clipped: Boolean(lastOutside) && clipsHidden(st.overflowY) && !scrollable,
      };
    });

    const pageEl = document.querySelector(".usage-page");
    const pageSt = pageEl ? getComputedStyle(pageEl) : null;
    const doc = document.documentElement;
    return {
      inner: [window.innerWidth, window.innerHeight],
      overflowX: doc.scrollWidth > window.innerWidth + 1,
      pageScrollY: pageEl ? pageEl.scrollHeight > pageEl.clientHeight + 2 : false,
      pageDelta: pageEl ? pageEl.scrollHeight - pageEl.clientHeight : 0,
      pageOverflowY: pageSt?.overflowY || "",
      pageCanScroll: pageSt ? canScroll(pageSt.overflowY) : false,
      clips,
      cards,
      cardClip: cards.some((c) => c.clipped),
    };
  });
  const file = path.join(OUT, `usage-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  if (metrics.pageScrollY) {
    const fileFull = path.join(OUT, `usage-${vp.name}-scrolled.png`);
    await page.evaluate(() => {
      const el = document.querySelector(".usage-page");
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.screenshot({ path: fileFull, fullPage: false });
  }
  report.push({ ...vp, file, metrics });
  await page.close();
}

await browser.close();
server.close();

const summary = report.map((r) => ({
  name: r.name,
  size: `${r.width}x${r.height}`,
  overflowX: r.metrics.overflowX,
  pageScrollY: r.metrics.pageScrollY,
  pageDelta: r.metrics.pageDelta,
  pageCanScroll: r.metrics.pageCanScroll,
  clipCount: r.metrics.clips.length,
  clips: r.metrics.clips,
  cardClip: r.metrics.cardClip,
  cards: r.metrics.cards,
  file: r.file,
}));
fs.writeFileSync(path.join(OUT, "usage-shot-report.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
const bad = summary.filter((s) => s.overflowX || s.clipCount > 0 || s.cardClip || (s.pageScrollY && !s.pageCanScroll));
if (bad.length) {
  console.error(
    "FAIL",
    bad.map((b) => `${b.name} x=${b.overflowX} clips=${b.clipCount} cardClip=${b.cardClip} scroll=${b.pageScrollY}/${b.pageCanScroll}`).join(" | "),
  );
  process.exit(1);
}
console.log("OK all viewports: no clip, no overflowX; page scroll allowed");
