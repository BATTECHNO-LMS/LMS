# Getting Started

This guide walks you through setting up BATTECHNO LMS for local development.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ (20 recommended — matches CI) |
| npm | Bundled with Node |
| PostgreSQL | 14+ or managed service (Neon, Supabase, etc.) |
| Git | Any recent version |

## Clone and install

```bash
git clone <repository-url>
cd LMS

cd backend && npm install
cd ../frontend && npm install
```

## Database setup

### Option A: Local PostgreSQL

Create a database:

```sql
CREATE DATABASE lms;
```

### Option B: Neon (cloud)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string (pooler URL recommended for serverless)
3. Use `sslmode=require` in the connection string

**Note:** Neon suspends inactive databases on the free tier. The first connection after idle time may fail with Prisma error `P1001`. Wait a few seconds and restart the backend.

### Run migrations

```bash
cd backend
npm run prisma:migrate
```

For production deployments, use:

```bash
npm run prisma:deploy
```

### Seed data

Full development seed (roles, university, users):

```bash
npm run seed
```

Other seed scripts:

| Script | Purpose |
|--------|---------|
| `npm run seed:auth` | Minimum roles and auth data |
| `npm run seed:demo` | Extended demo content |

Default password for all seeded users: **`12345678`**

## Backend environment variables

Create `backend/.env`:

```env
# Core
NODE_ENV=development
PORT=4000
API_VERSION=v1

# Database (required for API features)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require

# Auth (required in production; use 32+ chars)
JWT_SECRET=local-dev-secret-change-me-32chars-min
JWT_EXPIRES_IN=7d

# CORS — comma-separated extra origins
CORS_ORIGINS=http://localhost:5173

# File uploads
UPLOAD_DIR=uploads
PUBLIC_BASE_URL=
STORAGE_BACKEND=local

# Optional
YOUTUBE_API_KEY=
TRUST_PROXY=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=30
```

### Production-only requirements

When `NODE_ENV=production`:

- `DATABASE_URL` is required
- `JWT_SECRET` must be at least 32 characters (`JWT_SECRET_MIN_LENGTH`, default 32)

### Role configuration (optional)

Role access is controlled via comma-separated `roles.code` env vars. Defaults are defined in `backend/src/config/env.js`. Example:

```env
ADMIN_READ_ROLE_CODES=super_admin,program_admin,university_admin
USER_WRITE_ROLE_CODES=super_admin,program_admin
```

See [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) for the full list.

## Frontend environment variables

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_ORIGINS=http://localhost:5173
# VITE_API_VERSION=v1   # optional, defaults to v1
```

Production example (commented in repo):

```env
# VITE_API_BASE_URL=https://lms-7txx.onrender.com
# VITE_APP_ORIGINS=https://lms.battechno.com,https://www.lms.battechno.com
```

## Start development servers

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

Expected output:

```
Connected to the database.
BATTECHNO-LMS API listening on port 4000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api` to `http://localhost:4000` (see `frontend/vite.config.js`).

## Verify installation

| Check | URL / command |
|-------|---------------|
| API root | `GET http://localhost:4000/` |
| Health | `GET http://localhost:4000/health` |
| DB ready | `GET http://localhost:4000/health/ready` |
| Backend tests | `cd backend && npm test` |
| Frontend build | `cd frontend && npm run build` |
| Prisma Studio | `cd backend && npm run prisma:studio` |

## Login

Use portal-specific login pages:

| Portal | URL |
|--------|-----|
| Admin | `/login/admin` |
| Instructor | `/login/instructor` |
| Student | `/login/student` |
| Reviewer | `/login/reviewer` |

After seeding, use `superadmin@batuni.edu` / `12345678` for admin access.

Students can self-register at `/register` if their email domain matches an active university email domain.

## Troubleshooting

### `P1001` — Can't reach database server

- **Neon cold start:** Wait 5–10 seconds and restart `npm run dev`
- **Wrong URL:** Verify `DATABASE_URL` in `backend/.env`
- **Network:** Ensure port 5432 is reachable
- **SSL:** Try removing `channel_binding=require` if present; keep `sslmode=require`

### CORS errors in browser

- Add your frontend origin to `CORS_ORIGINS` in `backend/.env`
- Default allowed origins include `http://localhost:5173`

### `DATABASE_URL is not set`

The server starts with a warning but most API routes need a database. Set `DATABASE_URL` and restart.

### Frontend cannot reach API

- Confirm `VITE_API_BASE_URL=http://localhost:4000`
- Restart Vite after changing `.env` (env vars are baked in at build/start)
- Check backend is running on port 4000

### JWT / 401 errors

- Ensure `JWT_SECRET` is set and consistent across restarts
- Log in again to get a fresh token

### Prisma client out of date

```bash
cd backend
npm run prisma:generate
```

## Next steps

- [Architecture](ARCHITECTURE.md) — understand the system design
- [API Reference](API.md) — explore endpoints
- [Frontend](FRONTEND.md) — frontend conventions and routing
