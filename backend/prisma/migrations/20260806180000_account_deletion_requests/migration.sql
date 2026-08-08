-- ACCOUNT-DELETION-COMPLIANCE-001
-- Additive: account deletion *requests* (not immediate hard-delete).
-- Academic / legal / audit records remain; processing is review-based.

CREATE TYPE "account_deletion_request_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'rejected',
    'cancelled'
);

CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "account_deletion_request_status" NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(1000),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "processed_at" TIMESTAMPTZ(6),
    "processed_by_id" UUID,
    "resolution_note" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- One active (pending/processing) request per user.
CREATE UNIQUE INDEX "uq_account_deletion_active_user"
ON "account_deletion_requests"("user_id")
WHERE "status" IN ('pending', 'processing');

CREATE INDEX "idx_account_deletion_requests_user_id"
ON "account_deletion_requests"("user_id");

CREATE INDEX "idx_account_deletion_requests_status"
ON "account_deletion_requests"("status");

CREATE INDEX "idx_account_deletion_requests_requested_at"
ON "account_deletion_requests"("requested_at");
