-- Make specialties global (not university-scoped) for Field Training visibility by specialty only.

-- Consolidate duplicate specialty codes to a single canonical row per code.
WITH canonical AS (
  SELECT DISTINCT ON (code) id, code
  FROM "specialties"
  WHERE code IS NOT NULL
  ORDER BY code, created_at ASC
)
UPDATE "users" u
SET specialty_id = c.id
FROM "specialties" s
JOIN canonical c ON s.code = c.code
WHERE u.specialty_id = s.id
  AND s.id <> c.id;

WITH canonical AS (
  SELECT DISTINCT ON (code) id, code
  FROM "specialties"
  WHERE code IS NOT NULL
  ORDER BY code, created_at ASC
)
UPDATE "field_training_opportunities" o
SET specialty_id = c.id
FROM "specialties" s
JOIN canonical c ON s.code = c.code
WHERE o.specialty_id = s.id
  AND s.id <> c.id;

DELETE FROM "specialties" s
WHERE s.code IS NOT NULL
  AND s.id NOT IN (
    SELECT DISTINCT ON (code) id
    FROM "specialties"
    WHERE code IS NOT NULL
    ORDER BY code, created_at ASC
  );

ALTER TABLE "specialties" DROP CONSTRAINT IF EXISTS "specialties_university_id_fkey";
DROP INDEX IF EXISTS "idx_specialties_university_id";
ALTER TABLE "specialties" DROP COLUMN IF EXISTS "university_id";

CREATE UNIQUE INDEX IF NOT EXISTS "specialties_code_key" ON "specialties"("code");
