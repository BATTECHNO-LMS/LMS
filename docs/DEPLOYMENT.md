# Deployment

This guide covers CI/CD, containerization, and production configuration for BATTECHNO LMS.

## Architecture in production

```
┌──────────────────┐         ┌──────────────────┐
│  Static host     │  HTTPS  │  API host        │
│  (frontend SPA)  │ ──────► │  (Node/Express)  │
│  lms.battechno   │         │  Render / Docker │
│  .com            │         │                  │
└──────────────────┘         └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │  PostgreSQL      │
                             │  (Neon, RDS, …)  │
                             └──────────────────┘
```

## CI pipeline

File: `.github/workflows/ci.yml`

Triggers on push/PR to `main`, `master`, `develop`.

### Backend job

```yaml
working-directory: backend
steps:
  - npm ci
  - npm test
  - npx prisma validate
```

Node version: **20**

### Frontend job

```yaml
working-directory: frontend
steps:
  - npm ci
  - npm run build
```

Node version: **20**

## Docker (backend)

File: `backend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
EXPOSE 10000
CMD ["npm", "start"]
```

### Build and run

```bash
cd backend
docker build -t battechno-lms-api .
docker run -p 10000:10000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-production-secret-32chars-min" \
  -e NODE_ENV=production \
  -e CORS_ORIGINS="https://lms.battechno.com" \
  battechno-lms-api
```

### Container notes

- Exposes port **10000** (configure `PORT=10000` or map accordingly)
- Run `prisma migrate deploy` before or during deploy
- `postinstall` runs `prisma generate` automatically
- No `docker-compose` is included in the repo

## Production environment variables

### Backend

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | No | Default 4000; use 10000 for Docker |
| `DATABASE_URL` | Yes | PostgreSQL connection string with SSL |
| `JWT_SECRET` | Yes | Minimum 32 characters |
| `CORS_ORIGINS` | Yes | Frontend production URL(s) |
| `PUBLIC_BASE_URL` | Recommended | API public URL for file links |
| `TRUST_PROXY` | Recommended | `true` behind reverse proxy |
| `STORAGE_BACKEND` | Optional | `local` or `s3` |
| `S3_PUBLIC_BASE_URL` | If S3 | CDN/bucket public URL |

### Frontend (build-time)

Set before `npm run build`:

| Variable | Example |
|----------|---------|
| `VITE_API_BASE_URL` | `https://lms-7txx.onrender.com` |
| `VITE_APP_ORIGINS` | `https://lms.battechno.com,https://www.lms.battechno.com` |

## CORS configuration

Built-in allowed origins in `backend/src/app.js`:

- `https://lms.battechno.com`
- `https://www.lms.battechno.com`
- `http://localhost:3000`
- `http://localhost:5173`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`
- Plus any origins in `CORS_ORIGINS` env var

Add your deployment URL to `CORS_ORIGINS` if not in the built-in list.

## Database migrations (production)

```bash
cd backend
npm run prisma:deploy
```

Run this as part of your deploy pipeline before starting the server.

## Health checks for orchestrators

| Endpoint | Use |
|----------|-----|
| `GET /health` | Liveness probe |
| `GET /health/ready` | Readiness probe (checks DB) |

## File storage

### Local (default)

Files stored in `backend/uploads/`, served at `/uploads/*`.

Set `PUBLIC_BASE_URL` so API responses return absolute URLs:

```env
PUBLIC_BASE_URL=https://api.example.com
STORAGE_BACKEND=local
```

### S3 (optional)

```env
STORAGE_BACKEND=s3
S3_PUBLIC_BASE_URL=https://cdn.example.com
```

## Rate limiting

Production defaults:

| Scope | Limit |
|-------|-------|
| General API | 300 req / 15 min per IP |
| Auth endpoints | 30 req / 15 min per IP |

Adjust via `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`.

Set `TRUST_PROXY=true` when behind a load balancer so rate limiting uses the real client IP.

## Graceful shutdown

`server.js` handles `SIGINT` and `SIGTERM`:

1. Closes HTTP server
2. Disconnects Prisma pool
3. Exits cleanly

Ensure your hosting platform sends these signals on deploy/restart.

## Deployment checklist

### Backend

- [ ] PostgreSQL provisioned with SSL
- [ ] `DATABASE_URL` set
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` includes frontend URL
- [ ] `TRUST_PROXY=true` if behind proxy
- [ ] `prisma migrate deploy` run
- [ ] Seed or migrate initial data if needed
- [ ] Health checks configured

### Frontend

- [ ] `VITE_API_BASE_URL` points to production API
- [ ] `npm run build` succeeds
- [ ] `dist/` deployed to static host
- [ ] SPA fallback routing configured (all routes → `index.html`)
- [ ] HTTPS enabled

## Known production URLs (from codebase)

| Service | URL |
|---------|-----|
| Frontend | `https://lms.battechno.com` |
| API (Render) | `https://lms-7txx.onrender.com` (referenced in frontend `.env` comments) |

Update these in your deployment configuration as needed.

## Monitoring recommendations

- Monitor `/health/ready` for database connectivity
- Watch for Prisma `P1001` errors (Neon cold starts)
- Log aggregation for Morgan request logs
- Alert on 5xx rate spikes

## Security checklist

- [ ] Strong `JWT_SECRET` (32+ random characters)
- [ ] HTTPS everywhere
- [ ] CORS restricted to known origins
- [ ] Rate limiting enabled
- [ ] Database credentials not in source control
- [ ] `helmet` middleware active (default)
- [ ] File upload size limit: 2 MB JSON body (`app.js`)
