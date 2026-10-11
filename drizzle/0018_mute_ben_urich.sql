ALTER TYPE "public"."activity_entity_type" ADD VALUE 'payback' BEFORE 'recurring_expense';--> statement-breakpoint
CREATE TABLE "paybacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"from_member_id" uuid NOT NULL,
	"to_member_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "pay_back_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "paybacks" ADD CONSTRAINT "paybacks_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paybacks" ADD CONSTRAINT "paybacks_from_member_id_household_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paybacks" ADD CONSTRAINT "paybacks_to_member_id_household_members_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;