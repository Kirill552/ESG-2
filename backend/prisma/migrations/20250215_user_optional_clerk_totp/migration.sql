ALTER TABLE "public"."users"
  ALTER COLUMN "clerkId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;

-- safe unique: in postgres unique allows multiple NULLs, so keep index as is

