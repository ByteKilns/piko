import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Android APK builds published from Settings → App updates. Global, not
// per-household: every install of the mobile app checks the latest row.
export const appReleases = pgTable("app_releases", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Android versionCode (the "+N" build number in pubspec.yaml). Android
  // refuses to install an update whose versionCode isn't higher, so this is
  // what the app compares against — unique so "latest" is unambiguous.
  versionCode: integer("version_code").notNull().unique(),
  versionName: text("version_name").notNull(),
  notes: text("notes"),
  apkUrl: text("apk_url").notNull(),
  // Lets the app verify the download before handing it to the installer.
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
