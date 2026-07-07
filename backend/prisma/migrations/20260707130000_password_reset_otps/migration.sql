-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_email" ON "password_reset_otps"("email");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_user_id" ON "password_reset_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_expires_at" ON "password_reset_otps"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_reset_token_hash" ON "password_reset_otps"("reset_token_hash");

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
