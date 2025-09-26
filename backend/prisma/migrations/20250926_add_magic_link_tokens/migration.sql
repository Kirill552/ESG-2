-- Magic link tokens storage for email authentication

CREATE TYPE "MagicLinkDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailHash" CHAR(64) NOT NULL,
    "userId" TEXT,
    "tokenHash" CHAR(64) NOT NULL,
    "redirectTo" TEXT,
    "requestedIp" TEXT,
    "consumedIp" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "deliveryStatus" "MagicLinkDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "magic_link_tokens_tokenHash_key"
    ON "magic_link_tokens" ("tokenHash");

CREATE INDEX IF NOT EXISTS "magic_link_tokens_emailHash_expiresAt_idx"
    ON "magic_link_tokens" ("emailHash", "expiresAt");

CREATE INDEX IF NOT EXISTS "magic_link_tokens_requestedIp_createdAt_idx"
    ON "magic_link_tokens" ("requestedIp", "createdAt");

ALTER TABLE "magic_link_tokens"
    ADD CONSTRAINT "magic_link_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
