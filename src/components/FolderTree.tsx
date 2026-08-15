"use client";

import type { FolderNode } from "@/lib/types";
import { Button } from "./ui/Button";

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
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div>
      <div className="nav-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        文件夹
        <Button variant="ghost" type="button" onClick={() => onCreate("")} title="新建文件夹">
          +
        </Button>
      </div>
      <div className="tree">
        <button
          type="button"
          className={`tree-item ${currentPath === null ? "on" : ""}`}
          onClick={() => onSelect(null)}
        >
          <span className="nm">全部</span>
        </button>
        <button
          type="button"
          className={`tree-item ${currentPath === "" ? "on" : ""}`}
          onClick={() => onSelect("")}
        >
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
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        className={`tree-item ${currentPath === node.path ? "on" : ""}`}
        onClick={() => onSelect(node.path)}
        onDoubleClick={() => {
          const next = window.prompt("重命名文件夹", node.name);
          if (next && next !== node.name) onRename(node.id, next);
        }}
      >
        <span className="nm">{node.name}</span>
        <Button
          variant="ghost"
          type="button"
          title="新建子文件夹"
          onClick={(e) => {
            e.stopPropagation();
            onCreate(node.id);
          }}
        >
          +
        </Button>
        <Button
          variant="ghost"
          type="button"
          title="删除文件夹"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id, node.name);
          }}
        >
          ×
        </Button>
      </button>
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
