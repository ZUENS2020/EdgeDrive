import { getCloudflareContext } from "@opennextjs/cloudflare";
import { incrementShareDownload, incrementShareFileCount } from "./share";
import { incrementDownload } from "./store";
import { getDB } from "./cloudflare";

export { shouldCountDownload } from "./download-policy";

async function scheduleBackground(work: Promise<unknown>, label: string): Promise<void> {
  const wrapped = Promise.resolve(work).catch((err) => {
    console.error(label, err);
  });
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(wrapped);
      return;
    }
  } catch {
    // next dev / 无 Worker 上下文
  }
  void wrapped;
}

/** 计数不阻塞下载响应。Workers 上走 waitUntil，避免 isolate 回收丢掉写入。 */
export async function scheduleDownloadIncrement(id: string): Promise<void> {
  await scheduleBackground(incrementDownload(id), "incrementDownload failed");
}

export async function scheduleShareDownloadIncrement(token: string): Promise<void> {
  await scheduleBackground(
    getDB().then((db) => incrementShareDownload(db, token)),
    "incrementShareDownload failed",
  );
}

export async function scheduleShareFileCountIncrement(token: string, fileId: string): Promise<void> {
  await scheduleBackground(
    getDB().then((db) => incrementShareFileCount(db, token, fileId)),
    "incrementShareFileCount failed",
  );
}
