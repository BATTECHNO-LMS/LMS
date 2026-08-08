-- Additive: public trainee registration flag + branch address/order metadata.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "allows_public_trainee_registration" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_organizations_public_reg"
  ON "organizations"("allows_public_trainee_registration");

ALTER TABLE "organization_branches"
  ADD COLUMN IF NOT EXISTS "address" VARCHAR(500);

ALTER TABLE "organization_branches"
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "idx_organization_branches_org_active_sort"
  ON "organization_branches"("organization_id", "is_active", "sort_order");
