CREATE TYPE "public"."capture_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."capture_status" AS ENUM('draft', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TABLE "capture_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"source" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"posted_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_events_member_id_key_posted_at_unique" UNIQUE("member_id","key","posted_at")
);
--> statement-breakpoint
CREATE TABLE "capture_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"counterparty" text NOT NULL,
	"category_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_rules_member_id_counterparty_unique" UNIQUE("member_id","counterparty")
);
--> statement-breakpoint
CREATE TABLE "captured_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "capture_status" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" "capture_direction" NOT NULL,
	"kind" text NOT NULL,
	"counterparty" text,
	"ref_id" text,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"source" text NOT NULL,
	"raw_text" text NOT NULL,
	"category" text NOT NULL,
	"category_confidence" double precision NOT NULL,
	"expense_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captured_payments_member_occurred_idx" ON "captured_payments" USING btree ("member_id","occurred_at");