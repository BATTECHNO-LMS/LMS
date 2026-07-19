# Roles and Permissions

BATTECHNO LMS uses role-based access control (RBAC) on both the backend API and frontend UI.

## Role codes

| Code | Scope | Status | Description |
|------|-------|--------|-------------|
| `super_admin` | global | **Active** | Full system access; `isGlobal` bypasses all API role gates |
| `program_admin` | university | **Deprecated (Phase 4 soft-retired)** | Historical only — no runtime AuthZ; not assignable; catalog row retained |
| `university_admin` | university | **Active** | University-scoped admin |
| `academic_admin` | university | **Active** | Academic operations, curriculum, enrollments |
| `qa_officer` | university | **Active** | Quality assurance oversight |
| `instructor` | university | **Active** | Cohort delivery, grading, attendance |
| `student` | university | **Active** | Learning, submissions, enrollments |
| `university_reviewer` | university | **Active** | Recognition and enrollment review |

`program_admin` remains in the database role catalog and may appear on inactive users, audits, exports, and list filters with deprecated labels. It is stripped from all active authorization allowlists (including env CSVs that still list it). See `docs/maintenance/09_PROGRAM_ADMIN_DEPRECATION_PLAN.md`.

### Database tables

- `roles` — role definitions (`code`, `name`, `scope`)
- `permissions` — granular permission codes
- `role_permissions` — many-to-many role ↔ permission
- `user_roles` — many-to-many user ↔ role

Seeded roles are defined via `backend/scripts/lib/baselineCatalog.js` / seed scripts.

## Backend authorization

### JWT payload

```json
{
  "userId": "uuid",
  "roles": ["university_admin"],
  "universityId": "uuid-or-null",
  "isGlobal": false
}
```

`isGlobal` is `true` when the user has the `super_admin` role (`SUPER_ADMIN_ROLE_CODE`). Protected routes rebuild `req.user` from the current database (status, roles, university, `isGlobal`).

### Middleware chain

1. **`authenticate`** — validates Bearer JWT `userId`, loads current DB auth context into `req.user`
2. **`authorizeRoles(...codes)`** — checks `req.user.roles` against allowed codes (deprecated roles such as `program_admin` are stripped from allowlists)
3. Super admin (`req.user.isGlobal`) always passes role checks

### Env-driven role lists

Each API domain reads allowed role codes from environment variables with defaults in `backend/src/config/env.js`. Parsing **ignores** `program_admin` even if an env CSV still includes it.

| Env variable | Default roles (Phase 3+) | Domain |
|--------------|--------------------------|--------|
| `ADMIN_READ_ROLE_CODES` | super_admin, university_admin | Users, universities (read) |
| `USER_WRITE_ROLE_CODES` | super_admin | User create/update |
| `USER_ACTIVATE_ROLE_CODES` | super_admin, university_admin, academic_admin | Activate pending students |
| `UNIVERSITY_WRITE_ROLE_CODES` | super_admin | University CRUD |
| `CURRICULUM_READ_ROLE_CODES` | super_admin, university_admin, academic_admin, qa_officer, instructor | Tracks, micro-credentials |
| `CURRICULUM_WRITE_ROLE_CODES` | super_admin, academic_admin | Curriculum mutations |
| `DELIVERY_READ_ROLE_CODES` | super_admin, university_admin, academic_admin, qa_officer, instructor | Cohorts, sessions |
| `DELIVERY_WRITE_ROLE_CODES` | super_admin, university_admin, academic_admin, instructor | Delivery mutations |
| `ACADEMIC_READ_ROLE_CODES` | + student | Assessments, submissions (scoped) |
| `ACADEMIC_WRITE_ROLE_CODES` | super_admin, university_admin, academic_admin, instructor | Grading, assessments |
| `EVIDENCE_READ_ROLE_CODES` | + university_reviewer | Evidence files |
| `EVIDENCE_WRITE_ROLE_CODES` | super_admin, university_admin, academic_admin, instructor | Evidence upload |
| `QA_OVERSIGHT_ROLE_CODES` | super_admin, university_admin, academic_admin, qa_officer | QA reviews, corrective actions |
| `RISK_INTEGRITY_ROLE_CODES` | + instructor | Risk and integrity cases |
| `RECOGNITION_READ_ROLE_CODES` | super_admin, university_admin, academic_admin, university_reviewer | Recognition |
| `RECOGNITION_WRITE_ROLE_CODES` | super_admin, university_admin, academic_admin | Recognition mutations |
| `CERTIFICATE_READ_ROLE_CODES` | + student, university_reviewer | Certificates |
| `CERTIFICATE_WRITE_ROLE_CODES` | super_admin, university_admin, academic_admin | Issue certificates |
| `AUDIT_LOG_READ_ROLE_CODES` | super_admin, university_admin, academic_admin | Audit logs |
| `REPORT_READ_ROLE_CODES` | super_admin, university_admin, academic_admin, qa_officer, university_reviewer | Reports |
| `ENROLLMENT_DECISION_ROLE_CODES` | super_admin, academic_admin, university_reviewer | Approve/reject enrollments |

### Special access rules

| Feature | Access |
|---------|--------|
| Analytics (`/analytics/*`) | `super_admin` only |
| Admin courses (`/admin/courses/*`) | `super_admin` only |
| Admin field training (`/admin/field-training/*`) | `super_admin`, `university_admin` (UI); API also allows `academic_admin` via `FIELD_TRAINING_*_ROLE_CODES` |
| Instructor field training (`/instructor/field-training/*`) | `instructor` (assigned opportunities only) |
| Academic field training (`/academic/field-training/*`) | `academic_admin`, `university_reviewer`, `qa_officer`, `university_admin` (read-only reports) |
| Field training reports | `REPORT_READ` / FT report roles — **not** `program_admin` |
| Student courses / field training | `student` |
| Certificate verify (`GET /certificates/verify/:code`) | Public (no auth) |

### Field Training role env defaults

| Env var | Default includes |
|---------|------------------|
| `FIELD_TRAINING_ADMIN_ROLE_CODES` | super_admin, university_admin, academic_admin |
| `FIELD_TRAINING_MANAGE_ROLE_CODES` | same as admin (no instructor / reviewer on admin portal) |
| `FIELD_TRAINING_INSTRUCTOR_ROLE_CODES` | instructor |

**Scope note:** Only `isGlobal` (typically `super_admin`) is system-wide. `program_admin` is **not** system-wide after Phase 3.

## Frontend authorization

### Role constants

Defined in `frontend/src/constants/roles.js`:

```javascript
ROLES.SUPER_ADMIN        // 'super_admin'
ROLES.PROGRAM_ADMIN      // 'program_admin' — legacy / historical display only
ROLES.UNIVERSITY_ADMIN   // 'university_admin'
ROLES.ACADEMIC_ADMIN     // 'academic_admin'
ROLES.QA_OFFICER         // 'qa_officer'
ROLES.INSTRUCTOR         // 'instructor'
ROLES.STUDENT            // 'student'
ROLES.UNIVERSITY_REVIEWER // 'university_reviewer'

ADMIN_ROLE_SET           // Active admin-shell roles (excludes program_admin)
LEGACY_DEPRECATED_ROLE_CODES // includes program_admin
```

### Route protection

Active admin portals use `ADMIN_ROLE_SET`. Deprecated `program_admin` fails closed (no portal; no student fallback). Historical user screens may still show the deprecated label and list filter.
