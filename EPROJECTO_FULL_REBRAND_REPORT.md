# eprojecto Full Product Rebrand Report

## Identity

| | |
|---|---|
| Old product name | BATTECHNO LMS / BATTECHNO-LMS / LMS (as product wording) |
| New product name | **eprojecto** |
| Canonical domain | https://eprojecto.com |
| Owning company (unchanged) | BATMAN TECHNOLOGY / شركة الرجل الوطواط للتكنولوجيا |
| Legacy domain | https://lms.battechno.com → 301 → https://eprojecto.com |

eprojecto is the current product name. Previously branded internally/publicly as BATTECHNO LMS.

This change is brand-only. Field Training scoring, attendance, eligibility, assessments, YouTube tracking, permissions, and Prisma/database identifiers were not modified.

---

## Classification applied

Every occurrence was classified before change:

| Class | Action |
|---|---|
| A. User-facing brand | Replaced with `eprojecto` |
| B. Domain / URL | Canonical URLs → `https://eprojecto.com`; legacy host kept for 301/CORS |
| C. SEO / metadata | `index.html` title, description, canonical, Open Graph, Twitter |
| D. Email / communication | OTP templates, subjects, From display name |
| E. Report / PDF / Excel | Platform chrome/creator/filenames → `eprojecto` |
| F. Certificate / completion letter | Issuer remains BATMAN TECHNOLOGY; software footer default is `eprojecto` |
| G. Frontend asset | Old LMS PNG removed from shell; text wordmark used |
| H. Backend response | `GET /` service label → `eprojecto API` |
| I. Internal technical identifier | Preserved (Docker names, package `name`, User-Agent, health `service`) |
| J. Legal/company reference | Preserved as BATMAN TECHNOLOGY |
| K. Historical migration/deployment identifier | Preserved (docs, baselines, qa-artifacts) |

---

## Files changed (implementation)

### New

- `frontend/src/config/brand.js` — `APP_NAME`, `APP_URL`, `COMPANY_NAME`
- `backend/src/config/brand.js` — same split + `formatEmailFrom()`
- `frontend/src/hooks/useDocumentTitle.js`
- `deploy/nginx-eprojecto.com.conf` — canonical app vhost (repo only; not applied remotely)
- `EPROJECTO_FULL_REBRAND_REPORT.md` (this file)

### Frontend (user-facing)

- Shell: `BrandLogo.jsx` (text wordmark, no old LMS PNG), navbar, sidebar, footer, landing footer
- Pages: login, register, forgot password, portals, institution register, legal/privacy/deletion, settings default, landing i18n, auth i18n, Field Training builder help
- SEO: `frontend/index.html`
- Compose/Docker ARG: `VITE_APP_ORIGINS` → eprojecto.com
- Export filename fallbacks in analytics client

### Backend (user-facing)

- Email verification + password reset HTML/text + subjects
- Resend From display: `eprojecto <existing-mailbox>` (mailbox unchanged)
- CORS: `https://eprojecto.com` and `https://www.eprojecto.com` first; legacy LMS origins retained
- Field Training / training / analytics PDF+Excel platform branding and workbook creator
- Push generic AR title
- `GET /` JSON `service`

### Mobile

- App title, ARB/localizations, login wordmark, Play deletion URLs

### Infra (repo configs only)

- `deploy/nginx-lms.battechno.com.conf` converted to intentional 301
- Playwright QA default base URL → `https://eprojecto.com`

---

## Pages updated

Login, register, forgot password, landing, portals, dashboard header/sidebar/footer, privacy, account deletion, admin settings default, Field Training assessment builder help, report hub fallback, 404 (uses shared shell brand).

No standalone Terms document existed beyond a muted footer label; product name on legal pages is eprojecto, operator is BATMAN TECHNOLOGY.

---

## Email templates updated

- `emailVerificationOtp.template.js`
- `passwordResetOtp.template.js`
- Subjects in `email.service.js`
- From display name via `formatEmailFrom()`

SMTP mailbox default remains `no-reply@lms.battechno.com` (deliverability; domain not assumed verified for eprojecto).

---

## Reports updated

Platform software branding only:

- Field Training university/student HTML cover + PDF footer
- Training course reports (`platformName`)
- Analytics PDF/Excel titles, creator, filenames
- User export Excel title/creator
- Excel workbook `creator` metadata

Legal/report issuer preserved:

- Completion letters: BATMAN TECHNOLOGY logo + issuer copy
- Comprehensive/cohort report footers: `BATMAN TECHNOLOGY`
- Mutah official evaluation fidelity still **forbids** leaking `BATTECHNO LMS` (and now also `eprojecto`) into university forms

---

## Legal/company references intentionally preserved

- BATMAN TECHNOLOGY / شركة الرجل الوطواط للتكنولوجيا
- `privacy@battechno.com`
- Institution seed `BATTECHNO` (training provider org, not product name)
- Completion-letter asset `batman-technology-logo.png`

---

## Technical legacy identifiers intentionally preserved

- Docker: `battechno-lms-backend`, `battechno-lms-frontend`
- npm `name`: `battechno-lms-api`, `battechno-lms-web`
- Flutter package: `battechno_lms_app` / application IDs
- Health liveness: `service: 'battechno-lms-api'`
- User-Agents: `BATTECHNO-LMS/1.0`, `BATTECHNO-LMS-ContentFetcher/1.0`
- Prisma models/tables, `/root/BATTECHNO_LMS` host path, git remote name
- R2 bucket default `lms-uploads`
- Empty-DB baseline SQL header comments

---

## Old domain references intentionally preserved

- Nginx 301: `lms.battechno.com` → `eprojecto.com`
- CORS allowlist (transition)
- `RESEND_FROM_EMAIL` default mailbox
- Historical `qa-artifacts/` and `BATTECHNO_LMS_*.md` reports

---

## Remaining `"BATTECHNO LMS"` matches (active product code)

| Location | Reason |
|---|---|
| `fieldTrainingEvaluation.fidelity.js` | Forbidden leak marker so Mutah official PDFs do not contain old (or new) platform chrome |
| `fieldTrainingEvaluation.mutahGenerator.unit.test.js` | Asserts Mutah PDFs do **not** contain `BATTECHNO LMS` |
| `README.md` / mobile README | Migration history sentence |
| `BATTECHNO_LMS_*.md`, `docs/**`, `qa-artifacts/**` | Historical documentation; not the live UI |

No remaining match in frontend `src/` i18n or compiled `dist/` user strings.

---

## Remaining `"lms.battechno.com"` matches

| Location | Reason |
|---|---|
| `deploy/nginx-lms.battechno.com.conf` | Required 301 redirect |
| `backend/src/app.js` + `health.test.js` | Temporary CORS compatibility |
| `RESEND_FROM_EMAIL` default | Technical sender mailbox |
| `qa-artifacts/**`, historical docs | Past measurements |

Canonical generated/public URLs in this change set use `https://eprojecto.com`.

---

## Asset notes

- **EPROJECTO_ICON_ASSET_REQUIRED** — no official eprojecto logo/favicon/app icon in the repo. Shell uses a navy text wordmark `eprojecto`.
- Old LMS PNG `frontend/src/assets/images/battechno-lms-logo-transparent.png` is no longer referenced by the UI shell or report HTML (text wordmark instead). File kept on disk to avoid breaking any out-of-band references; do not show it as the product mark.
- Company completion-letter logo kept.

No PWA `manifest.json` / service worker existed; nothing to version.

---

## Tests

### Frontend build

**PASS** (`npm run build`). Compiled `dist/` contains `eprojecto` and **zero** `BATTECHNO LMS` / `lms.battechno.com` / old LMS logo hashed assets.

### Brand-related backend unit tests

**PASS** (41 passed, 1 skipped): report templates, CORS including eprojecto.com, push generic title.

### Full backend `npm run test:unit`

3 failures, **not caused by user-facing brand copy**:

1. `baselineManifest` — cutoff list missing a later recorded-lectures migration (pre-existing baseline drift)
2. `fieldTraining.completedHours.regression` — Neon unreachable from this machine
3. `completionLetters.supervisorExcel` PDF text extract `/عاصم/` — RTL pdf-parse flake; letter HTML still contains student identity; completion-letter **issuer** remains BATMAN TECHNOLOGY

### Frontend `npm run test:unit`

Account deletion/legal tests **PASS**. One unrelated failure: evaluation template native file-input assertion (not a brand file).

### Playwright

**Not executed.** Requires a running app and credentials. Production still serves the previous UI until this branch is deployed. QA default `baseURL` was updated to `https://eprojecto.com`.

### Visual browser pass

Not run in this session (no local dev server / no production deploy). Verification is source + `dist/` string audit.

---

## Brand QA checklist

| Surface | Result |
|---|---|
| Login | PASS (i18n + wordmark + title) |
| Register | PASS |
| Navbar | PASS |
| Sidebar | PASS |
| Footer | PASS |
| Browser title | PASS |
| SEO metadata | PASS |
| Emails | PASS |
| Notifications | PASS (push generic AR title; in-app CMS/DB articles not rewritten) |
| Help center | PASS in code/i18n (no old product string). **DB-authored help articles were not migrated.** |
| Privacy | PASS |
| Terms | PASS (no separate terms body; footer label unchanged functionally) |
| Admin / Student / Reviewer portals | PASS (shared shell) |
| Courses / Micro-Credentials / Field Training / Recorded Lectures | PASS (shell only) |
| Reports | PASS (platform chrome) |
| Certificates | PASS (issuer unchanged) |
| Completion Letters | PASS (issuer BATMAN TECHNOLOGY preserved) |
| Generated URLs | PASS for new/canonical links |

---

## Follow-up (not in this change)

1. Supply official eprojecto logo + favicon (`EPROJECTO_ICON_ASSET_REQUIRED`).
2. Deploy this branch; then users will stop seeing BATTECHNO LMS on https://eprojecto.com.
3. Optionally rewrite stored `system_settings.platform_name` and CMS/help rows if they still say BATTECHNO LMS.
4. Verify `eprojecto.com` for Resend/From if the mailbox should move later.
5. Update historical `docs/` separately if desired; not required for the live product.

Suggested commit (not created):

`feat: rebrand BATTECHNO LMS to eprojecto`
