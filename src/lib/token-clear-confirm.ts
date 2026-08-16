export const TOKEN_CLEAR_CONFIRM_TITLE = "清除 Token";
export const TOKEN_CLEAR_CONFIRM_MESSAGE =
  "确定清除已配置的 Cloudflare API Token？清除后用量统计将不可用。";

export type TokenClearConfirmChoice = "confirm" | "cancel";

/** Confirm clears the stored token; cancel / dismiss does not. */
export function resolveTokenClearConfirm(choice: TokenClearConfirmChoice): { run: boolean } {
  return { run: choice === "confirm" };
}
