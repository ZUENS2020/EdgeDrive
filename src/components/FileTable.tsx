"use client";

import { MoreHorizontal } from "lucide-react";
import { extLabel, formatSize, formatTime } from "@/lib/format";
import type { FileView } from "@/lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function statusOf(file: FileView) {
  if (!file.expires) return { kind: "perm" as const, label: "永久", when: "不过期" };
  const t = new Date(file.expires).getTime();
  const when = formatTime(file.expires);
  if (t < Date.now()) return { kind: "expired" as const, label: "已过期", when };
  if (t - Date.now() < 24 * 3600e3) return { kind: "soon" as const, label: "即将过期", when };
  return { kind: "ok" as const, label: "正常", when };
}

export function FileTable({
  files,
  loading,
  selected,
  onToggle,
  onToggleAll,
  onExpire,
  onCopy,
  onRename,
  onMove,
  onDelete,
}: {
  files: FileView[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onExpire: (file: FileView) => void;
  onCopy: (url: string, kind: "download" | "view") => void;
  onRename: (file: FileView) => void;
  onMove: (file: FileView) => void;
  onDelete: (file: FileView) => void;
}) {
  const allOn = files.length > 0 && files.every((f) => selected.has(f.id));
  const selecting = selected.size > 0;
  const cols = selecting ? 6 : 7;

  return (
    <div className="panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="check-col">
                <input className="check" type="checkbox" checked={allOn} onChange={onToggleAll} aria-label="全选" />
              </th>
              <th style={{ width: "30%" }}>文件</th>
              <th style={{ width: "11%" }}>大小</th>
              <th style={{ width: "12%" }}>下载</th>
              <th style={{ width: "14%" }}>上传时间</th>
              <th style={{ width: selecting ? "18%" : "16%" }}>状态</th>
              {selecting ? null : <th className="acts-td">操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={cols}>
                  <p className="load-hint" style={{ padding: 18, color: "var(--text-4)" }}>
                    正在加载文件列表…
                  </p>
                </td>
              </tr>
            )}
            {!loading && files.length === 0 && (
              <tr>
                <td colSpan={cols}>
                  <div className="empty">
                    <h2>还没有文件</h2>
                    <p>拖拽到侧栏或点上传，支持批量。</p>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              files.map((file) => {
                const st = statusOf(file);
                return (
                  <tr
                    key={file.id}
                    className={`${selected.has(file.id) ? "picked" : ""} ${file.expired ? "expired" : ""}`}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest("a, button, input, [data-slot='dropdown-menu'], [data-slot='dropdown-menu-content']")) {
                        return;
                      }
                      onToggle(file.id);
                    }}
                  >
                    <td className="check-col">
                      <input
                        className="check"
                        type="checkbox"
                        checked={selected.has(file.id)}
                        onChange={() => onToggle(file.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      <div className="file">
                        <span className="fico">{extLabel(file.name)}</span>
                        <div>
                          <a className="name" href={file.url} title={file.key} onClick={(e) => e.stopPropagation()}>
                            {file.name}
                          </a>
                          {file.path ? <div className="sub">{file.path}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="size">{formatSize(file.size)}</td>
                    <td className="time">{file.download_count}</td>
                    <td className="time">{formatTime(file.created_at)}</td>
                    <td>
                      <div className="exp-meta">
                        <Badge kind={st.kind} label={st.label} />
                        <span className="when">{st.when}</span>
                      </div>
                    </td>
                    {selecting ? null : (
                      <td className="acts-td">
                        <div className="acts">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" type="button" aria-label={`${file.name} 操作`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onCopy(file.url, "download")}>
                                复制下载链接
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCopy(file.viewUrl, "view")}>
                                复制预览链接
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onRename(file)}>改名</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onMove(file)}>移动</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onExpire(file)}>有效期</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => onDelete(file)}>
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
