ALTER TYPE "public"."dhuku_entry_type" ADD VALUE 'fine';--> statement-breakpoint
ALTER TABLE "dhukus" ADD COLUMN "pot_deduction" numeric(12, 2);