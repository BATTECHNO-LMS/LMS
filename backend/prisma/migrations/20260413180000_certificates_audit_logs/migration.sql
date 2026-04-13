-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "micro_credential_id" UUID NOT NULL,
    "certificate_no" VARCHAR(80) NOT NULL,
    "verification_code" VARCHAR(64) NOT NULL,
    "qr_code_url" TEXT,
    "status" "certificate_status" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificates_certificate_no_key" ON "certificates"("certificate_no");

CREATE UNIQUE INDEX "certificates_verification_code_key" ON "certificates"("verification_code");

CREATE UNIQUE INDEX "uq_certificates_student_cohort_mc" ON "certificates"("student_id", "cohort_id", "micro_credential_id");

CREATE INDEX "idx_certificates_student_id" ON "certificates"("student_id");

CREATE INDEX "idx_certificates_cohort_id" ON "certificates"("cohort_id");

CREATE INDEX "idx_certificates_micro_credential_id" ON "certificates"("micro_credential_id");

CREATE INDEX "idx_certificates_status" ON "certificates"("status");

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "university_id" UUID,
    "action_type" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

CREATE INDEX "idx_audit_logs_university_id" ON "audit_logs"("university_id");

CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs"("action_type");

CREATE INDEX "idx_audit_logs_entity_type" ON "audit_logs"("entity_type");

CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");
