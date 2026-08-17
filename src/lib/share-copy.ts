export type ShareCopyKind = "download" | "preview";

export type ShareCopySource = {
  downloadUrl?: string | null;
  viewUrl?: string | null;
  allowDownload: boolean;
  allowPreview: boolean;
};

export type ShareCopyRow = {
  kind: ShareCopyKind;
  path: string;
  enabled: boolean;
};

/** Two copy rows for the share UI. Disabled rows stay visible with their path. */
export function shareCopyRows(source: ShareCopySource): ShareCopyRow[] {
  const downloadPath = (source.downloadUrl || "").trim();
  const previewPath = (source.viewUrl || "").trim();
  return [
    {
      kind: "download",
      path: downloadPath,
      enabled: Boolean(source.allowDownload && downloadPath),
    },
    {
      kind: "preview",
      path: previewPath,
      enabled: Boolean(source.allowPreview && previewPath),
    },
  ];
}
