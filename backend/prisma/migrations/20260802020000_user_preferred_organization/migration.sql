-- Preferred organization for multi-assignment session selection (additive)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_organization_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_users_preferred_organization_id" ON "users"("preferred_organization_id");
