CREATE TYPE "public"."activity_action" AS ENUM('archived', 'completed', 'created', 'deleted', 'paid', 'paused', 'restored', 'resumed', 'updated');--> statement-breakpoint
CREATE TYPE "public"."activity_entity_type" AS ENUM('account', 'budget_item', 'category', 'dhuku', 'dhuku_entry', 'expense', 'household_settings', 'income', 'loan', 'loan_payment', 'recurring_expense', 'savings_contribution', 'savings_goal');--> statement-breakpoint
CREATE TYPE "public"."activity_source" AS ENUM('mobile', 'web');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"actor_name" text NOT NULL,
	"entity_type" "activity_entity_type" NOT NULL,
	"entity_id" uuid,
	"action" "activity_action" NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb,
	"source" "activity_source" NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_member_id_household_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_household_created_idx" ON "activity_logs" USING btree ("household_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);