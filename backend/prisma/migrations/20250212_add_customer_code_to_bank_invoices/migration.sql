-- Add customerCode column to bank_invoices
ALTER TABLE "bank_invoices" ADD COLUMN "customerCode" TEXT;
CREATE INDEX IF NOT EXISTS "bank_invoices_customerCode_idx" ON "bank_invoices"("customerCode");
