export const FOLDER_DELETE_CONFIRM_TITLE = "删除文件夹";

export function folderDeleteConfirmMessage(name: string): string {
  return `确定删除文件夹「${name}」及其中的所有文件？此操作无法撤销。`;
}

export type FolderDeleteConfirmChoice = "confirm" | "cancel";

/** Confirm runs folder delete; cancel / dismiss does not. */
export function resolveFolderDeleteConfirm(choice: FolderDeleteConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
