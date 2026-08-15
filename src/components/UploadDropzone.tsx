"use client";

import type { DragEvent } from "react";

export function UploadDropzone({
  onFiles,
  hint,
}: {
  onFiles: (files: FileList | File[]) => void;
  hint: string;
}) {
  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.remove("over");
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  }

  return (
    <label
      className="side-drop"
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add("over");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("over")}
      onDrop={onDrop}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.5" />
      </svg>
      <span>拖拽文件到此处</span>
      <span className="side-drop-sub">{hint}</span>
      <input
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
