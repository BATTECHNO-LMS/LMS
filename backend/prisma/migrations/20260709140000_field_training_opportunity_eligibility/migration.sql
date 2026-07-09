-- Field training opportunity eligibility: university + university-specialty scoped visibility.

CREATE TABLE "field_training_opportunity_eligibility" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "university_specialty_id" UUID NOT NULL,
    "canonical_specialty_id" UUID,
    "seats_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_opportunity_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_ft_opportunity_eligibility" ON "field_training_opportunity_eligibility"("opportunity_id", "university_id", "university_specialty_id");
CREATE INDEX "idx_ft_opportunity_eligibility_opportunity" ON "field_training_opportunity_eligibility"("opportunity_id");
CREATE INDEX "idx_ft_opportunity_eligibility_university" ON "field_training_opportunity_eligibility"("university_id");
CREATE INDEX "idx_ft_opportunity_eligibility_university_specialty" ON "field_training_opportunity_eligibility"("university_specialty_id");
CREATE INDEX "idx_ft_opportunity_eligibility_canonical" ON "field_training_opportunity_eligibility"("canonical_specialty_id");
CREATE INDEX "idx_ft_opportunity_eligibility_active" ON "field_training_opportunity_eligibility"("is_active");

ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_university_specialty_id_fkey" FOREIGN KEY ("university_specialty_id") REFERENCES "university_specialties"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_canonical_specialty_id_fkey" FOREIGN KEY ("canonical_specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Backfill from legacy specialty_id: one eligibility row per active university program sharing the canonical specialty.
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
    o.id,
    us.university_id,
    us.id,
    us.specialty_id,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "field_training_opportunities" o
INNER JOIN "university_specialties" us
    ON us.specialty_id = o.specialty_id
    AND us.status = 'active'
WHERE o.specialty_id IS NOT NULL
ON CONFLICT ("opportunity_id", "university_id", "university_specialty_id") DO NOTHING;
