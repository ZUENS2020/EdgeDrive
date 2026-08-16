export const PURGE_CONFIRM_TITLE = "立即清理过期文件";
export const PURGE_CONFIRM_MESSAGE = "确定立即清理所有过期文件？此操作不可撤销";

export type PurgeConfirmChoice = "confirm" | "cancel";

/** Confirm runs purge; cancel / dismiss does not. */
export function resolvePurgeConfirm(choice: PurgeConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
