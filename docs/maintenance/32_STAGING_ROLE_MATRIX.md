# 32 — Staging Role Matrix (QA-STAGING-SMOKE-001)

**Status:** **Not executed** — staging URLs and seven-role credentials unavailable.  
**RC commit verified locally:** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3`

Credential placeholders (never commit values):

| Role | Email env | Password env | Browser smoke |
|------|-----------|--------------|---------------|
| super_admin | `$STAGING_SUPER_ADMIN_EMAIL` | `$STAGING_SUPER_ADMIN_PASSWORD` | Pending |
| university_admin | `$STAGING_UNIVERSITY_ADMIN_EMAIL` | `$STAGING_UNIVERSITY_ADMIN_PASSWORD` | Pending |
| academic_admin | `$STAGING_ACADEMIC_ADMIN_EMAIL` | `$STAGING_ACADEMIC_ADMIN_PASSWORD` | Pending |
| qa_officer | `$STAGING_QA_OFFICER_EMAIL` | `$STAGING_QA_OFFICER_PASSWORD` | Pending |
| instructor | `$STAGING_INSTRUCTOR_EMAIL` | `$STAGING_INSTRUCTOR_PASSWORD` | Pending |
| student | `$STAGING_STUDENT_EMAIL` | `$STAGING_STUDENT_PASSWORD` | Pending |
| university_reviewer | `$STAGING_UNIVERSITY_REVIEWER_EMAIL` | `$STAGING_UNIVERSITY_REVIEWER_PASSWORD` | Pending |
| program_admin (deprecated) | Do not use production PA | — | Must remain fail-closed; inactive; no student fallback |

## Checklist (to run when staging exists)

For each active role: login → landing → `/me` → nav → unauthorized deep link deny → logout → refresh session behavior.

| Role | Login | Landing | Nav | Deny deep-link | Cross-uni | Mobile shell | Notes |
|------|-------|---------|-----|----------------|-----------|--------------|-------|
| super_admin | — | `/admin` expected | — | — | N/A | — | Pending |
| university_admin | — | `/admin` | — | — | — | — | Pending |
| academic_admin | — | `/admin` + academic | — | — | — | — | Watch QA-ROLE-001 FT UI |
| qa_officer | — | `/admin` | — | — | — | — | QA-NAV-001 unmounted CRUD |
| instructor | — | `/instructor` | — | — | — | — | Pending |
| student | — | `/student` | — | — | — | — | Pending |
| university_reviewer | — | `/reviewer` | — | — | — | — | Read-only expected |
| program_admin | — | none | deny | — | — | — | Fail-closed only |

Automated AuthZ coverage remains high for most roles (see doc 21); **manual staging column stays Pending**.
