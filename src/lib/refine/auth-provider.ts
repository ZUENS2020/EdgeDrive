import type { AuthProvider } from "@refinedev/core";

async function settingsOk(): Promise<boolean> {
  const res = await fetch("/api/settings");
  return res.ok;
}

export const authProvider: AuthProvider = {
  login: async () => ({ success: true, redirectTo: "/admin" }),
  logout: async () => {
    window.location.assign("/cdn-cgi/access/logout");
    return { success: true, redirectTo: "/login" };
  },
  check: async () => {
    if (await settingsOk()) return { authenticated: true };
    return { authenticated: false, redirectTo: "/login", logout: false };
  },
  onError: async (error) => {
    const status = (error as { statusCode?: number; status?: number })?.statusCode
      ?? (error as { status?: number })?.status;
    if (status === 401) return { logout: false, redirectTo: "/login" };
    return {};
  },
  getIdentity: async () => ({ name: "Admin", avatar: undefined }),
};
