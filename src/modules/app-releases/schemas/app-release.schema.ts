import { z } from "zod";

// Only accept files that landed in our own Vercel Blob store.
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export const MAX_APK_SIZE_BYTES = 200 * 1024 * 1024;

export const appReleaseSchema = z.object({
  apkUrl: z
    .url()
    .refine((value) => new URL(value).hostname.endsWith(BLOB_HOST_SUFFIX), "APK must be uploaded to Blob storage"),
  notes: z.string().trim().max(2000).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Invalid SHA-256 hash"),
  sizeBytes: z.number().int().positive().max(MAX_APK_SIZE_BYTES),
  // The app strips Flutter's split-per-abi prefix with `% 1000`, so build
  // numbers have to stay below 1000.
  versionCode: z.number().int().positive().max(999),
  versionName: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, "Use the form 1.2.3"),
});

export type AppReleaseInput = z.infer<typeof appReleaseSchema>;
