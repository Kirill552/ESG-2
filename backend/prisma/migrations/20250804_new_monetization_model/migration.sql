-- CreateEnum for new subscription plans
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'TRIAL', 'LITE', 'STANDARD', 'LARGE', 'CBAM_ADDON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new fields to organization_subscriptions table
ALTER TABLE "organization_subscriptions" 
ADD COLUMN IF NOT EXISTS "annual_emissions" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "has_cbam_addon" BOOLEAN DEFAULT false;

-- Update existing enum values (if needed)
-- Note: This might require data migration in production
