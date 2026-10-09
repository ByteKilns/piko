import { z } from "zod";

// Client-side resizing keeps this small (~160px JPEG), but cap it server-side
// too so a bad client can't push an arbitrarily large blob into the DB.
const MAX_DATA_URL_LENGTH = 500_000;

export const profileImageSchema = z
  .string()
  .startsWith("data:image/")
  .max(MAX_DATA_URL_LENGTH)
  .nullable();

export type ProfileImageInput = z.infer<typeof profileImageSchema>;
