"use client";

import { formatSize } from "@/lib/format";
import type { StatsPayload } from "@/lib/types";

export function StatsPanel({ stats }: { stats: StatsPayload | null }) {
  return (
    <div className="stats">
      <div className="stat">
        <span className="k">文件</span>
        <span className="v">{stats ? stats.fileCount : "—"}</span>
      </div>
      <div className="stat">
        <span className="k">容量</span>
        <span className="v">{stats ? formatSize(stats.totalSize) : "—"}</span>
      </div>
      <div className="stat">
        <span className="k">下载</span>
        <span className="v">{stats ? stats.downloadTotal : "—"}</span>
      </div>
      <div className="stat">
        <span className="k">即将过期</span>
        <span className={`v ${stats && stats.soonCount ? "warn" : ""}`}>
          {stats ? stats.soonCount : "—"}
        </span>
      </div>
      <div className="stat">
        <span className="k">已过期</span>
        <span className={`v ${stats && stats.expiredCount ? "bad" : ""}`}>
          {stats ? stats.expiredCount : "—"}
        </span>
      </div>
      {stats && stats.soon.length > 0 && (
        <div className="soon-list">
          {stats.soon.map((f) => (
            <a key={f.id} href={f.url} title={f.key}>
              {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
