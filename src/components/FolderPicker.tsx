"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FolderNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FolderPicker({
  folders,
  value,
  onChange,
}: {
  folders: FolderNode[];
  value: string;
  onChange: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorsOf(value)));

  function toggle(path: string) {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  }

  return (
    <div className="folder-picker" role="tree" aria-label="选择目标文件夹">
      <button
        type="button"
        role="treeitem"
        aria-selected={value === ""}
        className={cn("tree-item", value === "" && "on")}
        onClick={() => onChange("")}
      >
        <span className="tree-chev" aria-hidden />
        <span className="nm">根目录</span>
      </button>
      {folders.map((node) => (
        <PickerNode
          key={node.id}
          node={node}
          value={value}
          expanded={expanded}
          onChange={onChange}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function PickerNode({
  node,
  value,
  expanded,
  onChange,
  onToggle,
}: {
  node: FolderNode;
  value: string;
  expanded: Set<string>;
  onChange: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const hasKids = node.children.length > 0;
  const open = expanded.has(node.path);

  return (
    <div>
      <div className={cn("tree-item", value === node.path && "on")}>
        {hasKids ? (
          <button
            type="button"
            className="tree-chev"
            aria-label={open ? `折叠 ${node.name}` : `展开 ${node.name}`}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : (
          <span className="tree-chev" aria-hidden />
        )}
        <button
          type="button"
          role="treeitem"
          aria-selected={value === node.path}
          aria-expanded={hasKids ? open : undefined}
          className="nm"
          onClick={() => onChange(node.path)}
        >
          {node.name}
        </button>
      </div>
      {hasKids && open ? (
        <div className="tree-kids">
          {node.children.map((child) => (
            <PickerNode
              key={child.id}
              node={child}
              value={value}
              expanded={expanded}
              onChange={onChange}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ancestorsOf(path: string): string[] {
  if (!path) return [];
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}
