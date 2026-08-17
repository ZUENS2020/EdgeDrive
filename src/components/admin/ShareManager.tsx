"use client";

import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import IosShareIcon from "@mui/icons-material/IosShare";
import LinkIcon from "@mui/icons-material/Link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useNotification } from "@refinedev/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { copyAbsoluteUrl } from "@/lib/clipboard";
import { fileExpiryLabel } from "@/lib/format";
import { tApiError } from "@/lib/i18n";
import type { ShareKind, ShareLinkView, ShareStatus } from "@/lib/share";
import type { FileView } from "@/lib/types";
import { ExpireDialog, type ExpireSubmit } from "./ExpireDialog";
import { useI18n } from "./I18nProvider";

type KindFilter = "all" | ShareKind;
type StatusFilter = "all" | ShareStatus;

export function ShareManager() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: notify } = useNotification();
  const [links, setLinks] = useState<ShareLinkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [menu, setMenu] = useState<{ el: HTMLElement; link: ShareLinkView } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<ShareLinkView | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [expireFor, setExpireFor] = useState<ShareLinkView | null>(null);
  const [limitFor, setLimitFor] = useState<ShareLinkView | null>(null);
  const [limitValue, setLimitValue] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const [fileHits, setFileHits] = useState<FileView[]>([]);
  const [fileQ, setFileQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [createPassword, setCreatePassword] = useState("");
  const [createMax, setCreateMax] = useState("");
  const [createShort, setCreateShort] = useState(false);
  const [createPackOnly, setCreatePackOnly] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const toast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      notify?.({ type, message });
    },
    [notify],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (kind !== "all") params.set("kind", kind);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/share?${params}`);
      const data = (await res.json().catch(() => ({}))) as { links?: ShareLinkView[]; error?: string };
      if (!res.ok) {
        toast(tApiError(locale, data.error, "sharePage.loadFailed"), "error");
        return;
      }
      setLinks(data.links || []);
    } catch {
      toast(t("sharePage.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [q, kind, status, locale, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const createId = searchParams.get("create");
    if (createId) {
      setPicked(new Set([createId]));
      setCreateOpen(true);
      router.replace("/admin/shares");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!createOpen) return;
    const tmr = window.setTimeout(() => {
      void fetch(`/api/files?q=${encodeURIComponent(fileQ.trim())}&page=1&pageSize=40&filter=ok`)
        .then((r) => r.json())
        .then((d) => {
          const files = (d as { files?: FileView[] }).files;
          setFileHits(Array.isArray(files) ? files : []);
        })
        .catch(() => setFileHits([]));
    }, 200);
    return () => window.clearTimeout(tmr);
  }, [createOpen, fileQ]);

  async function copyPath(path: string | null, okMsg: string) {
    if (!path) return;
    const ok = await copyAbsoluteUrl(path);
    toast(ok ? okMsg : t("common.copyFailed"), ok ? "success" : "error");
  }

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; link?: ShareLinkView; shortUrl?: string };
    if (!res.ok) {
      toast(tApiError(locale, data.error, "sharePage.failed"), "error");
      return null;
    }
    return data;
  }

  async function createShare() {
    const ids = [...picked];
    if (!ids.length) {
      toast(t("sharePage.noFile"), "error");
      return;
    }
    setCreateBusy(true);
    try {
      const body: Record<string, unknown> = {
        kind: ids.length === 1 ? "file" : "batch",
        ids,
        short: createShort,
      };
      if (createPassword.trim()) body.password = createPassword.trim();
      if (createMax.trim()) body.max_downloads = Number(createMax);
      if (ids.length > 1 && createPackOnly) body.allow_preview = 0;
      const data = await api("/api/share", { method: "POST", body: JSON.stringify(body) });
      if (!data) return;
      setCreateOpen(false);
      setPicked(new Set());
      setCreatePassword("");
      setCreateMax("");
      setCreateShort(false);
      setCreatePackOnly(false);
      toast(t("sharePage.created"));
      const url = (data as { url?: string }).url;
      if (url) await copyPath(url, t("sharePage.copied"));
      await load();
    } finally {
      setCreateBusy(false);
    }
  }

  function statusChip(link: ShareLinkView) {
    const map = {
      active: { label: t("sharePage.statusActive"), color: "success" as const },
      revoked: { label: t("sharePage.statusRevoked"), color: "default" as const },
      expired: { label: t("sharePage.statusExpired"), color: "error" as const },
      exhausted: { label: t("sharePage.statusExhausted"), color: "warning" as const },
    };
    const st = map[link.status];
    return <Chip size="small" label={st.label} color={st.color} />;
  }

  const shown = useMemo(() => links, [links]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Toolbar sx={{ gap: 1, flexWrap: "wrap", px: { xs: 1.5, md: 3 }, py: 1.5 }}>
        <IosShareIcon color="action" />
        <Typography variant="h6" fontWeight={700} sx={{ mr: 1 }}>
          {t("sharePage.title")}
        </Typography>
        <TextField
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("sharePage.search")}
          sx={{ minWidth: { xs: "100%", sm: 260 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t("sharePage.filterKind")}</InputLabel>
          <Select
            label={t("sharePage.filterKind")}
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
          >
            <MenuItem value="all">{t("sharePage.filterAll")}</MenuItem>
            <MenuItem value="file">{t("sharePage.kindFile")}</MenuItem>
            <MenuItem value="batch">{t("sharePage.kindBatch")}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t("sharePage.filterStatus")}</InputLabel>
          <Select
            label={t("sharePage.filterStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <MenuItem value="all">{t("sharePage.filterAll")}</MenuItem>
            <MenuItem value="active">{t("sharePage.statusActive")}</MenuItem>
            <MenuItem value="revoked">{t("sharePage.statusRevoked")}</MenuItem>
            <MenuItem value="expired">{t("sharePage.statusExpired")}</MenuItem>
            <MenuItem value="exhausted">{t("sharePage.statusExhausted")}</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("sharePage.create")}
        </Button>
      </Toolbar>
      {loading ? <LinearProgress /> : null}
      <TableContainer sx={{ flex: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t("sharePage.colKind")}</TableCell>
              <TableCell>{t("sharePage.colTarget")}</TableCell>
              <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{t("sharePage.colPassword")}</TableCell>
              <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{t("sharePage.colDownloads")}</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{t("sharePage.colExpires")}</TableCell>
              <TableCell>{t("sharePage.colStatus")}</TableCell>
              <TableCell align="right">{t("common.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    {t("sharePage.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {shown.map((link) => (
              <TableRow key={link.token} hover>
                <TableCell>{link.kind === "file" ? "📄" : "📦"} {link.kind === "file" ? t("sharePage.kindFile") : t("sharePage.kindBatch")}</TableCell>
                <TableCell>
                  <Typography noWrap title={link.target_label} fontWeight={500}>
                    {link.kind === "batch"
                      ? t("sharePage.nFiles", { count: link.target_ids.length })
                      : link.target_label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {link.short_code ? `/s/${link.short_code}` : link.token.slice(0, 10) + "…"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  {link.has_password ? t("sharePage.passwordYes") : t("sharePage.passwordNo")}
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  {link.download_count}
                  {link.max_downloads != null ? ` / ${link.max_downloads}` : ` / ${t("sharePage.unlimited")}`}
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  {fileExpiryLabel(link.expires_at, Date.now(), locale)}
                </TableCell>
                <TableCell>{statusChip(link)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <IconButton
                    size="small"
                    title={t("sharePage.copy")}
                    aria-label={t("sharePage.copy")}
                    onClick={() => void copyPath(link.url, t("sharePage.copied"))}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title={t("common.more")}
                    aria-label={t("common.more")}
                    onClick={(e) => setMenu({ el: e.currentTarget, link })}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu open={Boolean(menu)} anchorEl={menu?.el} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) void copyPath(menu.link.url, t("sharePage.copied"));
            setMenu(null);
          }}
        >
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          {t("sharePage.copy")}
        </MenuItem>
        {menu?.link.shortUrl ? (
          <MenuItem
            onClick={() => {
              if (menu) void copyPath(menu.link.shortUrl, t("sharePage.copiedShort"));
              setMenu(null);
            }}
          >
            <LinkIcon fontSize="small" sx={{ mr: 1 }} />
            {t("sharePage.copyShort")}
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              const token = menu?.link.token;
              setMenu(null);
              if (!token) return;
              void api(`/api/share/${encodeURIComponent(token)}/short`, { method: "POST" }).then(async (data) => {
                if (!data) return;
                toast(t("sharePage.shortened"));
                if (data.shortUrl) await copyPath(data.shortUrl, t("sharePage.copiedShort"));
                await load();
              });
            }}
          >
            <LinkIcon fontSize="small" sx={{ mr: 1 }} />
            {t("sharePage.toShort")}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setPasswordFor(menu?.link ?? null);
            setPasswordValue("");
            setMenu(null);
          }}
        >
          <VpnKeyIcon fontSize="small" sx={{ mr: 1 }} />
          {t("sharePage.setPassword")}
        </MenuItem>
        {menu?.link.has_password ? (
          <MenuItem
            onClick={() => {
              const token = menu.link.token;
              setMenu(null);
              void api(`/api/share/${encodeURIComponent(token)}`, {
                method: "PATCH",
                body: JSON.stringify({ clear_password: true }),
              }).then((data) => {
                if (!data) return;
                toast(t("sharePage.passwordCleared"));
                void load();
              });
            }}
          >
            {t("sharePage.clearPassword")}
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            setExpireFor(menu?.link ?? null);
            setMenu(null);
          }}
        >
          {t("sharePage.extend")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setLimitFor(menu?.link ?? null);
            setMenu(null);
          }}
        >
          {t("sharePage.increaseLimit")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            const link = menu?.link;
            setMenu(null);
            if (!link) return;
            void api(`/api/share/${encodeURIComponent(link.token)}`, {
              method: "PATCH",
              body: JSON.stringify({ revoked: !link.revoked }),
            }).then((data) => {
              if (!data) return;
              toast(link.revoked ? t("sharePage.restored") : t("sharePage.revoked"));
              void load();
            });
          }}
        >
          {menu?.link.revoked ? t("sharePage.restore") : t("sharePage.revoke")}
        </MenuItem>
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            const link = menu?.link;
            setMenu(null);
            if (!link) return;
            setConfirm({
              title: t("sharePage.deleteTitle"),
              body: t("sharePage.confirmDelete"),
              run: () => {
                void api(`/api/share/${encodeURIComponent(link.token)}`, { method: "DELETE" }).then((data) => {
                  if (!data) return;
                  toast(t("sharePage.deleted"));
                  void load();
                });
              },
            });
          }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t("sharePage.delete")}
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("sharePage.createTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label={t("sharePage.searchFiles")}
            value={fileQ}
            onChange={(e) => setFileQ(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, mb: 0.5 }}>
            {t("sharePage.pickFiles")}
          </Typography>
          <Stack sx={{ maxHeight: 220, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1, px: 1 }}>
            {fileHits.map((file) => (
              <FormControlLabel
                key={file.id}
                control={
                  <Checkbox
                    checked={picked.has(file.id)}
                    onChange={(_, checked) => {
                      const next = new Set(picked);
                      if (checked) next.add(file.id);
                      else next.delete(file.id);
                      setPicked(next);
                    }}
                  />
                }
                label={`${file.name}${file.path ? ` (${file.path})` : ""}`}
              />
            ))}
            {[...picked].filter((id) => !fileHits.some((f) => f.id === id)).map((id) => (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked
                    onChange={() => {
                      const next = new Set(picked);
                      next.delete(id);
                      setPicked(next);
                    }}
                  />
                }
                label={id}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            margin="dense"
            type="password"
            label={t("sharePage.passwordLabel")}
            helperText={t("sharePage.passwordOptional")}
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            type="number"
            label={t("sharePage.maxDownloads")}
            helperText={t("sharePage.maxOptional")}
            value={createMax}
            onChange={(e) => setCreateMax(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox checked={createShort} onChange={(_, v) => setCreateShort(v)} />}
            label={t("sharePage.makeShort")}
          />
          {picked.size > 1 ? (
            <FormControlLabel
              control={<Checkbox checked={createPackOnly} onChange={(_, v) => setCreatePackOnly(v)} />}
              label={t("sharePage.packOnly")}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" disabled={createBusy} onClick={() => void createShare()}>
            {t("sharePage.create")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(passwordFor)} onClose={() => setPasswordFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t("sharePage.passwordTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            type="password"
            label={t("sharePage.passwordLabel")}
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordFor(null)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              const token = passwordFor?.token;
              const password = passwordValue;
              setPasswordFor(null);
              if (!token || !password.trim()) return;
              void api(`/api/share/${encodeURIComponent(token)}`, {
                method: "PATCH",
                body: JSON.stringify({ password: password.trim() }),
              }).then((data) => {
                if (!data) return;
                toast(t("sharePage.passwordSet"));
                void load();
              });
            }}
          >
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ExpireDialog
        open={Boolean(expireFor)}
        count={1}
        onClose={() => setExpireFor(null)}
        onSubmit={(payload: ExpireSubmit) => {
          const token = expireFor?.token;
          setExpireFor(null);
          if (!token) return;
          const body =
            payload.action === "expireNow"
              ? { expireNow: true }
              : payload.action === "permanent"
                ? { permanent: true }
                : { hours: payload.hours, days: payload.days, expires: payload.expires };
          void api(`/api/share/${encodeURIComponent(token)}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }).then((data) => {
            if (!data) return;
            toast(t("sharePage.extended"));
            void load();
          });
        }}
      />

      <Dialog open={Boolean(limitFor)} onClose={() => setLimitFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t("sharePage.increaseLimit")}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            type="number"
            inputProps={{ min: 1 }}
            defaultValue={limitFor?.max_downloads ?? 1}
            helperText={
              limitFor?.max_downloads != null
                ? t("sharePage.currentLimit").replace("{n}", String(limitFor.max_downloads))
                : t("sharePage.currentLimitUnlimited")
            }
            onChange={(e) => setLimitValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLimitFor(null)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              const link = limitFor;
              setLimitFor(null);
              if (!link) return;
              const n = Number(limitValue);
              if (!Number.isFinite(n) || n < 1) return;
              void api(`/api/share/${encodeURIComponent(link.token)}`, {
                method: "PATCH",
                body: JSON.stringify({ max_downloads: Math.floor(n) }),
              }).then((data) => {
                if (!data) return;
                toast(t("sharePage.limitUpdated"));
                void load();
              });
            }}
          >
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.body}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const run = confirm?.run;
              setConfirm(null);
              run?.();
            }}
          >
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
