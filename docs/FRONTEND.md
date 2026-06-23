# Frontend

The BATTECHNO LMS frontend is a React 18 single-page application built with Vite 5.

**Package name:** `battechno-lms-web`

## Tech stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite 5 | Build tool and dev server |
| React Router 6 | Client-side routing |
| TanStack React Query 5 | Server state, caching, mutations |
| Axios | HTTP client |
| react-hook-form + Zod | Form handling and validation |
| i18next | Internationalization (Arabic + English) |
| SCSS | Component and layout styles |
| Tailwind CSS | Landing page styles |
| lucide-react / react-icons | Icons |
| recharts | Analytics charts |
| jspdf + xlsx | PDF and Excel exports |
| framer-motion | Animations |

## Project structure

```
frontend/src/
├── main.jsx                 # Entry point
├── App.jsx                  # Root component
├── app/
│   ├── providers/           # Context providers
│   └── router/              # Route definitions
├── layouts/                 # Portal layouts
│   ├── AdminLayout.jsx
│   ├── InstructorLayout.jsx
│   ├── StudentLayout.jsx
│   ├── ReviewerLayout.jsx
│   └── AuthLayout.jsx
├── pages/                   # Page components by portal
│   ├── admin/
│   ├── instructor/
│   ├── student/
│   ├── reviewer/
│   ├── auth/
│   └── public/
├── features/                # Domain modules
├── components/              # Shared UI components
├── services/                # API client and endpoints
├── constants/               # Roles, permissions, navigation
├── i18n/                    # Translation files
├── utils/                   # Helpers
└── assets/styles/           # SCSS
```

## Getting started

```bash
cd frontend
npm install
```

Create `.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_ORIGINS=http://localhost:5173
```

```bash
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | Yes | — | Backend origin (no trailing slash) |
| `VITE_APP_ORIGINS` | No | — | Documented for deployment CORS alignment |
| `VITE_API_VERSION` | No | `v1` | API version segment |

Restart Vite after changing `.env` files.

## API client

`services/apiClient.js` configures Axios with:

- Base URL from `VITE_API_BASE_URL`
- JWT token from auth storage
- Request/response interceptors for errors

`services/endpoints.js` maps all backend route prefixes:

```javascript
endpoints.auth.login          // /api/auth/login
endpoints.users               // /api/v1/users
endpoints.cohorts             // /api/v1/cohorts
// ... all domains
```

## Dev server proxy

`vite.config.js` proxies `/api` to `http://localhost:4000`:

```javascript
server: {
  port: 5173,
  proxy: {
    '/api': { target: 'http://localhost:4000', changeOrigin: true },
  },
},
```

## Routing

Router: `app/router/index.jsx`

### Public routes

| Path | Page |
|------|------|
| `/` | Root redirect (subdomain-aware) |
| `/login` | Portal-aware login redirect |
| `/login/admin` | Admin login |
| `/login/instructor` | Instructor login |
| `/login/student` | Student login |
| `/login/reviewer` | Reviewer login |
| `/register` | Student registration |
| `/verify/certificate/:code` | Public certificate verification |

### Protected portals

| Prefix | Layout | Roles |
|--------|--------|-------|
| `/admin/*` | AdminLayout | ADMIN_ROLE_SET |
| `/instructor/*` | InstructorLayout | instructor |
| `/student/*` | StudentLayout | student |
| `/reviewer/*` | ReviewerLayout | university_reviewer |

### Admin routes (sample)

`/admin/dashboard`, `/admin/users`, `/admin/universities`, `/admin/tracks`, `/admin/micro-credentials`, `/admin/cohorts`, `/admin/enrollments`, `/admin/sessions`, `/admin/assessments`, `/admin/rubrics`, `/admin/submissions`, `/admin/grades`, `/admin/evidence`, `/admin/qa-reviews`, `/admin/risk-cases`, `/admin/integrity-cases`, `/admin/recognition-requests`, `/admin/certificates`, `/admin/reports`, `/admin/audit-logs`, `/admin/analytics`, `/admin/courses`, `/admin/field-training`, `/admin/settings`, `/admin/notifications`

### Student routes (sample)

`/student/dashboard`, `/student/courses`, `/student/field-training`, `/student/programs`, `/student/available-cohorts`, `/student/sessions`, `/student/assessments`, `/student/submissions`, `/student/grades`, `/student/certificate`

## Feature modules

Each domain under `features/` follows a consistent pattern:

```
features/<domain>/
├── <domain>.service.js    # API calls
├── hooks/
│   ├── use<Domain>.js     # Query hooks
│   └── useCreate<Domain>.js
├── index.js               # Public exports
└── (mappers, validation)
```

### Available features

`analytics`, `assessments`, `attendance`, `auth`, `certificates`, `cohorts`, `correctiveActions`, `courses`, `enrollments`, `evidence`, `fieldTraining`, `grades`, `integrity`, `learningOutcomes`, `locale`, `microCredentials`, `qa`, `recognition`, `reports`, `risks`, `rubrics`, `sessions`, `submissions`, `tenant`, `tracks`, `universities`, `users`

Plus `notifications/` (hooks + service).

## Providers

`app/providers/index.jsx` wraps the app with:

1. **QueryClientProvider** — React Query defaults
2. **LocaleProvider** — syncs i18n with document `dir`/`lang`
3. **BrowserRouter**
4. **AuthProvider** — JWT session, login/logout
5. **TenantProvider** — university context for multi-tenant UI
6. **ErrorBoundary**

## Authentication

- Login via portal-specific pages calls `POST /api/auth/login`
- JWT stored in local storage
- `ProtectedRoute` redirects unauthenticated users
- `authUserMapper.js` maps API user shape to frontend user model
- Logout clears token and calls `POST /api/auth/logout`

## Permissions and navigation

- `constants/roles.js` — role code constants
- `constants/permissions.js` — UI permission matrix
- `RoleShellPermissionOutlet` — filters outlet routes by permission
- Admin navigation: `constants/adminNavigation.js` (grouped, role-filtered)
- Instructor/student/reviewer nav filtered similarly

## Internationalization (i18n)

Configured in `i18n/config.js`:

| Setting | Value |
|---------|-------|
| Default/fallback | Arabic (`ar`) |
| Supported | `ar`, `en` |
| Namespaces | 34 (common, auth, dashboard, navigation, users, …) |

Locale files: `i18n/locales/{ar,en}/*.json`

Hooks:

- `useLocale()` — change language, persist preference
- `useTr(namespace)` — typed translation helper

RTL/LTR document attributes applied via `utils/locale.js`.

Detailed Arabic documentation: [frontend/docs/I18N_AND_LOCALE_AR.md](../frontend/docs/I18N_AND_LOCALE_AR.md)

## Styling

- **SCSS** — main application styles in `assets/styles/`
  - Abstracts: variables, mixins
  - Layouts: admin, auth, portal shells
  - Components: forms, tables, cards
  - Pages: per-module page styles
- **Tailwind** — landing/marketing pages only

Light mode only (dark mode removed).

## Portal subdomain detection

`utils/portal.js` reads the hostname subdomain to determine the portal:

- `admin.*` → admin login
- `instructor.*` → instructor login
- `student.*` → student login
- `reviewer.*` → reviewer login

Used by `SubdomainLoginRedirect` on `/login`.

## Key shared components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Auth gate |
| `RoleBasedRoute` | Role gate |
| `PagePermissionGate` | Permission gate |
| `StatusBadge` | Status display |
| `DataTable` patterns | List pages |
| `Form*` components | Form inputs (FormSwitch, etc.) |
| `TenantReadonlyBadge` | Multi-tenant indicator |

## Build and deployment

```bash
npm run build    # Output: frontend/dist/
```

The build is validated in CI. Deploy `dist/` to any static host (Netlify, Vercel, S3, etc.).

Set production env vars before build:

```env
VITE_API_BASE_URL=https://your-api.example.com
VITE_APP_ORIGINS=https://lms.battechno.com
```

## Testing

No frontend test suite is configured. CI runs `npm run build` to validate compilation.

## Related docs

- [Architecture](ARCHITECTURE.md) — system design
- [API Reference](API.md) — backend endpoints
- [Roles & Permissions](ROLES_AND_PERMISSIONS.md) — RBAC
- [frontend/docs/PROJECT_JOURNEY_AR.md](../frontend/docs/PROJECT_JOURNEY_AR.md) — Arabic project history
