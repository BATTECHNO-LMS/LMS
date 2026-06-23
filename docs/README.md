# BATTECHNO LMS — Documentation

Welcome to the BATTECHNO LMS documentation. This guide covers setup, architecture, API, database, frontend, permissions, and deployment.

## العربية — التوثيق الكامل للموقع

| المستند | الوصف |
|---------|--------|
| **[التوثيق الشامل](./التوثيق_الشامل.md)** | **التوثيق الكامل للموقع** — كل الصفحات، البوابات، سير العمل، API، التثبيت، والنشر (عربي) |
| [PROJECT_JOURNEY_AR.md](../frontend/docs/PROJECT_JOURNEY_AR.md) | رحلة مشروع الواجهة الأمامية |
| [I18N_AND_LOCALE_AR.md](../frontend/docs/I18N_AND_LOCALE_AR.md) | الترجمة واللغة |

## Who is this for?

- **Developers** setting up a local environment or contributing code
- **DevOps** deploying the API and frontend
- **Product / QA** understanding roles, workflows, and feature boundaries

## Documentation map

| Guide | Topics |
|-------|--------|
| [Getting Started](GETTING_STARTED.md) | Prerequisites, `.env` files, database setup, seeding, common issues |
| [Architecture](ARCHITECTURE.md) | Monorepo layout, request lifecycle, backend modules, frontend layers |
| [API Reference](API.md) | All REST endpoints, auth, response format |
| [Database](DATABASE.md) | Prisma models, relationships, migrations |
| [Frontend](FRONTEND.md) | React structure, routing, features, i18n, API client |
| [Roles & Permissions](ROLES_AND_PERMISSIONS.md) | RBAC model, role codes, env-driven access control |
| [Deployment](DEPLOYMENT.md) | CI pipeline, Docker, production env vars, CORS |

## Product overview

BATTECHNO LMS manages the full lifecycle of micro-credential programs at partner universities:

1. **Curriculum** — tracks, micro-credentials, learning outcomes, modules, content
2. **Delivery** — cohorts, enrollments, sessions, attendance
3. **Assessment** — assessments, rubrics, submissions, grades
4. **Quality assurance** — evidence, QA reviews, corrective actions, risk and integrity cases
5. **Recognition** — university recognition requests and documents
6. **Certification** — verifiable certificates with public verification
7. **Standalone courses** — super-admin managed courses with lesson training workflows
8. **Field training** — internship-style opportunities, applications, and task submissions

## User portals

The frontend exposes four role-based portals:

| Portal | URL prefix | Primary users |
|--------|------------|---------------|
| Admin | `/admin/*` | Super admin, program admin, university admin, academic admin, QA officer |
| Instructor | `/instructor/*` | Instructors |
| Student | `/student/*` | Students |
| Reviewer | `/reviewer/*` | University reviewers |

Login pages are portal-specific (`/login/admin`, `/login/instructor`, etc.). Subdomain detection can redirect `/login` to the correct portal.

## API base URLs

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Local | `http://localhost:4000` | `http://localhost:5173` |
| Production | Configured via `PUBLIC_BASE_URL` / hosting | `https://lms.battechno.com` |

Versioned API routes: `/api/v1/*`  
Auth routes: `/api/auth/*`

## Related files

- Root [README.md](../README.md) — quick start
- [backend_documentation.md](../backend_documentation.md) — legacy backend summary (see docs for full reference)
- [frontend/docs/PROJECT_JOURNEY_AR.md](../frontend/docs/PROJECT_JOURNEY_AR.md) — Arabic frontend journey doc
- [frontend/docs/I18N_AND_LOCALE_AR.md](../frontend/docs/I18N_AND_LOCALE_AR.md) — Arabic i18n doc
