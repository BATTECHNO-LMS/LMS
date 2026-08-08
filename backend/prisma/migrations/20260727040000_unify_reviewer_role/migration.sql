-- Unify reviewer role code to `reviewer` and add university assignment table.

CREATE TYPE "reviewer_assignment_source" AS ENUM ('EMAIL_DOMAIN', 'MANUAL', 'MIGRATION');

CREATE TABLE IF NOT EXISTS "reviewer_university_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reviewer_user_id" UUID NOT NULL,
  "university_id" UUID NOT NULL,
  "assignment_source" "reviewer_assignment_source" NOT NULL DEFAULT 'MANUAL',
  "assigned_by_id" UUID,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviewer_university_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_reviewer_university_assignments"
  ON "reviewer_university_assignments"("reviewer_user_id", "university_id");
CREATE INDEX IF NOT EXISTS "idx_reviewer_university_assignments_reviewer"
  ON "reviewer_university_assignments"("reviewer_user_id");
CREATE INDEX IF NOT EXISTS "idx_reviewer_university_assignments_university"
  ON "reviewer_university_assignments"("university_id");
CREATE INDEX IF NOT EXISTS "idx_reviewer_university_assignments_active"
  ON "reviewer_university_assignments"("is_active");
CREATE INDEX IF NOT EXISTS "idx_reviewer_university_assignments_reviewer_active"
  ON "reviewer_university_assignments"("reviewer_user_id", "is_active");

-- At most one active university assignment per reviewer (future multi-uni via inactive rows).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reviewer_university_assignments_one_active"
  ON "reviewer_university_assignments"("reviewer_user_id")
  WHERE "is_active" = true;

-- Ensure canonical reviewer role exists
INSERT INTO "roles" ("id", "name", "code", "scope", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Reviewer', 'reviewer', 'university', 'University-scoped read-only reviewer.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'reviewer');

-- Remap user_roles from academic_reviewer / university_reviewer → reviewer (no duplicates)
WITH reviewer_role AS (
  SELECT id FROM "roles" WHERE code = 'reviewer' LIMIT 1
),
legacy_roles AS (
  SELECT id, code FROM "roles" WHERE code IN ('academic_reviewer', 'university_reviewer')
),
legacy_links AS (
  SELECT ur.user_id, ur.id AS user_role_id
  FROM user_roles ur
  INNER JOIN legacy_roles lr ON lr.id = ur.role_id
),
existing_target AS (
  SELECT ur.user_id
  FROM user_roles ur
  INNER JOIN reviewer_role rr ON rr.id = ur.role_id
)
INSERT INTO user_roles (id, user_id, role_id, created_at)
SELECT gen_random_uuid(), ll.user_id, (SELECT id FROM reviewer_role), CURRENT_TIMESTAMP
FROM legacy_links ll
WHERE NOT EXISTS (
  SELECT 1 FROM existing_target et WHERE et.user_id = ll.user_id
)
ON CONFLICT DO NOTHING;

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id
  AND r.code IN ('academic_reviewer', 'university_reviewer');

-- Backfill assignments from primary_university_id for users who now have reviewer role
INSERT INTO reviewer_university_assignments (
  id, reviewer_user_id, university_id, assignment_source, assigned_at, is_active, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.primary_university_id,
  'MIGRATION'::"reviewer_assignment_source",
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON r.id = ur.role_id AND r.code = 'reviewer'
WHERE u.primary_university_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM reviewer_university_assignments rua
    WHERE rua.reviewer_user_id = u.id AND rua.university_id = u.primary_university_id
  );

-- Retire legacy role catalog rows only when unused
DELETE FROM roles
WHERE code IN ('academic_reviewer', 'university_reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.role_id = roles.id
  );
