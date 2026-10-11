DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "savings_contributions") OR EXISTS (SELECT 1 FROM "savings_goals") THEN
    RAISE EXCEPTION 'savings_goals or savings_contributions still has rows. Move or delete them before running this migration.';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE "savings_contributions" CASCADE;--> statement-breakpoint
DROP TABLE "savings_goals" CASCADE;