CREATE TYPE "public"."cushion_entry_kind" AS ENUM('kept', 'overspend', 'adjust');--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'cushion' BEFORE 'dhuku';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'month_settlement' BEFORE 'payback';--> statement-breakpoint
CREATE TABLE "cushion_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "cushion_entry_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cushion_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	CONSTRAINT "cushion_targets_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "month_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "month_settlements_member_id_year_month_unique" UNIQUE("member_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "cushion_entries" ADD CONSTRAINT "cushion_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_entries" ADD CONSTRAINT "cushion_entries_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_targets" ADD CONSTRAINT "cushion_targets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_targets" ADD CONSTRAINT "cushion_targets_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_settlements" ADD CONSTRAINT "month_settlements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_settlements" ADD CONSTRAINT "month_settlements_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;