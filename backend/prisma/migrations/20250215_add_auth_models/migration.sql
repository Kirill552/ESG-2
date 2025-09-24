-- Auth models for sessions/accounts/verification tokens/otp

CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key"
    ON "accounts" ("provider", "providerAccountId");

CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts" ("userId");

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT PRIMARY KEY,
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions" ("userId");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" ("expires");

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key"
    ON "verification_tokens" ("identifier", "token");


CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id" TEXT PRIMARY KEY,
    "contact" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "otp_codes_contact_idx" ON "otp_codes" ("contact");
CREATE INDEX IF NOT EXISTS "otp_codes_expiresAt_idx" ON "otp_codes" ("expiresAt");


