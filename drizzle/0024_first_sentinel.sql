ALTER TYPE "public"."activity_entity_type" ADD VALUE 'fund' BEFORE 'household_settings';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'fund_top_up' BEFORE 'household_settings';--> statement-breakpoint
CREATE TABLE "fund_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"from_year" integer NOT NULL,
	"from_month" integer NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "fund_plans_fund_id_from_year_from_month_unique" UNIQUE("fund_id","from_year","from_month")
);
--> statement-breakpoint
CREATE TABLE "fund_top_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" numeric(12, 2),
	"due_year" integer,
	"due_month" integer,
	"start_year" integer NOT NULL,
	"start_month" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fund_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fund_plans" ADD CONSTRAINT "fund_plans_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_top_ups" ADD CONSTRAINT "fund_top_ups_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_owner_member_id_household_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE set null ON UPDATE no action;