"use client";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";
import type { FolderNode } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export function PickFolderDialog({
  open,
  title,
  confirmLabel,
  folders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  folders: FolderNode[];
  onClose: () => void;
  onSubmit: (path: string) => void;
}) {
  const [path, setPath] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    if (open) setPath("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
          <ListItemButton
            selected={path === ""}
            onClick={() => setPath("")}
            sx={{ borderRadius: 1, "&.Mui-selected": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14) } }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
              <FolderOpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t("pickFolder.root")} />
          </ListItemButton>
          {folders.map((node) => (
            <FolderPickNode key={node.id} node={node} path={path} onPick={setPath} />
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => onSubmit(path)}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FolderPickNode({
  node,
  path,
  onPick,
}: {
  node: FolderNode;
  path: string;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  const on = path === node.path;

  return (
    <>
      <ListItemButton
        selected={on}
        onClick={() => onPick(node.path)}
        sx={{ pl: 2 + depthOf(node.path) * 1.2, borderRadius: 1, "&.Mui-selected": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14) } }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "inherit", display: "flex", alignItems: "center" }}>
          <FolderIcon fontSize="small" />
          {hasKids ? <ExpandIconButton open={open} onClick={() => setOpen((v) => !v)} /> : null}
        </ListItemIcon>
        <ListItemText primary={node.name} primaryTypographyProps={{ noWrap: true }} />
      </ListItemButton>
      {hasKids ? (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {node.children.map((child) => (
              <FolderPickNode key={child.id} node={child} path={path} onPick={onPick} />
            ))}
          </List>
        </Collapse>
      ) : null}
    </>
  );
}

function ExpandIconButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Button
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{ minWidth: 22, p: 0.25 }}
    >
      {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
    </Button>
  );
}

function depthOf(path: string): number {
  if (!path) return 0;
  return path.split("/").length;
}
