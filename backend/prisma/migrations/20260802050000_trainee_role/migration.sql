-- Additive: institution learner role `trainee` (keeps university `student`).

INSERT INTO "roles" ("id", "name", "code", "scope", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Trainee', 'trainee', 'university',
       'Institution training-course trainee (not university student).',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'trainee');
