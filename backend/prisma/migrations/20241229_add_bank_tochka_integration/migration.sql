-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PLAN_PURCHASE', 'OVERAGE_PAYMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum  
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "bankInvoiceId" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "planType" "PlanType",
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerInn" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "paymentUrl" TEXT,
    "qrCodeUrl" TEXT,
    "pdfUrl" TEXT,
    "description" TEXT NOT NULL,
    "estimatedEmissions" DECIMAL(12,3),
    "excessEmissions" DECIMAL(12,3),
    "ratePerTon" DECIMAL(8,2),
    "expirationDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_overage_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "bankInvoiceId" TEXT NOT NULL,
    "excessEmissions" DECIMAL(12,3) NOT NULL,
    "ratePerTon" DECIMAL(8,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emission_overage_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_clerkUserId_key" ON "organizations"("clerkUserId");

-- CreateIndex  
CREATE UNIQUE INDEX "organizations_inn_key" ON "organizations"("inn");

-- CreateIndex
CREATE UNIQUE INDEX "bank_invoices_invoiceNumber_key" ON "bank_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bank_invoices_bankInvoiceId_key" ON "bank_invoices"("bankInvoiceId");

-- CreateIndex
CREATE INDEX "bank_invoices_organizationId_idx" ON "bank_invoices"("organizationId");

-- CreateIndex
CREATE INDEX "bank_invoices_status_idx" ON "bank_invoices"("status");

-- CreateIndex
CREATE INDEX "bank_invoices_invoiceType_idx" ON "bank_invoices"("invoiceType");

-- CreateIndex
CREATE INDEX "bank_invoices_createdAt_idx" ON "bank_invoices"("createdAt");

-- CreateIndex
CREATE INDEX "emission_overage_payments_organizationId_idx" ON "emission_overage_payments"("organizationId");

-- CreateIndex
CREATE INDEX "emission_overage_payments_reportId_idx" ON "emission_overage_payments"("reportId");

-- CreateIndex
CREATE INDEX "emission_overage_payments_status_idx" ON "emission_overage_payments"("status");

-- AddForeignKey
ALTER TABLE "organization_credits" ADD CONSTRAINT "organization_credits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_invoices" ADD CONSTRAINT "bank_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_overage_payments" ADD CONSTRAINT "emission_overage_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_overage_payments" ADD CONSTRAINT "emission_overage_payments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_overage_payments" ADD CONSTRAINT "emission_overage_payments_bankInvoiceId_fkey" FOREIGN KEY ("bankInvoiceId") REFERENCES "bank_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update audit_logs table
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "metadata" JSONB;
ALTER TABLE "audit_logs" ALTER COLUMN "resource" DROP NOT NULL;

-- Create indices for audit_logs
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
