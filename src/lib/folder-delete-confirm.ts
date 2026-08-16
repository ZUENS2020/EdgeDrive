import { DEFAULT_LOCALE, t, type Locale } from "./i18n";

export function folderDeleteConfirmTitle(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "fileManager.folderDeleteTitle");
}

export function folderDeleteConfirmMessage(name: string, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "fileManager.folderDeleteBody", { name });
}

export const FOLDER_DELETE_CONFIRM_TITLE = folderDeleteConfirmTitle();

export type FolderDeleteConfirmChoice = "confirm" | "cancel";

/** Confirm runs folder delete; cancel / dismiss does not. */
export function resolveFolderDeleteConfirm(choice: FolderDeleteConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
