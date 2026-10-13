CREATE TYPE "public"."budget_line_kind" AS ENUM('fixed', 'essential', 'can_cut');--> statement-breakpoint
ALTER TABLE "budget_items" ADD COLUMN "kind" "budget_line_kind";