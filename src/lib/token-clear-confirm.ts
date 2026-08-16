import { DEFAULT_LOCALE, t, type Locale } from "./i18n";

export function tokenClearConfirmTitle(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "settings.tokenClearTitle");
}

export function tokenClearConfirmMessage(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "settings.tokenClearMessage");
}

export const TOKEN_CLEAR_CONFIRM_TITLE = tokenClearConfirmTitle();
export const TOKEN_CLEAR_CONFIRM_MESSAGE = tokenClearConfirmMessage();

export type TokenClearConfirmChoice = "confirm" | "cancel";

/** Confirm clears the stored token; cancel / dismiss does not. */
export function resolveTokenClearConfirm(choice: TokenClearConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
