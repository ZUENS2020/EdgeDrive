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
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", px: 1, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          文件夹
        </Typography>
        <IconButton size="small" onClick={() => onCreate("")} aria-label="新建文件夹">
          <CreateNewFolderIcon fontSize="small" />
        </IconButton>
      </Box>
      <List dense disablePadding>
        <ListItemButton selected={currentPath === null} onClick={() => onSelect(null)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="全部" />
        </ListItemButton>
        <ListItemButton selected={currentPath === ""} onClick={() => onSelect("")}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="根目录" />
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

  return (
    <>
      <ListItemButton
        selected={currentPath === node.path}
        onClick={() => onSelect(node.path)}
        onDoubleClick={() => onRename(node.id, node.name)}
        sx={{ pl: 2 }}
      >
        <ListItemIcon sx={{ minWidth: 28 }} onClick={(e) => e.stopPropagation()}>
          {hasKids ? (
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          ) : (
            <FolderIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText primary={node.name} primaryTypographyProps={{ noWrap: true }} />
        <IconButton
          size="small"
          aria-label={`${node.name} 操作`}
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
          新建子文件夹
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onRename(node.id, node.name);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          重命名
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onSelect(node.path);
          }}
        >
          <DriveFileMoveIcon fontSize="small" sx={{ mr: 1 }} />
          打开
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onDelete(node.id, node.path, node.name);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          删除
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
