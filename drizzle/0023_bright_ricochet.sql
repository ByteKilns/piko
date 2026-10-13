CREATE TYPE "public"."income_kind" AS ENUM('pay', 'extra');--> statement-breakpoint
ALTER TABLE "incomes" DROP CONSTRAINT "incomes_member_id_year_month_unique";--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "kind" "income_kind" DEFAULT 'pay' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "incomes_one_pay" ON "incomes" USING btree ("member_id","year","month") WHERE "incomes"."kind" = 'pay';