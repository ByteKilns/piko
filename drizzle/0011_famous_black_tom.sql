CREATE TABLE "app_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_code" integer NOT NULL,
	"version_name" text NOT NULL,
	"notes" text,
	"apk_url" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_releases_version_code_unique" UNIQUE("version_code")
);
