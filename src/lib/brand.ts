export function applyBrandColor(color: string) {
  if (typeof document === "undefined") return;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
  const apply = (el: HTMLElement) => {
    el.style.setProperty("--brand", color);
    el.style.setProperty("--accent", color);
    el.style.setProperty("--accent-h", color);
    el.style.setProperty("--primary", color);
    el.style.setProperty("--ring", color);
    el.style.setProperty("--sidebar-primary", color);
  };
  apply(document.documentElement);
  const root = document.querySelector(".admin-root");
  if (root instanceof HTMLElement) apply(root);
}
