# Roles and Permissions

BATTECHNO LMS uses a **five-role** RBAC model. Authorization identity is always loaded from the database on each request.

## Canonical role codes

| Code | Scope | Description |
|------|-------|-------------|
| `super_admin` | global | Full system access; only role that manages the permission matrix; only role that can assign other super_admins |
| `admin` | university | Staff admin (scoped by `primary_university_id`) |
| `instructor` | university + assigned resources | Courses / FT opportunities assigned to them |
| `student` | own data | Own learning and FT journey only |
| `academic_reviewer` | own university | **Hard read-only** (view + export). Mutations return `403 REVIEWER_READ_ONLY` |

## Single source of truth

```text
user_roles → roles.code
(+ role_permissions → permissions.code)
```

- There is **no** `users.role` column.
- `/auth/me`, login profile, JWT payload roles, and `req.user` all use **canonical** codes via `backend/src/utils/roleCanon.js`.
- JWT is **not** authoritative: `authenticate` reloads roles + permissions from DB every request (`currentAuthContext.js`).

## Permissions matrix

Catalog: `backend/src/utils/permissionCatalog.js`  
Seed/ensure:

```bash
cd backend
node scripts/ensure-permission-catalog.js
# or replace defaults:
node scripts/ensure-permission-catalog.js --reset-defaults
```

Modules × actions (`view|create|update|delete|approve|export|manage`):

- users, universities, courses, field_training, sessions, tasks, assessments, reports, certificates, notifications, settings

API (super_admin only):

- `GET /api/v1/roles` — overview + matrix
- `PUT /api/v1/roles/:id/permissions` — `{ permission_codes: string[] }` (audited)

Rules:

- Super Admin permissions are locked (always full set).
- Academic reviewer cannot receive write permissions (API rejects + middleware blocks mutations).

## Legacy roles

Mapped (never to `super_admin`):

```text
program_admin / university_admin / academic_admin / qa_officer → admin
university_reviewer → academic_reviewer
```

```bash
node scripts/migrate-roles-to-canonical.js --ensure-roles
node scripts/migrate-roles-to-canonical.js --dry-run
node scripts/migrate-roles-to-canonical.js --apply
node scripts/migrate-roles-to-canonical.js --retire-legacy
```

## Backend enforcement

1. `authenticate` → DB roles + permissions + `enforceAcademicReviewerReadOnly`
2. `authorizeRoles(...)` → role allowlists (env defaults use five codes)
3. `requirePermission('module.action')` → optional fine-grained checks (permission table)

Env `*_ROLE_CODES` defaults use the five-role model; legacy CSV values are auto-canonicalized.
