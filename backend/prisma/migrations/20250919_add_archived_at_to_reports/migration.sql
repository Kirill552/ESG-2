-- Add archivedAt column for soft-delete of signed reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Optional index to speed up filtered lists
CREATE INDEX IF NOT EXISTS "reports_archived_idx" ON "reports" ("archivedAt");
