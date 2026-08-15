import { getCloudflareContext } from "@opennextjs/cloudflare";
import { incrementDownload } from "./store";

export { shouldCountDownload } from "./download-policy";

/** 计数不阻塞下载响应。Workers 上走 waitUntil，避免 isolate 回收丢掉写入。 */
export async function scheduleDownloadIncrement(id: string): Promise<void> {
  const work = incrementDownload(id).catch((err) => {
    console.error("incrementDownload failed", err);
  });
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(work);
      return;
    }
  } catch {
    // next dev / 无 Worker 上下文
  }
  void work;
}
