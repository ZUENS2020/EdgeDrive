import { createSHA256 } from "hash-wasm";

type HashRequest = { id: string; file: File };

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, file } = event.data;
  try {
    const hash = await createSHA256();
    hash.init();
    const chunkSize = 4 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      hash.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
      self.postMessage({ id, progress: file.size ? Math.min(1, (offset + chunkSize) / file.size) : 1 });
    }
    self.postMessage({ id, digest: hash.digest("hex"), progress: 1 });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
