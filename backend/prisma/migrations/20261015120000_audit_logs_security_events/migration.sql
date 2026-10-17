-- Security Phase 1A: security events live in audit_logs (additive, nullable, no backfill).
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "security_category" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "severity" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_security_created" ON "audit_logs"("security_category", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_ip_created" ON "audit_logs"("ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_request_id" ON "audit_logs"("request_id");
