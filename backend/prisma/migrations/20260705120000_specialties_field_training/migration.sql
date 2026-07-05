-- University-scoped specialties for student registration and field training matching.

CREATE TYPE "specialty_status" AS ENUM ('active', 'inactive');

CREATE TABLE "specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(50),
    "university_id" UUID NOT NULL,
    "status" "specialty_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_specialties_university_id" ON "specialties"("university_id");
CREATE INDEX "idx_specialties_status" ON "specialties"("status");

ALTER TABLE "specialties" ADD CONSTRAINT "specialties_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "users" ADD COLUMN "specialty_id" UUID;
CREATE INDEX "idx_users_specialty_id" ON "users"("specialty_id");
ALTER TABLE "users" ADD CONSTRAINT "users_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "field_training_opportunities" ADD COLUMN "specialty_id" UUID;
CREATE INDEX "idx_field_training_opportunities_specialty" ON "field_training_opportunities"("specialty_id");
ALTER TABLE "field_training_opportunities" ADD CONSTRAINT "field_training_opportunities_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
