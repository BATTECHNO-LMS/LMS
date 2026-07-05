-- Email verification OTP layer for student registration
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "idx_users_email_verified_at" ON "users"("email_verified_at");

CREATE TABLE IF NOT EXISTS "email_verification_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_email_verification_otps_user_id" ON "email_verification_otps"("user_id");
CREATE INDEX IF NOT EXISTS "idx_email_verification_otps_email" ON "email_verification_otps"("email");
CREATE INDEX IF NOT EXISTS "idx_email_verification_otps_expires_at" ON "email_verification_otps"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verification_otps_user_id_fkey'
  ) THEN
    ALTER TABLE "email_verification_otps"
      ADD CONSTRAINT "email_verification_otps_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- Existing accounts are treated as already verified (admin-created / legacy seed).
UPDATE "users" SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
WHERE "email_verified_at" IS NULL;
