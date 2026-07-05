# BATTECHNO LMS

A full-stack Learning Management System for university micro-credential programs. The platform supports multi-role portals (admin, instructor, student, university reviewer), curriculum delivery, assessments, quality assurance, recognition workflows, and certificate issuance.

## Repository structure

```
LMS/
├── backend/          # Node.js + Express REST API (battechno-lms-api)
├── frontend/         # React + Vite SPA (battechno-lms-web)
├── docs/             # Project documentation
└── .github/workflows # CI (backend tests + frontend build)
```

## Tech stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | Node.js 18+, Express 4, Prisma 6, PostgreSQL, JWT, Zod, bcrypt |
| **Frontend** | React 18, Vite 5, React Router 6, TanStack Query, Axios, i18next |
| **Database** | PostgreSQL (e.g. Neon, local, or managed cloud) |
| **CI** | GitHub Actions — backend tests + Prisma validate + frontend build |

## Quick start

### Prerequisites

- Node.js 18 or later (Node 20 recommended)
- PostgreSQL database
- npm

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for all variables):

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/lms?sslmode=require
JWT_SECRET=your-local-dev-secret-at-least-32-chars
CORS_ORIGINS=http://localhost:5173
```

Run migrations and real baseline seed:

```bash
npm run prisma:migrate
npm run seed:real-baseline
```

To remove prior demo/test data (preview first, then confirm):

```bash
npm run cleanup:demo
npm run cleanup:demo -- --confirm-clean-demo
```

Start the API:

```bash
npm run dev
```

API runs at `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_ORIGINS=http://localhost:5173
```

Start the dev server:

```bash
npm run dev
```

App runs at `http://localhost:5173`. Vite proxies `/api` requests to the backend.

### 3. First-time setup (real baseline)

After `npm run seed:real-baseline`, the database contains:

- System roles (RBAC)
- **جامعة مؤتة** (Mutah University) with active domain **`mutah.edu.jo`**
- 10 global active specialties for registration and Field Training

**No default login accounts are created.** Create the first Super Admin through the admin panel or a secure one-off script. Do **not** run `seed:demo` or `seed:analytics-demo` on production.

Student self-registration accepts university emails ending with `@mutah.edu.jo` when domain validation is enabled.

### Demo seeds (local/staging only)

| Script | Purpose |
|--------|---------|
| `npm run seed:demo` | TTU demo curriculum (dev only) |
| `npm run seed:analytics-demo` | Large synthetic analytics dataset (dev only) |
| `npm run seed:auth` | Minimal auth smoke-test university (dev only) |

## Documentation

### العربية — توثيق كامل للموقع

| Document | Description |
|----------|-------------|
| **[docs/التوثيق_الشامل.md](docs/التوثيق_الشامل.md)** | **التوثيق الكامل** — كل صفحات الموقع، البوابات، سير العمل، API، التثبيت |

### English

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Environment setup, migrations, seeding, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, request flow, module layout |
| [docs/API.md](docs/API.md) | REST API endpoints reference |
| [docs/DATABASE.md](docs/DATABASE.md) | Database schema and entity relationships |
| [docs/FRONTEND.md](docs/FRONTEND.md) | React app structure, routing, features, i18n |
| [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) | RBAC, roles, and authorization model |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | CI/CD, Docker, production configuration |

Additional frontend docs (Arabic):

- [frontend/docs/PROJECT_JOURNEY_AR.md](frontend/docs/PROJECT_JOURNEY_AR.md) — frontend project history and structure
- [frontend/docs/I18N_AND_LOCALE_AR.md](frontend/docs/I18N_AND_LOCALE_AR.md) — internationalization details

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Service info |
| `GET /health` | Liveness |
| `GET /health/ready` | Readiness (includes DB ping) |

## Scripts reference

### Backend (`backend/`)

| Script | Command |
|--------|---------|
| Dev server (watch) | `npm run dev` |
| Production start | `npm start` |
| Run tests | `npm test` |
| Prisma migrate (dev) | `npm run prisma:migrate` |
| Prisma migrate (prod) | `npm run prisma:deploy` |
| Prisma Studio | `npm run prisma:studio` |
| Real baseline (Mutah + specialties) | `npm run seed` or `npm run seed:real-baseline` |
| Remove demo/test data (dry-run) | `npm run cleanup:demo` |
| Remove demo/test data (execute) | `npm run cleanup:demo -- --confirm-clean-demo` |
| Demo curriculum (dev only) | `npm run seed:demo` |
| Analytics demo dataset (dev only) | `npm run seed:analytics-demo` |
| Minimum auth smoke test (dev only) | `npm run seed:auth` |

### Frontend (`frontend/`)

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |

## License

Private — BATTECHNO.
