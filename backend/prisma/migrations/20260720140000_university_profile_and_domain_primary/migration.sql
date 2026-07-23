-- Extend universities with bilingual profile / location / branding fields (nullable for legacy rows).
ALTER TABLE "universities"
  ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "short_name" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "website" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "country" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "address" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(1000);

-- Unique university code when set (PostgreSQL treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_universities_code"
  ON "universities" ("code");

CREATE INDEX IF NOT EXISTS "idx_universities_code"
  ON "universities" ("code");

CREATE INDEX IF NOT EXISTS "idx_universities_short_name"
  ON "universities" ("short_name");

-- Optional primary domain flag per university email domain.
ALTER TABLE "university_email_domains"
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "universities"."name_en" IS 'English university name; Arabic display name remains universities.name';
COMMENT ON COLUMN "universities"."code" IS 'Unique university code when set; null allowed for legacy rows';
COMMENT ON COLUMN "university_email_domains"."is_primary" IS 'Preferred domain for the university; at most one should be primary among active domains';
