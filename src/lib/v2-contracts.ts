import { z } from "zod";

export const themeIdSchema = z.enum(["onyx", "porcelain", "nocturne"]);
export type ThemeId = z.infer<typeof themeIdSchema>;

export const localeSchema = z.enum(["zh", "en"]);
export type AppLocale = z.infer<typeof localeSchema>;

export const fileScopeSchema = z.enum(["all", "folder", "starred", "recent", "expired", "expiring", "trash"]);
export type FileScope = z.infer<typeof fileScopeSchema>;

export const fileDtoSchema = z.object({
  id: z.string(),
  blobId: z.string(),
  folderId: z.string().nullable(),
  name: z.string(),
  mime: z.string().nullable(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  expiresAt: z.string().nullable(),
  downloadCount: z.number().int().nonnegative(),
  starred: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  expired: z.boolean(),
  contentUrl: z.string(),
  previewUrl: z.string(),
});
export type FileDto = z.infer<typeof fileDtoSchema>;

export const folderDtoSchema: z.ZodType<FolderDto> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    name: z.string(),
    path: z.string(),
    deletedAt: z.string().nullable(),
    children: z.array(folderDtoSchema),
  }),
);
export type FolderDto = {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  deletedAt: string | null;
  children: FolderDto[];
};

export const appSettingsSchema = z.object({
  themeName: themeIdSchema,
  language: localeSchema,
  pageSize: z.number().int().min(10).max(100),
  defaultExpires: z.string(),
  expiredRetentionDays: z.number().int().min(0).max(3650),
  trashRetentionDays: z.number().int().min(1).max(3650),
  accessEnabled: z.boolean(),
  cfAccessTeam: z.string(),
  cfAccessAud: z.string(),
  cronSecretSet: z.boolean(),
});
export type AppSettingsDto = z.infer<typeof appSettingsSchema>;

export const settingsPatchSchema = z.object({
  themeName: themeIdSchema.optional(),
  language: localeSchema.optional(),
  pageSize: z.coerce.number().int().min(10).max(100).optional(),
  defaultExpires: z.enum(["permanent", "24h", "7d", "30d"]).optional(),
  expiredRetentionDays: z.coerce.number().int().min(0).max(3650).optional(),
  trashRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
  rotateCronSecret: z.boolean().optional(),
});

export const prepareUploadSchema = z.object({
  folderId: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(255).nullable().default(null),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).transform((value) => value.toLowerCase()),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const filePatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const batchActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("trash"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("restore"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("purge"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("move"), ids: z.array(z.string().uuid()).min(1).max(100), folderId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("copy"), ids: z.array(z.string().uuid()).min(1).max(100), folderId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("star"), ids: z.array(z.string().uuid()).min(1).max(100), starred: z.boolean() }),
  z.object({ action: z.literal("expire"), ids: z.array(z.string().uuid()).min(1).max(100), expiresAt: z.string().datetime().nullable() }),
]);

export const shareCreateSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(100),
  password: z.string().trim().min(1).max(128).nullable().optional(),
  maxDownloads: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  allowDownload: z.boolean().default(true),
  allowPreview: z.boolean().default(true),
}).refine((value) => value.allowDownload || value.allowPreview, {
  message: "need-download-or-preview",
  path: ["allowDownload"],
});

export const sharePatchSchema = z.object({
  password: z.string().trim().min(1).max(128).nullable().optional(),
  maxDownloads: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  revoked: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  allowPreview: z.boolean().optional(),
});

export type ApiErrorBody = { error: { code: string; message: string; field?: string } };
export type ApiListMeta = { total: number; nextCursor: string | null };
export type ApiListResponse<T> = { data: T[]; meta: ApiListMeta };

export type OverviewDto = {
  files: number;
  folders: number;
  logicalBytes: number;
  physicalBytes: number;
  savedBytes: number;
  downloads: number;
  expiring: number;
  expired: number;
  trash: number;
  activeShares: number;
};

export type ShareStatus = "active" | "revoked" | "expired" | "exhausted";
export type ShareDto = {
  token: string;
  kind: "file" | "batch";
  fileIds: string[];
  label: string;
  hasPassword: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  allowDownload: boolean;
  allowPreview: boolean;
  downloadUrl: string;
  previewUrl: string;
  status: ShareStatus;
};
