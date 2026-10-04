ALTER TABLE "activity_logs" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "after" jsonb;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "related" jsonb;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "revert_of_id" uuid;