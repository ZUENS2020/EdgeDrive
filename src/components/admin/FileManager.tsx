"use client";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import GridViewIcon from "@mui/icons-material/GridView";
import LabelIcon from "@mui/icons-material/Label";
import LinkIcon from "@mui/icons-material/Link";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import SearchIcon from "@mui/icons-material/Search";
import PreviewIcon from "@mui/icons-material/Preview";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
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
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { FOLDER_DELETE_CONFIRM_TITLE, folderDeleteConfirmMessage } from "@/lib/folder-delete-confirm";
import { isGlobalFileFilter, type FileListFilter } from "@/lib/files-query";
import { formatSize, formatTime } from "@/lib/format";
import { parseTags } from "@/lib/tags";
import { MAX_BATCH_IDS, type FileView, type FolderNode } from "@/lib/types";
import { parseRowActions } from "@/lib/row-actions";
import { uploadFilesQueued } from "@/lib/upload-client";
import { copyErrorMessage } from "@/lib/copy";
import { useSiteSettings } from "./AdminProviders";
import { ExpireDialog, type ExpireSubmit } from "./ExpireDialog";
import { FileRowActions, type FileRowActionEvent } from "./FileRowActions";
import { FolderTree } from "./FolderTree";
import { MoveDialog } from "./MoveDialog";
import { PickFolderDialog } from "./PickFolderDialog";

type Filter = FileListFilter;

const FILTER_CHIPS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ok", label: "正常" },
  { id: "soon", label: "即将过期" },
  { id: "expired", label: "已过期" },
  { id: "starred", label: "收藏" },
  { id: "recent", label: "最近" },
  { id: "trash", label: "回收站" },
];

function statusOf(file: FileView) {
  if (!file.expires) return { kind: "perm" as const, label: "永久", color: "default" as const };
  const t = new Date(file.expires).getTime();
  if (t < Date.now()) return { kind: "expired" as const, label: "已过期", color: "error" as const };
  if (t - Date.now() < 24 * 3600e3) return { kind: "soon" as const, label: "即将过期", color: "warning" as const };
  return { kind: "ok" as const, label: "正常", color: "success" as const };
}

export function FileManager() {
  const { open: notify } = useNotification();
  const { siteSettings } = useSiteSettings();
  const [path, setPath] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareBusy, setShareBusy] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);
  const [expireIds, setExpireIds] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyIds, setCopyIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; label: string; value: string; run: (v: string) => void } | null>(
    null,
  );
  const [tagEdit, setTagEdit] = useState<{ ids: string[]; value: string } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [pageDrop, setPageDrop] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number; file: FileView | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pageSize = siteSettings.page_size || 50;
  const rowActions = parseRowActions(siteSettings.row_actions);

  const filesQuery = useList<FileView>({
    resource: "files",
    pagination: { currentPage: page + 1, pageSize, mode: "server" },
    filters: [
      { field: "q", operator: "eq", value: q.trim() || undefined },
      { field: "path", operator: "eq", value: q.trim() ? undefined : path == null ? "__all__" : path || "__root__" },
      { field: "filter", operator: "eq", value: filter },
      { field: "tag", operator: "eq", value: tag.trim() || undefined },
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

  useEffect(() => {
    void fetch("/api/files?page=1&pageSize=1")
      .then((r) => r.json())
      .then((d) => {
        const tags = (d as { allTags?: unknown }).allTags;
        setAllTags(Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : []);
      })
      .catch(() => {});
  }, [filesQuery.query.dataUpdatedAt]);

  const toast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      notify?.({ type, message });
    },
    [notify],
  );

  async function reload() {
    await Promise.all([filesQuery.query.refetch(), foldersQuery.query.refetch()]);
  }

  async function copyBatchShare(kind: "download" | "preview") {
    if (shareBusy) return;
    const ids = [...selected];
    if (!ids.length) return;
    if (ids.length > MAX_BATCH_IDS) {
      toast(`一次最多分享 ${MAX_BATCH_IDS} 个文件`, "error");
      return;
    }
    setShareBusy(true);
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        previewUrl?: string;
        downloadUrl?: string;
      };
      if (!res.ok || !data.previewUrl || !data.downloadUrl) {
        const map: Record<string, string> = {
          "need ids": "请选择文件",
          "too many ids": `一次最多分享 ${MAX_BATCH_IDS} 个文件`,
          "files not found": "部分文件已不存在，请刷新后重试",
          unauthorized: "未认证",
          "setup-required": "请先完成 Access 配置",
        };
        toast(map[data.error || ""] || data.error || "创建批量链接失败", "error");
        return;
      }
      const path = kind === "download" ? data.downloadUrl : data.previewUrl;
      const ok = await copyToClipboard(`${window.location.origin}${path}`);
      toast(
        ok ? (kind === "download" ? "已复制批量下载链接" : "已复制批量预览链接") : "复制失败",
        ok ? "success" : "error",
      );
    } catch {
      toast("创建批量链接失败", "error");
    } finally {
      setShareBusy(false);
    }
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

  async function copyTo(ids: string[], dest: string) {
    try {
      const res = await fetch("/api/files/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, target_path: dest }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        copied?: number;
        failed?: number;
        error?: string;
        message?: string;
        results?: { ok?: boolean; message?: string; error?: string }[];
      };
      const copied = data.copied ?? 0;
      const failed = data.failed ?? (data.results || []).filter((r) => !r.ok).length;
      const firstFail = (data.results || []).find((r) => !r.ok);
      const failText = firstFail?.message || copyErrorMessage(firstFail?.error || data.error) || data.message;
      if (copied && failed) {
        toast(`已复制 ${copied} 个，${failed} 个失败：${failText}`);
        await reload();
        return;
      }
      if (copied) {
        setSelected(new Set());
        toast(`已复制 ${copied} 个`);
        await reload();
        return;
      }
      toast(data.message || failText || "复制失败", "error");
    } catch {
      toast("复制失败", "error");
    }
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

  function handleRowAction(file: FileView, event: FileRowActionEvent) {
    switch (event.type) {
      case "more":
        setCtx({ x: event.event.clientX, y: event.event.clientY, file });
        return;
      case "copy_link":
        void copyToClipboard(file.url).then((ok) =>
          toast(ok ? "已复制下载链接" : "复制失败", ok ? "success" : "error"),
        );
        return;
      case "copy_view_link":
        void copyToClipboard(`${file.url}/view`).then((ok) =>
          toast(ok ? "已复制预览链接" : "复制失败", ok ? "success" : "error"),
        );
        return;
      case "expire":
        setExpireIds([file.id]);
        setExpireOpen(true);
        return;
      case "star":
        void patchFiles({ id: file.id, starred: file.starred ? 0 : 1 });
        return;
      case "tags":
        setTagEdit({ ids: [file.id], value: file.tags || "" });
        return;
      case "copy_to":
        setCopyIds([file.id]);
        setCopyOpen(true);
        return;
      case "delete":
        setConfirm({
          title: "移入回收站",
          body: `确定把「${file.name}」移入回收站？可在 30 天内还原。`,
          run: () => batch({ ids: [file.id], action: "delete" }),
        });
        return;
      case "restore":
        void batch({ ids: [file.id], action: "restore" }).then(() => toast("已还原"));
        return;
      case "purge":
        setConfirm({
          title: "彻底删除",
          body: `确定彻底删除「${file.name}」？此操作无法撤销。`,
          run: () => batch({ ids: [file.id], action: "purge" }),
        });
        return;
      default:
        return;
    }
  }

  async function onUpload(list: FileList | File[]) {
    let instant = 0;
    try {
      const ids = await uploadFilesQueued(list, path || "", (p) => {
        if (p.error) toast(`${p.label}: ${p.error}`, "error");
        else {
          if (p.instant) instant += 1;
          setProgress({ label: p.label, pct: p.pct });
        }
      });
      setProgress(null);
      await reload();
      if (ids.length) {
        setSelected(new Set(ids));
        toast(instant ? `已处理 ${ids.length} 个（${instant} 个秒传）` : `已上传 ${ids.length} 个并勾选`);
      }
    } catch (err) {
      setProgress(null);
      toast(String(err), "error");
    }
  }

  function crumbs() {
    if (filter === "trash") return [{ label: "回收站", path: null as string | null }];
    if (filter === "starred") return [{ label: "收藏", path: null as string | null }];
    if (filter === "recent") return [{ label: "最近", path: null as string | null }];
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
            if (isGlobalFileFilter(filter)) setFilter("all");
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
              title: FOLDER_DELETE_CONFIRM_TITLE,
              body: folderDeleteConfirmMessage(name),
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

        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, flexWrap: "wrap", alignItems: "center" }}>
          {FILTER_CHIPS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              color={filter === f.id ? "primary" : "default"}
              variant={filter === f.id ? "filled" : "outlined"}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
                setSelected(new Set());
              }}
            />
          ))}
          <FormControl size="small" sx={{ minWidth: 140, ml: "auto" }}>
            <InputLabel id="ed-tag-filter">标签</InputLabel>
            <Select
              labelId="ed-tag-filter"
              label="标签"
              value={tag}
              onChange={(e) => {
                setTag(String(e.target.value));
                setPage(0);
              }}
            >
              <MenuItem value="">全部标签</MenuItem>
              {tag && !allTags.includes(tag) ? <MenuItem value={tag}>{tag}</MenuItem> : null}
              {allTags.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {selected.size > 0 ? (
          <Paper square sx={{ px: 2, py: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2">已选 {selected.size}</Typography>
            {filter === "trash" ? (
              <>
                <Button
                  size="small"
                  startIcon={<RestoreFromTrashIcon />}
                  onClick={() => void batch({ ids: [...selected], action: "restore" }).then(() => toast("已还原"))}
                >
                  还原
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteForeverIcon />}
                  onClick={() =>
                    setConfirm({
                      title: "彻底删除",
                      body: `确定彻底删除 ${selected.size} 个文件？此操作无法撤销。`,
                      run: () => batch({ ids: [...selected], action: "purge" }),
                    })
                  }
                >
                  彻底删除
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  startIcon={<LinkIcon />}
                  disabled={shareBusy}
                  onClick={() => void copyBatchShare("download")}
                >
                  复制链接
                </Button>
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  disabled={shareBusy}
                  onClick={() => void copyBatchShare("preview")}
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
                  startIcon={<FileCopyIcon />}
                  onClick={() => {
                    setCopyIds([...selected]);
                    setCopyOpen(true);
                  }}
                >
                  复制到…
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
                  startIcon={<LabelIcon />}
                  onClick={() => setTagEdit({ ids: [...selected], value: "" })}
                >
                  标签
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() =>
                    setConfirm({
                      title: "移入回收站",
                      body: `确定把 ${selected.size} 个文件移入回收站？可在 30 天内还原。`,
                      run: () => batch({ ids: [...selected], action: "delete" }),
                    })
                  }
                >
                  删除
                </Button>
              </>
            )}
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
                        没有文件。{filter === "trash" ? "回收站是空的。" : "拖拽到此上传。"}
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
                        {parseTags(file.tags).length ? (
                          <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                            {parseTags(file.tags).map((t) => (
                              <Chip
                                key={t}
                                size="small"
                                label={t}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTag(t);
                                  setPage(0);
                                }}
                              />
                            ))}
                          </Stack>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{formatSize(file.size)}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{file.download_count}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{formatTime(file.created_at)}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <Chip size="small" label={st.label} color={st.color} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <FileRowActions
                          file={file}
                          actions={rowActions}
                          trash={filter === "trash"}
                          onAction={handleRowAction}
                        />
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
                  <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }} alignItems="center">
                    <Chip size="small" label={st.label} color={st.color} />
                    {file.starred ? <StarIcon fontSize="small" color="warning" /> : null}
                    {parseTags(file.tags).map((t) => (
                      <Chip key={t} size="small" label={t} />
                    ))}
                  </Stack>
                  <Stack direction="row" gap={0} flexWrap="wrap" sx={{ mt: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    <FileRowActions
                      file={file}
                      actions={rowActions}
                      trash={filter === "trash"}
                      onAction={handleRowAction}
                    />
                  </Stack>
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
            setCopyIds([ctxFile.id]);
            setCopyOpen(true);
            setCtx(null);
          }}
        >
          <FileCopyIcon fontSize="small" sx={{ mr: 1 }} />
          复制到…
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
            void patchFiles({ id: ctxFile.id, starred: ctxFile.starred ? 0 : 1 });
            setCtx(null);
          }}
        >
          {ctxFile?.starred ? <StarIcon fontSize="small" sx={{ mr: 1 }} /> : <StarBorderIcon fontSize="small" sx={{ mr: 1 }} />}
          {ctxFile?.starred ? "取消收藏" : "收藏"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxFile) return;
            setTagEdit({ ids: [ctxFile.id], value: ctxFile.tags || "" });
            setCtx(null);
          }}
        >
          <LabelIcon fontSize="small" sx={{ mr: 1 }} />
          标签
        </MenuItem>
        {filter === "trash" ? (
          <>
            <MenuItem
              onClick={() => {
                if (!ctxFile) return;
                void batch({ ids: [ctxFile.id], action: "restore" }).then(() => toast("已还原"));
                setCtx(null);
              }}
            >
              <RestoreFromTrashIcon fontSize="small" sx={{ mr: 1 }} />
              还原
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (!ctxFile) return;
                setConfirm({
                  title: "彻底删除",
                  body: `确定彻底删除「${ctxFile.name}」？此操作无法撤销。`,
                  run: () => batch({ ids: [ctxFile.id], action: "purge" }),
                });
                setCtx(null);
              }}
              sx={{ color: "error.main" }}
            >
              <DeleteForeverIcon fontSize="small" sx={{ mr: 1 }} />
              彻底删除
            </MenuItem>
          </>
        ) : (
          <MenuItem
            onClick={() => {
              if (!ctxFile) return;
              setConfirm({
                title: "移入回收站",
                body: `确定把「${ctxFile.name}」移入回收站？可在 30 天内还原。`,
                run: () => batch({ ids: [ctxFile.id], action: "delete" }),
              });
              setCtx(null);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
            删除
          </MenuItem>
        )}
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
      <PickFolderDialog
        open={copyOpen}
        title={`复制到文件夹${copyIds.length > 1 ? `（${copyIds.length} 个）` : ""}`}
        confirmLabel="复制"
        folders={folders}
        onClose={() => setCopyOpen(false)}
        onSubmit={(dest) => {
          const ids = copyIds;
          setCopyOpen(false);
          void copyTo(ids, dest);
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
      <Dialog open={!!tagEdit} onClose={() => setTagEdit(null)} fullWidth maxWidth="xs">
        <DialogTitle>编辑标签</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>逗号分隔，最多 20 个。</DialogContentText>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="标签"
            placeholder="工作, 合同"
            value={tagEdit?.value ?? ""}
            onChange={(e) => setTagEdit(tagEdit ? { ...tagEdit, value: e.target.value } : null)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagEdit(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!tagEdit) return;
              const ids = tagEdit.ids;
              const value = tagEdit.value;
              setTagEdit(null);
              void patchFiles({ ids, tags: value }).then((ok) => {
                if (ok) toast("标签已更新");
              });
            }}
          >
            保存
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
