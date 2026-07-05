-- Link field training opportunities to universities (keep legacy organization_name optional).

ALTER TABLE "field_training_opportunities" ALTER COLUMN "organization_name" DROP NOT NULL;

ALTER TABLE "field_training_opportunities" ADD COLUMN "university_id" UUID;

CREATE INDEX "idx_field_training_opportunities_university" ON "field_training_opportunities"("university_id");

ALTER TABLE "field_training_opportunities" ADD CONSTRAINT "field_training_opportunities_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
