# Roles and Permissions

BATTECHNO LMS uses role-based access control (RBAC) on both the backend API and frontend UI.

## Role codes

| Code | Scope | Description |
|------|-------|-------------|
| `super_admin` | global | Full system access; `isGlobal` bypasses all API role gates |
| `program_admin` | university | Program-level administration |
| `university_admin` | university | University-scoped admin (frontend/env; not in default seed) |
| `academic_admin` | university | Academic operations, curriculum, enrollments |
| `qa_officer` | university | Quality assurance oversight |
| `instructor` | university | Cohort delivery, grading, attendance |
| `student` | university | Learning, submissions, enrollments |
| `university_reviewer` | university | Recognition and enrollment review |

### Database tables

- `roles` — role definitions (`code`, `name`, `scope`)
- `permissions` — granular permission codes
- `role_permissions` — many-to-many role ↔ permission
- `user_roles` — many-to-many user ↔ role

Seeded roles are defined in `backend/prisma/seed.js`.

## Backend authorization

### JWT payload

```json
{
  "userId": "uuid",
  "roles": ["program_admin"],
  "universityId": "uuid-or-null",
  "isGlobal": false
}
```

`isGlobal` is `true` when the user has the `super_admin` role (`SUPER_ADMIN_ROLE_CODE`).

### Middleware chain

1. **`authMiddleware`** — validates `Authorization: Bearer <token>`, sets `req.user`
2. **`authorizeRoles(...codes)`** — checks `req.user.roles` against allowed codes
3. Super admin (`req.user.isGlobal`) always passes role checks

### Env-driven role lists

Each API domain reads allowed role codes from environment variables with defaults in `backend/src/config/env.js`:

| Env variable | Default roles | Domain |
|--------------|---------------|--------|
| `ADMIN_READ_ROLE_CODES` | super_admin, program_admin, university_admin | Users, universities (read) |
| `USER_WRITE_ROLE_CODES` | super_admin, program_admin | User create/update |
| `USER_ACTIVATE_ROLE_CODES` | super_admin, program_admin, academic_admin | Activate pending students |
| `UNIVERSITY_WRITE_ROLE_CODES` | super_admin, program_admin | University CRUD |
| `CURRICULUM_READ_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, qa_officer, instructor | Tracks, micro-credentials |
| `CURRICULUM_WRITE_ROLE_CODES` | super_admin, program_admin, academic_admin | Curriculum mutations |
| `DELIVERY_READ_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, qa_officer, instructor | Cohorts, sessions |
| `DELIVERY_WRITE_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, instructor | Delivery mutations |
| `ACADEMIC_READ_ROLE_CODES` | + student | Assessments, submissions (scoped) |
| `ACADEMIC_WRITE_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, instructor | Grading, assessments |
| `EVIDENCE_READ_ROLE_CODES` | + university_reviewer | Evidence files |
| `EVIDENCE_WRITE_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, instructor | Evidence upload |
| `QA_OVERSIGHT_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, qa_officer | QA reviews, corrective actions |
| `RISK_INTEGRITY_ROLE_CODES` | + instructor | Risk and integrity cases |
| `RECOGNITION_READ_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, university_reviewer | Recognition |
| `RECOGNITION_WRITE_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin | Recognition mutations |
| `CERTIFICATE_READ_ROLE_CODES` | + student, university_reviewer | Certificates |
| `CERTIFICATE_WRITE_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin | Issue certificates |
| `AUDIT_LOG_READ_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin | Audit logs |
| `REPORT_READ_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin, qa_officer, university_reviewer | Reports |
| `ENROLLMENT_DECISION_ROLE_CODES` | super_admin, program_admin, academic_admin, university_reviewer | Approve/reject enrollments |

### Special access rules

| Feature | Access |
|---------|--------|
| Analytics (`/analytics/*`) | `super_admin` only |
| Admin courses (`/admin/courses/*`) | `super_admin` only |
| Admin field training (`/admin/field-training/*`) | `super_admin`, `program_admin`, `university_admin` (UI); API also allows `academic_admin` via `FIELD_TRAINING_*_ROLE_CODES` |
| Instructor field training (`/instructor/field-training/*`) | `instructor` (assigned opportunities only) |
| Academic field training (`/academic/field-training/*`) | `academic_admin`, `university_reviewer`, `qa_officer`, `university_admin` (read-only reports) |
| Field training reports (`/admin/field-training/reports/*`) | `REPORT_READ_ROLE_CODES` including `program_admin`; global report: `super_admin`, `program_admin` |
| Student courses (`/student/courses/*`) | `student` role |
| Student field training (`/student/field-training/*`) | `student` role |
| Certificate verify (`GET /certificates/verify/:code`) | Public (no auth) |

### Field Training role env defaults

| Env var | Default includes |
|---------|------------------|
| `FIELD_TRAINING_ADMIN_ROLE_CODES` | super_admin, program_admin, university_admin, academic_admin |
| `FIELD_TRAINING_MANAGE_ROLE_CODES` | same as admin (no instructor / reviewer on admin portal) |
| `FIELD_TRAINING_INSTRUCTOR_ROLE_CODES` | instructor |

**Scope note:** `program_admin` is treated as system-wide for Field Training (`isSystemWideAdmin`) and can manage opportunities across universities. `university_admin` / academic roles remain university-scoped via eligibility. Instructors must use `/instructor/field-training`; university reviewers use `/academic/field-training`.

## Frontend authorization

### Role constants

Defined in `frontend/src/constants/roles.js`:

```javascript
ROLES.SUPER_ADMIN        // 'super_admin'
ROLES.PROGRAM_ADMIN      // 'program_admin'
ROLES.UNIVERSITY_ADMIN   // 'university_admin'
ROLES.ACADEMIC_ADMIN     // 'academic_admin'
ROLES.QA_OFFICER         // 'qa_officer'
ROLES.INSTRUCTOR         // 'instructor'
ROLES.STUDENT            // 'student'
ROLES.UNIVERSITY_REVIEWER // 'university_reviewer'

ADMIN_ROLE_SET           // All admin-shell roles
```

### Route protection

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Redirects unauthenticated users to login |
| `RoleBasedRoute` | Blocks users without required role |
| `RoleShellPermissionOutlet` | Hides routes/nav items by UI permission |
| `PagePermissionGate` | Page-level permission check |

### UI permissions

`frontend/src/constants/permissions.js` defines a UI permission matrix mapped to roles. Navigation items in admin/instructor/student/reviewer shells are filtered by `hasUiPermission(role, permission)`.

**Important:** Frontend permissions control UI visibility only. The backend enforces actual data access.

## User lifecycle

### Student self-registration

1. Student registers at `/register` with university email domain
2. User created with `inactive` status and `student` role
3. Admins with `USER_ACTIVATE_ROLE_CODES` activate via `PATCH /users/:id/activate`
4. Bulk activation: `POST /users/activate-pending`

### University email linking

On login, `universityEmailLink.service.js` matches the user's email domain to `university_email_domains` and links them to the university.

### Staff user creation

Admins with `USER_WRITE_ROLE_CODES` create users via `POST /users` with assigned roles.

## Portal mapping

| Portal | Allowed roles |
|--------|---------------|
| `/admin/*` | `ADMIN_ROLE_SET` |
| `/instructor/*` | `instructor` |
| `/student/*` | `student` |
| `/reviewer/*` | `university_reviewer` |

Login URLs: `/login/admin`, `/login/instructor`, `/login/student`, `/login/reviewer`.

## Customizing access

To grant a role access to a new domain:

1. Add the role code to the relevant `*_ROLE_CODES` env var in `backend/.env`
2. Update frontend `permissions.js` if UI visibility should change
3. Restart the backend to pick up env changes

Super admin access does not require env changes — `isGlobal` bypasses all backend gates.
