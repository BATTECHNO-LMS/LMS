-- Additive only: MFA (TOTP) factors, hashed recovery codes, pre-session MFA challenges,
-- and server-side assurance columns on auth_sessions. No DROP / TRUNCATE / data rewrite.

-- AlterTable
ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "authentication_level" VARCHAR(16) NOT NULL DEFAULT 'PASSWORD',
  ADD COLUMN IF NOT EXISTS "mfa_verified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_mfa_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL DEFAULT 'TOTP',
    "secret_encrypted" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(6),
    "enabled_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "disabled_reason" VARCHAR(32),
    "last_used_at" TIMESTAMPTZ(6),
    "last_used_step" BIGINT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "user_mfa_methods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_user_mfa_methods_user_enabled" ON "user_mfa_methods"("user_id", "enabled_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_user_mfa_recovery_codes_user_used" ON "user_mfa_recovery_codes"("user_id", "used_at");
CREATE INDEX IF NOT EXISTS "idx_user_mfa_recovery_codes_user_hash" ON "user_mfa_recovery_codes"("user_id", "code_hash");

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_mfa_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "portal_type" VARCHAR(32),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_request_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_mfa_challenges_token_hash_key" ON "auth_mfa_challenges"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_auth_mfa_challenges_user_created" ON "auth_mfa_challenges"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_auth_mfa_challenges_expires" ON "auth_mfa_challenges"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_mfa_methods_user_id_fkey') THEN
    ALTER TABLE "user_mfa_methods"
      ADD CONSTRAINT "user_mfa_methods_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_mfa_recovery_codes_user_id_fkey') THEN
    ALTER TABLE "user_mfa_recovery_codes"
      ADD CONSTRAINT "user_mfa_recovery_codes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_mfa_challenges_user_id_fkey') THEN
    ALTER TABLE "auth_mfa_challenges"
      ADD CONSTRAINT "auth_mfa_challenges_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
