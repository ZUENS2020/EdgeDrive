import { MPU_CONCURRENCY, uploadMpuParts } from "./mpu-pool";

const PART = 8 * 1024 * 1024;

export type UploadProgress = { label: string; pct: number; error?: string };

export async function uploadOne(
  file: File,
  folderPath: string,
  onPct: (n: number) => void,
): Promise<{ id?: string }> {
  const key = folderPath ? `${folderPath}/${file.name}` : file.name;
  if (file.size <= PART) {
    const params = new URLSearchParams({ name: file.name, path: folderPath });
    const res = await fetch(`/api/files/upload?${params}`, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || res.statusText);
    }
    onPct(100);
    return (await res.json()) as { id?: string };
  }

  let uploadId = "";
  try {
    const create = await fetch(`/api/files/mpu?action=create&key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!create.ok) {
      const err = (await create.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || "mpu create failed");
    }
    const created = (await create.json()) as { uploadId: string };
    uploadId = created.uploadId;
    const total = Math.ceil(file.size / PART);
    const parts = await uploadMpuParts({
      total,
      concurrency: MPU_CONCURRENCY,
      onProgress: (completed, n) => onPct(Math.round((completed / n) * 100)),
      uploadPart: async (partNumber) => {
        const blob = file.slice((partNumber - 1) * PART, Math.min(file.size, partNumber * PART));
        const partRes = await fetch(
          `/api/files/mpu?action=part&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          { method: "PUT", body: blob },
        );
        if (!partRes.ok) throw new Error("part failed");
        const uploaded = (await partRes.json()) as { etag?: string; ETag?: string };
        return { partNumber, etag: uploaded.etag || uploaded.ETag || "" };
      },
    });
    const done = await fetch(
      `/api/files/mpu?action=complete&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      },
    );
    if (!done.ok) {
      const err = (await done.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || "complete failed");
    }
    return (await done.json()) as { id?: string };
  } catch (err) {
    if (uploadId) {
      await fetch(`/api/files/mpu?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    throw err;
  }
}

export async function uploadFilesQueued(
  list: FileList | File[],
  folderPath: string,
  onProgress: (p: UploadProgress) => void,
): Promise<string[]> {
  const arr = Array.from(list);
  const ids: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const file = arr[i];
    onProgress({ label: `上传 ${file.name}（${i + 1}/${arr.length}）`, pct: 0 });
    try {
      const uploaded = await uploadOne(file, folderPath, (pct) =>
        onProgress({ label: `上传 ${file.name}（${i + 1}/${arr.length}）`, pct }),
      );
      if (uploaded.id) ids.push(uploaded.id);
    } catch (err) {
      onProgress({
        label: `上传 ${file.name}（${i + 1}/${arr.length}）`,
        pct: 0,
        error: String(err),
      });
      throw err;
    }
  }
  return ids;
}
