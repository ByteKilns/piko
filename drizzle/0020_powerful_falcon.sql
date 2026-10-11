CREATE TYPE "public"."savings_deposit_kind" AS ENUM('deposit', 'opening', 'interest');--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'savings_deposit' BEFORE 'savings_goal';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'savings_item';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'savings_pot';--> statement-breakpoint
CREATE TABLE "savings_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"kind" "savings_deposit_kind" DEFAULT 'deposit' NOT NULL,
	"member_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"position" integer NOT NULL,
	"needed_by" date,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_pot_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "savings_pot_plans_pot_id_member_id_unique" UNIQUE("pot_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "savings_pots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_member_id" uuid,
	"name" text NOT NULL,
	"held_by_member_id" uuid,
	"reserve_minimum" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "savings_pots_household_id_owner_member_id_unique" UNIQUE("household_id","owner_member_id")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "savings_pot_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "savings_item_id" uuid;--> statement-breakpoint
ALTER TABLE "savings_deposits" ADD CONSTRAINT "savings_deposits_pot_id_savings_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."savings_pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_deposits" ADD CONSTRAINT "savings_deposits_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_items" ADD CONSTRAINT "savings_items_pot_id_savings_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."savings_pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pot_plans" ADD CONSTRAINT "savings_pot_plans_pot_id_savings_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."savings_pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pot_plans" ADD CONSTRAINT "savings_pot_plans_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pots" ADD CONSTRAINT "savings_pots_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pots" ADD CONSTRAINT "savings_pots_owner_member_id_household_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_pots" ADD CONSTRAINT "savings_pots_held_by_member_id_household_members_id_fk" FOREIGN KEY ("held_by_member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "savings_pots_one_shared" ON "savings_pots" USING btree ("household_id") WHERE "savings_pots"."owner_member_id" is null;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_savings_pot_id_savings_pots_id_fk" FOREIGN KEY ("savings_pot_id") REFERENCES "public"."savings_pots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_savings_item_id_savings_items_id_fk" FOREIGN KEY ("savings_item_id") REFERENCES "public"."savings_items"("id") ON DELETE set null ON UPDATE no action;