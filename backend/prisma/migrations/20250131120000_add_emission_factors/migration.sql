-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(6) NOT NULL,
    "effectiveTo" TIMESTAMP(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "coefficients" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_version_key" ON "emission_factors"("version");

-- CreateIndex
CREATE INDEX "emission_factors_effectiveFrom_idx" ON "emission_factors"("effectiveFrom");

-- CreateIndex
CREATE INDEX "emission_factors_effectiveTo_idx" ON "emission_factors"("effectiveTo");

-- CreateIndex
CREATE INDEX "emission_factors_isActive_idx" ON "emission_factors"("isActive");

-- CreateIndex
CREATE INDEX "emission_factors_version_idx" ON "emission_factors"("version");
