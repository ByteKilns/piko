ALTER TYPE "public"."recurring_frequency" ADD VALUE 'quarterly' BEFORE 'yearly';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "dhukus" ADD COLUMN "completed_at" timestamp;