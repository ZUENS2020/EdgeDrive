"use client";

import { FolderPlus, MoreHorizontal } from "lucide-react";
import type { FolderNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
    <div>
      <div className="nav-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        文件夹
        <Button variant="ghost" size="icon-xs" type="button" onClick={() => onCreate("")} title="新建文件夹">
          <FolderPlus />
        </Button>
      </div>
      <div className="tree">
        <button
          type="button"
          className={cn("tree-item", currentPath === null && "on")}
          onClick={() => onSelect(null)}
        >
          <span className="nm">全部</span>
        </button>
        <button type="button" className={cn("tree-item", currentPath === "" && "on")} onClick={() => onSelect("")}>
          <span className="nm">根目录</span>
        </button>
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
      </div>
    </div>
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
  return (
    <div>
      <div className={cn("tree-item", currentPath === node.path && "on")}>
        <button
          type="button"
          className="nm"
          onClick={() => onSelect(node.path)}
          onDoubleClick={() => onRename(node.id, node.name)}
        >
          {node.name}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" type="button" aria-label={`${node.name} 操作`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreate(node.id)}>新建子文件夹</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(node.id, node.name)}>重命名</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(node.id, node.path, node.name)}>
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {node.children.length > 0 && (
        <div className="tree-kids">
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
        </div>
      )}
    </div>
  );
}
