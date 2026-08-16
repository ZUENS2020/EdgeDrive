"use client";

import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import type { FolderNode } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export function FolderTree({
  folders,
  currentPath,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: FolderNode[];
  currentPath: string | null;
  onSelect: (path: string | null) => void;
  onCreate: (parentId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, path: string, name: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", px: 1, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {t("folderTree.title")}
        </Typography>
        <IconButton size="small" onClick={() => onCreate("")} aria-label={t("folderTree.new")}>
          <CreateNewFolderIcon fontSize="small" />
        </IconButton>
      </Box>
      <List dense disablePadding>
        <ListItemButton selected={currentPath === null} onClick={() => onSelect(null)}>
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("folderTree.all")} />
        </ListItemButton>
        <ListItemButton selected={currentPath === ""} onClick={() => onSelect("")}>
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("folderTree.root")} />
        </ListItemButton>
        {folders.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            currentPath={currentPath}
            onSelect={onSelect}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </List>
    </Box>
  );
}

function TreeNode({
  node,
  currentPath,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  node: FolderNode;
  currentPath: string | null;
  onSelect: (path: string | null) => void;
  onCreate: (parentId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, path: string, name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const hasKids = node.children.length > 0;
  const { t } = useI18n();

  return (
    <>
      <ListItemButton
        selected={currentPath === node.path}
        onClick={() => onSelect(node.path)}
        onDoubleClick={() => onRename(node.id, node.name)}
        sx={{ pl: 2 }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "inherit", display: "flex", alignItems: "center" }}>
          <FolderIcon fontSize="small" />
          {hasKids ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              sx={{ p: 0.25 }}
            >
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          ) : null}
        </ListItemIcon>
        <ListItemText primary={node.name} primaryTypographyProps={{ noWrap: true }} />
        <IconButton
          size="small"
          aria-label={t("folderTree.actions", { name: node.name })}
          onClick={(e) => {
            e.stopPropagation();
            setMenu(e.currentTarget);
          }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </ListItemButton>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onCreate(node.id);
          }}
        >
          {t("folderTree.newSub")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onRename(node.id, node.name);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          {t("folderTree.rename")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onSelect(node.path);
          }}
        >
          <DriveFileMoveIcon fontSize="small" sx={{ mr: 1 }} />
          {t("folderTree.open")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onDelete(node.id, node.path, node.name);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t("folderTree.delete")}
        </MenuItem>
      </Menu>
      {hasKids ? (
        <Collapse in={open}>
          <Box sx={{ pl: 1.5 }}>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                currentPath={currentPath}
                onSelect={onSelect}
                onCreate={onCreate}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </Box>
        </Collapse>
      ) : null}
    </>
  );
}
