import type { DataProvider, HttpError } from "@refinedev/core";
import type { FileView, FolderNode, SiteSettings, StatsPayload } from "@/lib/types";

function httpError(status: number, message: string): HttpError {
  return { statusCode: status, message, name: "HttpError" };
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) throw httpError(401, "unauthorized");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw httpError(res.status, body.error || res.statusText);
  }
  return (await res.json()) as T;
}

function filterValue(filters: { field?: string; value?: unknown }[] | undefined, field: string): string | undefined {
  const hit = filters?.find((f) => f.field === field);
  return hit?.value == null ? undefined : String(hit.value);
}

export const dataProvider = {
  getApiUrl: () => "/api",

  getList: async ({ resource, pagination, filters }) => {
    if (resource === "files") {
      const params = new URLSearchParams();
      const q = filterValue(filters, "q");
      const path = filterValue(filters, "path");
      const filter = filterValue(filters, "filter") || "all";
      const tag = filterValue(filters, "tag");
      if (q) params.set("q", q);
      else if (path != null && path !== "__all__") params.set("path", path === "__root__" ? "" : path);
      params.set("filter", filter);
      if (tag) params.set("tag", tag);
      params.set("page", String(pagination?.currentPage ?? 1));
      params.set("pageSize", String(pagination?.pageSize ?? 50));
      const data = await json<{ files: FileView[]; total: number }>(await fetch(`/api/files?${params}`));
      return { data: data.files || [], total: data.total || 0 };
    }
    if (resource === "folders") {
      const data = await json<{ folders: FolderNode[] }>(await fetch("/api/folders"));
      return { data: data.folders || [], total: (data.folders || []).length };
    }
    return { data: [], total: 0 };
  },

  getOne: async ({ resource, id }) => {
    if (resource === "settings") {
      const data = await json<{ settings: SiteSettings }>(await fetch("/api/settings"));
      return { data: { id: "site", ...data.settings } };
    }
    if (resource === "stats") {
      const data = await json<StatsPayload>(await fetch("/api/stats"));
      return { data: { id: "stats", ...data } };
    }
    return { data: { id } };
  },

  create: async ({ resource, variables }) => {
    if (resource === "folders") {
      const body = variables as { name?: string; parent_id?: string };
      const data = await json<{ folder: FolderNode }>(
        await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      return { data: data.folder };
    }
    return { data: variables as never };
  },

  update: async ({ resource, id, variables }) => {
    if (resource === "files") {
      const data = await json<Record<string, unknown>>(
        await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...variables }),
        }),
      );
      return { data: { id, ...data } };
    }
    if (resource === "folders") {
      const data = await json<Record<string, unknown>>(
        await fetch("/api/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...variables }),
        }),
      );
      return { data: { id, ...data } };
    }
    if (resource === "settings") {
      const data = await json<{ settings: SiteSettings }>(
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variables),
        }),
      );
      return { data: { id: "site", ...data.settings } };
    }
    return { data: { id, ...(variables as object) } };
  },

  updateMany: async ({ resource, ids, variables }) => {
    if (resource === "files") {
      const data = await json<Record<string, unknown>>(
        await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, ...variables }),
        }),
      );
      return { data: ids.map((id) => ({ id, ...data })) };
    }
    return { data: ids.map((id) => ({ id })) };
  },

  deleteOne: async ({ resource, id }) => {
    if (resource === "files") {
      await json(
        await fetch("/api/files/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id], action: "delete" }),
        }),
      );
      return { data: { id } };
    }
    if (resource === "folders") {
      await json(await fetch(`/api/folders?id=${encodeURIComponent(String(id))}`, { method: "DELETE" }));
      return { data: { id } };
    }
    return { data: { id } };
  },

  deleteMany: async ({ resource, ids }) => {
    if (resource === "files") {
      await json(
        await fetch("/api/files/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action: "delete" }),
        }),
      );
    }
    return { data: ids.map((id) => ({ id })) };
  },

  custom: async ({ url, method, payload }) => {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: payload != null ? { "Content-Type": "application/json" } : undefined,
      body: payload != null ? JSON.stringify(payload) : undefined,
    });
    const data = await json<Record<string, unknown>>(res);
    return { data };
  },
} as DataProvider;
