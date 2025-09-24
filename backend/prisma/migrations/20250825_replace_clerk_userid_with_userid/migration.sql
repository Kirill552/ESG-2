-- Migration: Replace clerkUserId with userId in organizations table
-- Date: 2025-08-25
-- Reason: Remove Clerk references and use NextAuth user.id instead

-- Step 1: Add new userId column
ALTER TABLE "organizations" ADD COLUMN "userId" TEXT;

-- Step 2: Create index on new userId column  
CREATE INDEX "organizations_userId_idx" ON "organizations"("userId");

-- Step 3: Copy data from clerkUserId to userId (for existing records)
UPDATE "organizations" SET "userId" = "clerkUserId" WHERE "clerkUserId" IS NOT NULL;

-- Step 4: Make userId column NOT NULL after data migration
ALTER TABLE "organizations" ALTER COLUMN "userId" SET NOT NULL;

-- Step 5: Add unique constraint on userId
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_unique" UNIQUE ("userId");

-- Step 6: Drop old clerkUserId constraint and index
DROP INDEX IF EXISTS "organizations_clerkUserId_key";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_clerkUserId_key";

-- Step 7: Drop old clerkUserId column
ALTER TABLE "organizations" DROP COLUMN "clerkUserId";

-- Step 8: Add foreign key constraint to users table
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;