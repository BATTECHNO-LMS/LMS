# LMS Backend Documentation (Legacy)

> **This file has been superseded.** See the full documentation in the [`docs/`](docs/) folder.

## Quick links

| Document | Description |
|----------|-------------|
| **[docs/التوثيق_الشامل.md](docs/التوثيق_الشامل.md)** | **التوثيق الكامل للموقع (عربي)** |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Setup and environment |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/DATABASE.md](docs/DATABASE.md) | Database schema |
| [docs/FRONTEND.md](docs/FRONTEND.md) | React frontend guide |
| [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) | RBAC |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | CI/CD and production |

## Summary

The backend (`battechno-lms-api`) is a Node.js + Express REST API using Prisma 6 and PostgreSQL. It follows a modular domain-driven structure under `backend/src/modules/`.

**Tech stack:** Express 4, Prisma 6, PostgreSQL, JWT, bcrypt, Zod, helmet, cors, express-rate-limit.

**Entry points:** `src/server.js` (process), `src/app.js` (Express app).

**API prefixes:** `/api/auth`, `/api/v1`.

For the complete API endpoint list, environment variables, and architecture details, see [docs/API.md](docs/API.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
