-- Drop credit-related tables and enum safely if exist
DO $$ BEGIN
  -- organization_credit_transactions depends on organization_credits
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_credit_transactions') THEN
    EXECUTE 'DROP TABLE IF EXISTS public.organization_credit_transactions CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_credits') THEN
    EXECUTE 'DROP TABLE IF EXISTS public.organization_credits CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_transactions') THEN
    EXECUTE 'DROP TABLE IF EXISTS public.credit_transactions CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credits') THEN
    EXECUTE 'DROP TABLE IF EXISTS public.credits CASCADE';
  END IF;

  -- Drop enum CreditTransactionType if exists
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'CreditTransactionType' OR t.typname='credittransactiontype') THEN
    EXECUTE 'DROP TYPE IF EXISTS "CreditTransactionType"';
  END IF;
END $$;

-- Vacuum analyze can be run separately by DBA

