-- Create admin_webauthn_credentials table and index/constraints
CREATE TABLE IF NOT EXISTS "admin_webauthn_credentials" (
  "id" TEXT PRIMARY KEY,
  "adminId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL UNIQUE,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "admin_webauthn_credentials_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "admin_webauthn_credentials_adminId_idx" ON "admin_webauthn_credentials" ("adminId");
CREATE INDEX IF NOT EXISTS "admin_webauthn_credentials_credentialId_idx" ON "admin_webauthn_credentials" ("credentialId");
