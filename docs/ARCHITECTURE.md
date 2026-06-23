# Architecture

## System overview

BATTECHNO LMS is a monorepo with a decoupled frontend SPA and REST API backend sharing a PostgreSQL database.

```
┌─────────────────┐     HTTPS/REST      ┌─────────────────┐
│  React SPA      │ ◄─────────────────► │  Express API    │
│  (Vite, port    │   JWT Bearer token  │  (port 4000)    │
│   5173)         │                     │                 │
└─────────────────┘                     └────────┬────────┘
                                                 │
                                                 │ Prisma ORM
                                                 ▼
                                        ┌─────────────────┐
                                        │  PostgreSQL     │
                                        └─────────────────┘
```

## Monorepo layout

```
LMS/
├── backend/
│   ├── prisma/              # Schema, migrations, seed
│   ├── src/
│   │   ├── server.js        # Process entry, DB connect, shutdown
│   │   ├── app.js           # Express middleware + route mounting
│   │   ├── config/          # env.js, db.js
│   │   ├── middlewares/     # Auth, validation, rate limit, errors
│   │   ├── modules/         # Domain modules (feature slices)
│   │   ├── routes/          # API v1 router aggregator
│   │   ├── shared/          # Storage, audit, notifications
│   │   └── utils/           # JWT, password, pagination
│   ├── scripts/             # Seed and maintenance scripts
│   ├── tests/               # Node test runner + supertest
│   └── uploads/             # Local file storage
│
├── frontend/
│   └── src/
│       ├── main.jsx         # Entry: i18n + styles + App
│       ├── App.jsx            # Providers + router
│       ├── app/               # Router, providers
│       ├── layouts/           # Portal shells (admin, instructor, …)
│       ├── pages/             # Route-level page components
│       ├── features/          # Domain modules (service + hooks)
│       ├── components/        # Shared UI
│       ├── services/          # API client, endpoints map
│       ├── constants/         # Roles, permissions, navigation
│       ├── i18n/              # Translations (ar, en)
│       └── utils/             # Helpers, portal detection
│
└── .github/workflows/ci.yml
```

## Request lifecycle (backend)

1. **HTTP request** arrives at Express (`app.js`)
2. **CORS** validates origin against allowlist + `CORS_ORIGINS`
3. **Request ID** assigned (`requestIdMiddleware`)
4. **Helmet** sets security headers
5. **Morgan** logs request (non-test environments)
6. **Rate limiter** applied (`/api/auth` has stricter limits)
7. **Route handler** — auth middleware → role authorization → Zod validation → controller
8. **Service layer** — business logic
9. **Repository layer** — Prisma queries
10. **Error middleware** — standardized JSON error responses

### Route mounting

| Mount path | Module |
|------------|--------|
| `/api/auth` | `modules/auth/auth.routes.js` |
| `/api/v1` | `routes/index.js` (all domain routes) |
| `/uploads` | Static files from `UPLOAD_DIR` |
| `/health`, `/health/ready` | Health checks |

## Backend module pattern

Each domain under `backend/src/modules/<domain>/` typically contains:

| File | Responsibility |
|------|----------------|
| `*.routes.js` | Express routes, middleware chain |
| `*.controller.js` | HTTP request/response handling |
| `*.service.js` | Business rules |
| `*.repository.js` | Database access (Prisma) |
| `*.validation.js` | Zod schemas for request bodies/params |

Examples: `users`, `cohorts`, `assessments`, `certificates`, `fieldTraining`, `courses`.

## Authentication flow

```
Register (student)                Login
       │                            │
       ▼                            ▼
  Validate email domain      bcrypt password check
  Create inactive user       Issue JWT (userId, roles,
  Assign student role         universityId, isGlobal)
  Notify admins                     │
       │                            ▼
       │                    Client stores token
       │                    Authorization: Bearer <token>
       │                            │
       ▼                            ▼
  Admin activates user       authMiddleware → req.user
  (PATCH /users/:id/activate) authorizeRoles → 403 if denied
```

- **JWT** signed with `JWT_SECRET`, TTL from `JWT_EXPIRES_IN`
- **`isGlobal: true`** for super_admin — bypasses all role gates
- **University linking** — email domain matched to `university_email_domains` on login
- **Logout** — client-side only (no server-side token blacklist)

## Frontend architecture

### Provider stack (`app/providers/index.jsx`)

1. `QueryClientProvider` — TanStack React Query
2. `LocaleProvider` — language / RTL sync
3. `BrowserRouter` — React Router
4. `AuthProvider` — JWT session state
5. `TenantProvider` — university context
6. `ErrorBoundary`

### Feature module pattern (`features/<domain>/`)

```
features/users/
├── users.service.js      # Axios calls via endpoints map
├── hooks/
│   ├── useUsers.js
│   └── useCreateUser.js
├── index.js              # Public exports
└── ...
```

### Routing layers

1. **Public** — `/`, `/login/*`, `/register`, `/verify/certificate/:code`
2. **ProtectedRoute** — requires authenticated user
3. **RoleBasedRoute** — restricts by role code
4. **RoleShellPermissionOutlet** — filters nav/items by UI permissions
5. **Layout** — `AdminLayout`, `InstructorLayout`, `StudentLayout`, `ReviewerLayout`

### Portal detection

`utils/portal.js` reads the hostname subdomain and redirects `/login` to the matching portal login page.

## Domain model (high level)

```
Curriculum          Delivery              Assessment
──────────          ────────              ──────────
tracks              cohorts               assessments
  └ micro_creds       └ enrollments         └ submissions
      └ modules       └ sessions              └ grades
          └ contents    └ attendance          rubrics

Governance          Recognition           Courses (standalone)
──────────          ───────────           ──────────────────
evidence            recognition_requests  courses
qa_reviews            └ documents           └ sections
corrective_actions                          └ lessons
risk_cases                                  └ training workflow
integrity_cases
certificates
audit_logs

Field training
──────────────
opportunities → applications → tasks → submissions
```

## Cross-cutting concerns

| Concern | Backend | Frontend |
|---------|---------|----------|
| Validation | Zod in middleware | Zod + react-hook-form |
| Errors | `error.middleware.js` | API client interceptors |
| Audit | `audit_logs` table | Audit log pages |
| Notifications | `notifications` module | Notifications page |
| File storage | multer + local/S3 | Upload components |
| i18n | — | i18next (ar default, en) |
| Pagination | `utils/pagination.js` | Query params in hooks |

## Security

- **helmet** — HTTP security headers
- **cors** — origin allowlist
- **express-rate-limit** — API and auth rate limiting
- **bcrypt** — password hashing
- **JWT** — stateless authentication
- **RBAC** — env-configurable role code lists per domain
- **Zod** — input validation on all mutating endpoints

## Testing strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Backend | Node `node:test` + supertest | Health, utilities, services |
| Frontend | Build validation in CI | `npm run build` |
| Database | `prisma validate` in CI | Schema integrity |

No frontend unit test suite is configured yet. Backend tests do not require a live database for most cases.

## Known gaps

- `roles.routes.js` and `modules.routes.js` are mounted but empty stubs
- `university_admin` role exists in frontend/env defaults but is not in the default seed
- Prisma schema uses many implicit FKs without explicit `@relation` blocks

See [API.md](API.md) and [DATABASE.md](DATABASE.md) for detailed references.
