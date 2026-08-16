import { DEFAULT_LOCALE, t, type Locale } from "./i18n";

export function purgeConfirmTitle(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "settings.purgeConfirmTitle");
}

export function purgeConfirmMessage(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "settings.purgeConfirmMessage");
}

export const PURGE_CONFIRM_TITLE = purgeConfirmTitle();
export const PURGE_CONFIRM_MESSAGE = purgeConfirmMessage();

export type PurgeConfirmChoice = "confirm" | "cancel";

/** Confirm runs purge; cancel / dismiss does not. */
export function resolvePurgeConfirm(choice: PurgeConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
