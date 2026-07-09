-- Phase 2: Correct overly broad eligibility backfill from the initial migration.
-- Rule: never auto-expose specialty-only opportunities to all universities.

-- 1) Legacy opportunities without university_id: deactivate all auto-generated eligibility.
UPDATE "field_training_opportunity_eligibility" e
SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
FROM "field_training_opportunities" o
WHERE e."opportunity_id" = o."id"
  AND o."university_id" IS NULL;

-- 2) University-scoped opportunities: deactivate eligibility rows for other universities.
UPDATE "field_training_opportunity_eligibility" e
SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
FROM "field_training_opportunities" o
WHERE e."opportunity_id" = o."id"
  AND o."university_id" IS NOT NULL
  AND e."university_id" <> o."university_id";

-- 3) Safe backfill: only for opportunities with both university_id and specialty_id.
INSERT INTO "field_training_opportunity_eligibility" (
    "opportunity_id",
    "university_id",
    "university_specialty_id",
    "canonical_specialty_id",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    o."id",
    o."university_id",
    us."id",
    us."specialty_id",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "field_training_opportunities" o
INNER JOIN "university_specialties" us
    ON us."university_id" = o."university_id"
    AND us."specialty_id" = o."specialty_id"
    AND us."status" = 'active'
WHERE o."university_id" IS NOT NULL
  AND o."specialty_id" IS NOT NULL
ON CONFLICT ("opportunity_id", "university_id", "university_specialty_id") DO UPDATE
SET
    "is_active" = true,
    "canonical_specialty_id" = EXCLUDED."canonical_specialty_id",
    "updated_at" = CURRENT_TIMESTAMP;
