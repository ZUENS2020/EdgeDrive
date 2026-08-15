"use client";

import type { DragEvent } from "react";
import { Upload } from "lucide-react";

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
      <Upload />
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
