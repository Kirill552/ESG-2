-- Add missing isBlocked column to organizations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'isBlocked'
  ) THEN
    EXECUTE 'ALTER TABLE public."organizations" ADD COLUMN "isBlocked" boolean NOT NULL DEFAULT false';
  END IF;
END $$;

