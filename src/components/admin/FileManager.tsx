"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import GridViewIcon from "@mui/icons-material/GridView";
import LinkIcon from "@mui/icons-material/Link";
import SearchIcon from "@mui/icons-material/Search";
import PreviewIcon from "@mui/icons-material/Preview";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UploadIcon from "@mui/icons-material/Upload";
import ViewListIcon from "@mui/icons-material/ViewList";
import { alpha } from "@mui/material/styles";
import { useCreate, useDelete, useList, useNotification, useUpdate, useUpdateMany } from "@refinedev/core";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { formatSize, formatTime } from "@/lib/format";
import type { FileView, FolderNode, SiteSettings } from "@/lib/types";
import { uploadFilesQueued } from "@/lib/upload-client";
import { ExpireDialog, type ExpireSubmit } from "./ExpireDialog";
import { FolderTree } from "./FolderTree";
import { MoveDialog } from "./MoveDialog";

type Filter = "all" | "ok" | "soon" | "expired";

function statusOf(file: FileView) {
  if (!file.expires) return { kind: "perm" as const, label: "永久", color: "default" as const };
  const t = new Date(file.expires).getTime();
  if (t < Date.now()) return { kind: "expired" as const, label: "已过期", color: "error" as const };
  if (t - Date.now() < 24 * 3600e3) return { kind: "soon" as const, label: "即将过期", color: "warning" as const };
  return { kind: "ok" as const, label: "正常", color: "success" as const };
}

export function FileManager({ initialSettings }: { initialSettings: SiteSettings }) {
  const { open: notify } = useNotification();
  const [path, setPath] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expireOpen, setExpireOpen] = useState(false);
  const [expireIds, setExpireIds] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; label: string; value: string; run: (v: string) => void } | null>(
    null,
  );
  const [promptValue, setPromptValue] = useState("");
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [pageDrop, setPageDrop] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number; file: FileView | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pageSize = initialSettings.page_size || 50;

  const filesQuery = useList<FileView>({
    resource: "files",
    pagination: { currentPage: page + 1, pageSize, mode: "server" },
    filters: [
      { field: "q", operator: "eq", value: q.trim() || undefined },
      { field: "path", operator: "eq", value: q.trim() ? undefined : path == null ? "__all__" : path || "__root__" },
      { field: "filter", operator: "eq", value: filter },
    ],
    queryOptions: { retry: false },
  });
  const foldersQuery = useList<FolderNode>({ resource: "folders", pagination: { mode: "off" }, queryOptions: { retry: false } });
  const { mutateAsync: createFolder } = useCreate({ successNotification: false, errorNotification: false });
  const { mutateAsync: updateFolder } = useUpdate({ successNotification: false, errorNotification: false });
  const { mutateAsync: deleteFolder } = useDelete();
  const { mutateAsync: updateFile } = useUpdate({ successNotification: false, errorNotification: false });
  const { mutateAsync: updateFiles } = useUpdateMany({ successNotification: false, errorNotification: false });

  const files = filesQuery.result?.data ?? [];
  const total = filesQuery.result?.total ?? 0;
  const folders = foldersQuery.result?.data ?? [];
  const loading = filesQuery.query.isFetching;

  useEffect(() => {
    if (prompt) setPromptValue(prompt.value);
  }, [prompt]);

  const toast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      notify?.({ type, message });
    },
    [notify],
  );

  async function reload() {
    await Promise.all([filesQuery.query.refetch(), foldersQuery.query.refetch()]);
  }

  async function batch(body: Record<string, unknown>) {
    const res = await fetch("/api/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error || "操作失败", "error");
      return;
    }
    setSelected(new Set());
    await reload();
  }

  async function applyExpire(ids: string[], payload: ExpireSubmit) {
    if (payload.action === "permanent") await batch({ ids, action: "permanent" });
    else if (payload.action === "expireNow") await batch({ ids, action: "expireNow" });
    else await batch({ ids, action: "expire", hours: payload.hours, days: payload.days, expires: payload.expires });
    setExpireOpen(false);
  }

  async function patchFiles(body: Record<string, unknown>) {
    try {
      if (body.ids) await updateFiles({ resource: "files", ids: body.ids as string[], values: body });
      else await updateFile({ resource: "files", id: String(body.id), values: body });
      await reload();
      return true;
    } catch (err) {
      const map: Record<string, string> = {
        "file-exists": "目标位置已有同名文件",
        "folder-not-found": "文件夹不存在",
        "rename-single": "一次只能改一个文件名",
      };
      const msg = err instanceof Error ? err.message : "操作失败";
      toast(map[msg] || msg, "error");
      return false;
    }
  }

  async function onUpload(list: FileList | File[]) {
    try {
      const ids = await uploadFilesQueued(list, path || "", (p) => {
        if (p.error) toast(`${p.label}: ${p.error}`, "error");
        else setProgress({ label: p.label, pct: p.pct });
      });
      setProgress(null);
      await reload();
      if (ids.length) {
        setSelected(new Set(ids));
        toast(`已上传 ${ids.length} 个并勾选`);
      }
    } catch (err) {
      setProgress(null);
      toast(String(err), "error");
    }
  }

  function crumbs() {
    if (q.trim()) return [{ label: "搜索", path: null as string | null }];
    if (path == null) return [{ label: "全部文件", path: null }];
    const parts = path.split("/").filter(Boolean);
    const items: { label: string; path: string | null }[] = [{ label: "根目录", path: "" }];
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      items.push({ label: part, path: acc });
    }
    return items;
  }

  const allOn = files.length > 0 && files.every((f) => selected.has(f.id));
  const ctxFile = ctx?.file;

  return (
    <Box
      sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: { md: "100vh" } }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setPageDrop(true);
        }
      }}
      onDragLeave={() => setPageDrop(false)}
      onDrop={(e) => {
        e.preventDefault();
        setPageDrop(false);
        if (e.dataTransfer.files?.length) void onUpload(e.dataTransfer.files);
      }}
      onContextMenu={(e) => {
        const row = (e.target as HTMLElement).closest("[data-file-id]");
        if (!row) return;
        e.preventDefault();
        const id = row.getAttribute("data-file-id");
        const file = files.find((f) => f.id === id);
        if (file) setCtx({ x: e.clientX, y: e.clientY, file });
      }}
    >
      <Box
        sx={{
          width: { md: 240 },
          flexShrink: 0,
          borderRight: { md: "1px solid" },
          borderColor: "divider",
          p: 1,
          display: "block",
          maxHeight: { xs: 220, md: "none" },
          overflowY: { xs: "auto", md: "visible" },
        }}
      >
        <FolderTree
          folders={folders}
          currentPath={path}
          onSelect={(p) => {
            setPath(p);
            setQ("");
            setPage(0);
          }}
          onCreate={(parentId) =>
            setPrompt({
              title: parentId ? "新建子文件夹" : "新建文件夹",
              label: "文件夹名称",
              value: "",
              run: async (name) => {
                try {
                  await createFolder({ resource: "folders", values: { name, parent_id: parentId } });
                  toast("文件夹已创建");
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : "创建失败", "error");
                }
              },
            })
          }
          onRename={(id, name) =>
            setPrompt({
              title: "重命名文件夹",
              label: "新名称",
              value: name,
              run: async (next) => {
                try {
                  await updateFolder({ resource: "folders", id, values: { name: next } });
                  toast("已重命名");
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : "重命名失败", "error");
                }
              },
            })
          }
          onDelete={(id, folderPath, name) =>
            setConfirm({
              title: "删除文件夹",
              body: `确定删除「${name}」及其内所有文件？此操作无法撤销。`,
              run: async () => {
                try {
                  await deleteFolder({ resource: "folders", id });
                  if (path === folderPath || (path && path.startsWith(`${folderPath}/`))) setPath(null);
                  toast("文件夹已删除");
                  await reload();
                } catch (err) {
                  toast(err instanceof Error ? err.message : "删除失败", "error");
                }
              },
            })
          }
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Toolbar sx={{ gap: 1, flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}>
          <Breadcrumbs sx={{ flex: 1, minWidth: 120 }}>
            {crumbs().map((c, i, arr) =>
              i === arr.length - 1 ? (
                <Typography key={`${c.label}-${i}`} color="text.primary" fontWeight={600}>
                  {c.label}
                </Typography>
              ) : (
                <Link
                  key={`${c.label}-${i}`}
                  component="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => {
                    setPath(c.path);
                    setQ("");
                    setPage(0);
                  }}
                >
                  {c.label}
                </Link>
              ),
            )}
          </Breadcrumbs>
          <Chip label={total} size="small" />
          <TextField
            size="small"
            placeholder="搜索文件名"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => fileInput.current?.click()}>
            上传
          </Button>
          <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="list" aria-label="列表">
              <ViewListIcon />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="网格">
              <GridViewIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>

        {progress ? (
          <Box sx={{ px: 2, py: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption">{progress.label}</Typography>
              <Typography variant="caption">{progress.pct}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress.pct} />
          </Box>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, flexWrap: "wrap" }}>
          {(["all", "ok", "soon", "expired"] as Filter[]).map((f) => (
            <Chip
              key={f}
              label={f === "all" ? "全部" : f === "ok" ? "正常" : f === "soon" ? "即将过期" : "已过期"}
              color={filter === f ? "primary" : "default"}
              variant={filter === f ? "filled" : "outlined"}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
            />
          ))}
        </Stack>

        {selected.size > 0 ? (
          <Paper square sx={{ px: 2, py: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2">已选 {selected.size}</Typography>
            <Button
              size="small"
              startIcon={<LinkIcon />}
              onClick={async () => {
                const list = files.filter((f) => selected.has(f.id));
                const ok = await copyToClipboard(list.map((f) => f.url).join("\n"));
                toast(ok ? `已复制 ${list.length} 条下载链接` : "复制失败", ok ? "success" : "error");
              }}
            >
              复制链接
            </Button>
            <Button
              size="small"
              startIcon={<VisibilityIcon />}
              onClick={async () => {
                const list = files.filter((f) => selected.has(f.id));
                const ok = await copyToClipboard(list.map((f) => `${f.url}/view`).join("\n"));
                toast(ok ? `已复制 ${list.length} 条预览链接` : "复制失败", ok ? "success" : "error");
              }}
            >
              复制预览链接
            </Button>
            <Button
              size="small"
              startIcon={<DriveFileMoveIcon />}
              onClick={() => {
                setMoveIds([...selected]);
                setMoveOpen(true);
              }}
            >
              移动
            </Button>
            <Button
              size="small"
              startIcon={<ScheduleIcon />}
              onClick={() => {
                setExpireIds([...selected]);
                setExpireOpen(true);
              }}
            >
              有效期
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() =>
                setConfirm({
                  title: "删除文件",
                  body: `确定删除 ${selected.size} 个文件？此操作无法撤销。`,
                  run: () => batch({ ids: [...selected], action: "delete" }),
                })
              }
            >
              删除
            </Button>
            <Button size="small" onClick={() => setSelected(new Set())}>
              取消
            </Button>
          </Paper>
        ) : null}

        {view === "list" ? (
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ whiteSpace: "nowrap" }}>
                    <Checkbox
                      checked={allOn}
                      indeterminate={selected.size > 0 && !allOn}
                      onChange={() => setSelected(allOn ? new Set() : new Set(files.map((f) => f.id)))}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>文件</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>大小</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>下载</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap" }}>上传时间</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>状态</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary" sx={{ p: 2 }}>
                        正在加载…
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary" sx={{ p: 2 }}>
                        没有文件。拖拽到此上传。
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
                {files.map((file) => {
                  const st = statusOf(file);
                  return (
                    <TableRow
                      key={file.id}
                      hover
                      data-file-id={file.id}
                      selected={selected.has(file.id)}
                      sx={{
                        "&.Mui-selected": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14) },
                        "&.Mui-selected:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2) },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.has(file.id)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(file.id)) next.delete(file.id);
                            else next.add(file.id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography noWrap title={file.name} fontWeight={500}>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {file.path || "/"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{formatSize(file.size)}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{file.download_count}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{formatTime(file.created_at)}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <Chip size="small" label={st.label} color={st.color} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <IconButton size="small" href={file.url} target="_blank" aria-label="下载">
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" href={`${file.url}/view`} target="_blank" title="预览" aria-label="预览">
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            const ok = await copyToClipboard(file.url);
                            toast(ok ? "已复制下载链接" : "复制失败", ok ? "success" : "error");
                          }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="复制预览链接"
                          aria-label="复制预览链接"
                          onClick={async () => {
                            const ok = await copyToClipboard(`${file.url}/view`);
                            toast(ok ? "已复制预览链接" : "复制失败", ok ? "success" : "error");
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setExpireIds([file.id]);
                            setExpireOpen(true);
                          }}
                        >
                          <ScheduleIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            setConfirm({
                              title: "删除文件",
                              body: `确定删除「${file.name}」？`,
                              run: () => batch({ ids: [file.id], action: "delete" }),
                            })
                          }
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1.5 }}>
            {files.map((file) => {
              const st = statusOf(file);
              return (
                <Paper
                  key={file.id}
                  data-file-id={file.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    cursor: "pointer",
                    outline: selected.has(file.id) ? "3px solid" : "none",
                    outlineColor: "primary.main",
                    bgcolor: selected.has(file.id) ? (theme) => alpha(theme.palette.primary.main, 0.1) : undefined,
                  }}
                  onClick={() => {
                    const next = new Set(selected);
                    if (next.has(file.id)) next.delete(file.id);
                    else next.add(file.id);
                    setSelected(next);
                  }}
                >
                  <Typography noWrap fontWeight={600} title={file.name}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatSize(file.size)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip size="small" label={st.label} color={st.color} />
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
          labelRowsPerPage="每页"
        />
      </Box>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void onUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <Menu
        open={Boolean(ctx)}
        onClose={() => setCtx(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (ctxFile) window.open(ctxFile.url, "_blank");
            setCtx(null);
          }}
        >
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
          下载
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (ctxFile) window.open(`${ctxFile.url}/view`, "_blank");
            setCtx(null);
          }}
        >
          <PreviewIcon fontSize="small" sx={{ mr: 1 }} />
          预览
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (ctxFile) {
              const ok = await copyToClipboard(ctxFile.url);
              toast(ok ? "已复制下载链接" : "复制失败", ok ? "success" : "error");
            }
            setCtx(null);
          }}
        >
          <LinkIcon fontSize="small" sx={{ mr: 1 }} />
          复制链接
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (ctxFile) {
              const ok = await copyToClipboard(`${ctxFile.url}/view`);
              toast(ok ? "已复制预览链接" : "复制失败", ok ? "success" : "error");
            }
            setCtx(null);
          }}
        >
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          复制预览链接
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxFile) return;
            setPrompt({
              title: "重命名文件",
              label: "新文件名",
              value: ctxFile.name,
              run: async (name) => {
                const ok = await patchFiles({ id: ctxFile.id, name });
                if (ok) toast("已改名");
              },
            });
            setCtx(null);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          重命名
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxFile) return;
            setMoveIds([ctxFile.id]);
            setMoveOpen(true);
            setCtx(null);
          }}
        >
          <DriveFileMoveIcon fontSize="small" sx={{ mr: 1 }} />
          移动
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxFile) return;
            setExpireIds([ctxFile.id]);
            setExpireOpen(true);
            setCtx(null);
          }}
        >
          <ScheduleIcon fontSize="small" sx={{ mr: 1 }} />
          有效期
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxFile) return;
            setConfirm({
              title: "删除文件",
              body: `确定删除「${ctxFile.name}」？`,
              run: () => batch({ ids: [ctxFile.id], action: "delete" }),
            });
            setCtx(null);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          删除
        </MenuItem>
      </Menu>

      <ExpireDialog
        open={expireOpen}
        count={expireIds.length || selected.size}
        onClose={() => setExpireOpen(false)}
        onSubmit={(payload) => applyExpire(expireIds.length ? expireIds : [...selected], payload)}
      />
      <MoveDialog
        open={moveOpen}
        count={moveIds.length}
        folders={folders}
        onClose={() => setMoveOpen(false)}
        onSubmit={async (dest) => {
          setMoveOpen(false);
          const ok = await patchFiles({ ids: moveIds, path: dest });
          if (ok) {
            setSelected(new Set());
            toast("已移动");
          }
        }}
      />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.body}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const run = confirm?.run;
              setConfirm(null);
              run?.();
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!prompt} onClose={() => setPrompt(null)}>
        <DialogTitle>{prompt?.title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={prompt?.label}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrompt(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              const run = prompt?.run;
              setPrompt(null);
              if (promptValue.trim()) run?.(promptValue.trim());
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
      {pageDrop ? (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "text.primary",
            color: "background.default",
            opacity: 0.88,
            display: "grid",
            placeItems: "center",
            zIndex: 20,
            pointerEvents: "none",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          放开以上传
        </Box>
      ) : null}
    </Box>
  );
}
