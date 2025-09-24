-- Migration: Replace clerkUserId with userId in organizations table (without FK constraints)
-- Date: 2025-08-25
-- Reason: Remove Clerk references and use NextAuth user.id instead

-- Step 1: Add new userId column (nullable for now)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Step 2: Create index on new userId column  
CREATE INDEX IF NOT EXISTS "organizations_userId_idx" ON "organizations"("userId");

-- Step 3: Copy data from clerkUserId to userId (for existing records)
UPDATE "organizations" SET "userId" = "clerkUserId" WHERE "clerkUserId" IS NOT NULL AND "userId" IS NULL;

-- Step 4: Drop old clerkUserId constraint and index
DROP INDEX IF EXISTS "organizations_clerkUserId_key";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_clerkUserId_key";

-- Step 5: Drop old clerkUserId column
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "clerkUserId";

-- Step 6: Make userId column NOT NULL after data migration and constraint cleanup
ALTER TABLE "organizations" ALTER COLUMN "userId" SET NOT NULL;

-- Step 7: Add unique constraint on userId
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_unique" UNIQUE ("userId");

-- We skip FK constraint to avoid conflicts during migration
-- FK constraint will be added later via Prisma schema