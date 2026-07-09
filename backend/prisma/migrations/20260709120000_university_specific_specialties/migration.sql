-- University-specific specialties for registration; canonical specialty_id preserved for Field Training matching.

CREATE TABLE "university_specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "specialty_id" UUID,
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(80) NOT NULL,
    "college_name_ar" VARCHAR(255),
    "college_name_en" VARCHAR(255),
    "status" "specialty_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_specialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_university_specialties_university_code" ON "university_specialties"("university_id", "code");
CREATE INDEX "idx_university_specialties_university_id" ON "university_specialties"("university_id");
CREATE INDEX "idx_university_specialties_specialty_id" ON "university_specialties"("specialty_id");
CREATE INDEX "idx_university_specialties_status" ON "university_specialties"("status");

ALTER TABLE "university_specialties" ADD CONSTRAINT "university_specialties_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "university_specialties" ADD CONSTRAINT "university_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "users" ADD COLUMN "university_specialty_id" UUID;

CREATE INDEX "idx_users_university_specialty_id" ON "users"("university_specialty_id");

ALTER TABLE "users" ADD CONSTRAINT "users_university_specialty_id_fkey" FOREIGN KEY ("university_specialty_id") REFERENCES "university_specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
