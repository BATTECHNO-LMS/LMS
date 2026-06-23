# Database

BATTECHNO LMS uses **PostgreSQL** with **Prisma 6** as the ORM. The schema lives at `backend/prisma/schema.prisma`.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run prisma:migrate` | Create/apply migrations (development) |
| `npm run prisma:deploy` | Apply migrations (production) |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:studio` | Visual database browser |
| `npm run seed` | Seed roles, university, users |

Migrations are stored in `backend/prisma/migrations/`.

## Schema overview

The schema contains **50 models** organized into these domains:

### Identity and organization

| Model | Purpose |
|-------|---------|
| `users` | User accounts (email, password hash, status) |
| `roles` | Role definitions (`code`, `scope`) |
| `permissions` | Permission codes |
| `role_permissions` | Role ↔ permission mapping |
| `user_roles` | User ↔ role assignment |
| `universities` | Partner universities |
| `university_email_domains` | Allowed email domains for registration |
| `university_users` | User ↔ university affiliation |

### Curriculum (micro-credentials)

| Model | Purpose |
|-------|---------|
| `tracks` | Top-level program tracks |
| `micro_credentials` | Micro-credential programs |
| `micro_credential_versions` | Version history |
| `micro_credential_universities` | University partnerships per credential |
| `learning_outcomes` | Learning outcomes per credential |
| `modules` | Content modules within a credential |
| `contents` | Individual content items (files, URLs) |

Hierarchy: **track → micro-credential → module → content**

### Delivery

| Model | Purpose |
|-------|---------|
| `cohorts` | Scheduled delivery instance of a micro-credential |
| `enrollments` | Student ↔ cohort link with status and grades |
| `sessions` | Scheduled class sessions |
| `attendance_records` | Per-student session attendance |

### Assessment and grading

| Model | Purpose |
|-------|---------|
| `assessments` | Cohort-scoped assessments |
| `submissions` | Student work submissions |
| `grades` | Instructor grades and feedback |
| `rubrics` | Grading rubrics |
| `rubric_criteria` | Individual rubric criteria |

### Standalone courses

| Model | Purpose |
|-------|---------|
| `courses` | Super-admin managed courses |
| `course_sections` | Course sections |
| `course_lessons` | Lessons within sections |
| `course_cohorts` | Link courses to delivery cohorts |
| `course_enrollments` | Student course enrollment |
| `course_lesson_progress` | Per-lesson completion tracking |
| `course_lesson_training` | Training workflow configuration |
| `course_lesson_questions` | Training quiz questions |
| `course_lesson_student_workflow` | Student training submission state |

### Field training

| Model | Purpose |
|-------|---------|
| `field_training_opportunities` | Internship/training postings |
| `field_training_applications` | Student applications |
| `field_training_tasks` | Assigned tasks per opportunity |
| `field_training_task_submissions` | Student task submissions |

### Quality assurance and governance

| Model | Purpose |
|-------|---------|
| `evidence_files` | Accreditation evidence documents |
| `qa_reviews` | Quality assurance reviews |
| `corrective_actions` | Follow-up actions from QA reviews |
| `risk_cases` | At-risk student tracking |
| `integrity_cases` | Academic integrity incidents |
| `audit_logs` | Append-only audit trail |

### Recognition and certification

| Model | Purpose |
|-------|---------|
| `recognition_requests` | University credit recognition requests |
| `recognition_documents` | Supporting documents |
| `certificates` | Issued certificates with verification codes |

### System

| Model | Purpose |
|-------|---------|
| `notifications` | In-app notifications |
| `system_settings` | Key-value system configuration |

## Key relationships

```
universities
  ├── university_email_domains
  ├── university_users → users
  ├── cohorts
  └── recognition_requests

tracks
  └── micro_credentials
        ├── learning_outcomes
        ├── modules → contents
        ├── cohorts
        │     ├── enrollments → users (students)
        │     ├── sessions → attendance_records
        │     └── assessments
        │           ├── submissions
        │           └── grades
        └── recognition_requests

users
  ├── user_roles → roles → role_permissions → permissions
  └── notifications

courses
  ├── course_sections → course_lessons
  │     ├── course_lesson_training
  │     └── course_lesson_questions
  ├── course_enrollments
  └── course_lesson_progress
```

## Important enums and statuses

### Enrollment lifecycle

| Field | Values |
|-------|--------|
| `enrollment_status` | `pending`, `enrolled`, `rejected` |
| `final_status` | `in_progress`, `passed`, `failed`, etc. |
| `recognition_eligibility_status` | `unknown`, `eligible`, `ineligible`, etc. |

### Cohort status

`planned`, `active`, `completed`, `cancelled` (see `cohort_status` enum in schema)

### User status

Users can be `active` or `inactive`. Self-registered students start as `inactive` until admin activation.

## Schema notes

- Many foreign keys are stored as UUID columns without explicit Prisma `@relation` blocks — the schema evolved SQL-first via migrations
- Check constraints exist on several tables (see Prisma migration comments)
- UUIDs are generated via `gen_random_uuid()` at the database level
- Timestamps use `timestamptz(6)`

## Seeding

`backend/prisma/seed.js` creates:

1. All standard roles (7 roles)
2. BATTECHNO University with domain `batuni.edu`
3. One user per role with password `12345678`

Additional scripts:

| Script | File |
|--------|------|
| Demo data | `backend/scripts/seed-demo.js` |
| Minimum auth | `backend/scripts/seed-auth-minimum.js` |
| University backfill | `backend/scripts/backfill-university-from-email.js` |

## Migrations workflow

### Development

```bash
cd backend
# Edit prisma/schema.prisma
npm run prisma:migrate
# Name the migration when prompted
```

### Production

```bash
npm run prisma:deploy
```

Always run `prisma:generate` after schema changes (happens automatically on `npm install` via `postinstall`).

## Connection configuration

Set `DATABASE_URL` in `backend/.env`:

```
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

For Neon or other serverless PostgreSQL, use the pooler connection string. See [GETTING_STARTED.md](GETTING_STARTED.md) for cold-start troubleshooting.

## Prisma Studio

Browse and edit data visually:

```bash
cd backend
npm run prisma:studio
```

Opens at `http://localhost:5555` by default.
