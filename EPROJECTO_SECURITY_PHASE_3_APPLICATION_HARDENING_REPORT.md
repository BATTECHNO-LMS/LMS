# EPROJECTO SECURITY PHASE 3 — Application Hardening Report

**Execution:** LOCAL / ISOLATED ONLY  
**Production security testing:** NO  
**Production modified:** NO  
**Production database used:** NO  
**Date:** 2026-10-17  

Suggested commit message (not created): `security: harden application inputs files exports and browser protections`

---

## 1. Executive summary

| Metric | Value |
|--------|------:|
| Confirmed SQL injection | 0 |
| Unsafe `$queryRawUnsafe` | 0 |
| Confirmed P0 app-sec | 0 |
| P1 found / fixed | 3 / 3 (open redirect CTA, logo SSRF/path, CSV formula) |
| P2 found / fixed (this phase) | Several / majority of confirmed |
| Backend Phase 3 unit tests | PASS |
| Frontend Phase 3 CTA tests | PASS |
| Frontend production build | PASS |
| Malware scanning | ABSENT (documented) |
| SPA CSP | PARTIAL (API Helmet CSP off by design; host Nginx owns SPA CSP) |

**Verdict:** No SQLi / command-injection / classic stored XSS in end-user text paths. Confirmed open-redirect, logo SSRF/local-file, CSV formula injection, and several upload/PDF/header hardenings were fixed locally. Remaining: dependency upgrades (major), full Excel-export coverage, JSZip inflation caps, SPA CSP at edge, malware quarantine design, and unfinished Phase 1D JWT-in-URL work.

---

## 2. Attack surface map

| Surface | Location | Notes |
|---------|----------|-------|
| Rich HTML | Help articles, CMS bodies | Admin-authored; custom `sanitizeHtml`; end-user guide renders as text |
| CTAs / deep links | Announcements, popups, notifications | Open-redirect risk — **fixed** |
| Login returnTo | `sanitizeReturnTo` | Already strong |
| Raw SQL | Analytics / FT / users | Parameterized `Prisma.sql` / tagged templates only |
| URL fetch | FT project URL | Strong SSRF controls preexisting |
| Logo fetch | Training/FT PDF | Was open fetch + cwd path — **fixed** |
| Uploads | Multer paths | UUID names; FT static blocked (Phase 2); eval mime — **fixed** |
| Archives | JSZip in-memory DOCX | No disk extract; inflation caps still REVIEW |
| Excel/CSV | Many exporters | CSV + users + FT report excel — **fixed**; others REVIEW |
| PDF | Puppeteer | EscapeHtml in templates; network allowlist fonts — **fixed** |
| LibreOffice | Eval DOCX→PDF | Argument arrays; document-engine residual risk |

---

## 3. Input validation

| Pattern | Assessment |
|---------|------------|
| Zod on write routes | Dominant — **STRONG** for most modules |
| Unknown fields | Zod `.strict()` / strip on many schemas — **PARTIAL** overall |
| `express.json` limit | **2 MB** (`app.js`) |
| Pagination max | Shared util max **100** (admin users up to 500) |
| Array bulk | Caps present on many endpoints; not universal |

---

## 4. Mass assignment

Re-checked dangerous spreads (Phase 2 already hardened lesson update + eval upload body). No new `data: req.body` into users/MFA/sessions found.

---

## 5–6. XSS / rich text

| Field/Component | Type | Sanitized | Executable before | After |
|-----------------|------|-----------|-------------------|-------|
| Announcements / popups body | Stored (admin) | Write-time regex sanitize; **rendered as React text** | No (escaped) | BLOCKED |
| Student help guide | Stored | Sanitized on write; text paragraphs | No | BLOCKED |
| Admin help preview `dangerouslySetInnerHTML` | Stored admin | `sanitizeHtml` + restore re-sanitize | Possible if sanitizer bypassed | HARDENED |
| Notifications | Stored | Text render | No | BLOCKED |
| Eval template preview HTML | Admin | API returns empty `html` | Dead sink | N/A |

Rich-text model: **plain text for end users**; **restricted HTML allowlist for admin CMS storage**; no DOMPurify (custom regex — defense-in-depth gap remains P3).

---

## 7–8. SQL injection / raw Prisma SQL

| File | User input | Parameterized | Risk | Result |
|------|------------|---------------|------|--------|
| All `$queryRaw` / `Prisma.sql` call sites (auth sessions, users, orgs, KPI, landing stats, FT attendance/letters, analytics command center) | UUIDs / bound values | Yes | Low | PASS |
| `$queryRawUnsafe` / `$executeRawUnsafe` | — | — | — | **None found** |
| Dynamic ORDER BY from client | — | Allowlists where used | — | No unsafe interpolation found |

**Unsafe raw SQL remaining: 0**

---

## 9. Command injection

| Site | Pattern | Result |
|------|---------|--------|
| `fieldTrainingEvaluation.renderer.js` | `spawn(soffice, argv, { shell: false })` | No shell injection; residual LibreOffice document exploit risk (P2/ops) |

---

## 10–11. SSRF / open redirect

| Issue | Status |
|-------|--------|
| FT `assertSafePublicUrl` | PASS (private IP / DNS / redirects) |
| Logo URL SSRF + cwd file read | **FIXED** — upload-root confinement + `assertSafePublicUrl` + no SVG + no redirect follow |
| `sanitizeCtaUrl` allowed `//evil` | **FIXED** |
| Notification `action_url` | **FIXED** (validation + frontend `sanitizeReturnTo`) |
| CMS CTA navigate | **FIXED** (`openSafeCtaUrl`) |
| `isSafeBackPath` | **FIXED** (aligned with returnTo guards) |
| Login `sanitizeReturnTo` | Already PASS |

---

## 12. CSRF

**Architecture:** Bearer JWT in `Authorization` header (SPA). Browser cannot attach Bearer cross-site without CORS + script. Cookie auth is not the primary API session mechanism.

**Verdict:** `NOT_APPLICABLE` for classic CSRF on API mutations. CORS allowlist + credentials config audited. Missing `Origin` still allowed for non-browser clients (documented).

---

## 13. CORS

- Allowlist via `corsOrigins.js` + `CORS_ORIGINS` env  
- `credentials: true`  
- No `*` with credentials  
- Development localhost origins in builtin list — keep out of production env  

**PASS** for intended model.

---

## 14–17. Files / path / archives / malware

| Upload type | Storage | Public? | Type validation | Size | Execution | Result |
|-------------|---------|---------|-----------------|------|-----------|--------|
| General files | Memory → storage | Private API | MIME allowlist | 100MB | Opaque | PASS |
| FT submissions | Disk UUID | Static blocked (P2) | Allowlist | 100MB | Opaque | PASS |
| Course covers | Disk UUID | Auth static | Images | 4MB | Low | PASS |
| Lesson training | Disk UUID | Auth static | PDF | 20MB | Low | PASS |
| Eval templates | Memory | Private | **MIME/ext filter added** | 50MB | LibreOffice residual | HARDENED |
| Archives | JSZip memory | N/A | No disk extract | — | Zip-slip N/A | Zip-bomb REVIEW |

**Malware scanning:** ABSENT — recommend quarantine → scan → release in Phase 4/ops.  
**Path traversal:** logo resolve confined; upload filenames UUID-based.

---

## 18. Excel/CSV formula injection

| Export | Before | After |
|--------|--------|-------|
| `reports.service` CSV | Vulnerable | **FIXED** (`escapeCsvCell`) |
| Users Excel | Vulnerable | **FIXED** (`cellText`) |
| FT report Excel | Vulnerable | **FIXED** (`excelCellValue`) |
| Other ExcelJS exporters | Possible | REVIEW (shared helper ready) |

---

## 19. PDF / DOCX

| Control | Status |
|---------|--------|
| HTML escaping in templates | PASS |
| Puppeteer request lockdown | **FIXED** (fonts allowlist only) |
| DOCX template path from client | Not arbitrary |
| LibreOffice conversion | Argv-safe; treat untrusted DOCX carefully |

---

## 20–21. Security headers / CSP

| Header | Current (API) | Recommended | Local final |
|--------|---------------|-------------|-------------|
| CSP | Disabled on API (JSON) | SPA CSP at Nginx/Vite host | PARTIAL |
| X-Content-Type-Options | Helmet default nosniff | Keep | PASS |
| Referrer-Policy | **strict-origin-when-cross-origin** | Same | PASS |
| Frameguard | **deny** | Same for API | PASS |
| Permissions-Policy | Helmet default-ish | Tune at edge for SPA | PARTIAL |
| HSTS | When HTTPS / reverse proxy | Prod Nginx | Plan Phase 4 |

---

## 22. Error leakage

`error.middleware.js`: no stack to clients in production; `requestId` + catalog codes. **PASS**.

---

## 23. Payload / DoS limits

| Control | Status |
|---------|--------|
| JSON 2MB | PASS |
| Pagination max | PASS (shared) |
| Upload sizes | Present |
| Bulk ID arrays | Partial / REVIEW for every bulk route |
| Report generation rate limits | Phase 1A limiters; expensive jobs REVIEW |

---

## 24. Public endpoints

| Endpoint | Notes |
|----------|-------|
| Landing stats | Visit counter side effect on GET — intentional analytics; classify as documented exception |
| Public certificate verify | Keep minimal fields (prior design) |
| Specialties list | Public by design |

---

## 25. Dependency findings (`npm audit --omit=dev`)

| Area | Critical | High | Moderate |
|------|---------:|-----:|---------:|
| Backend | 2 | 18 | 14 |
| Frontend | 0 | 3 | 4 |

Notable: **puppeteer** / **exceljs** / transitive chains — fixes often require **major** upgrades (do not blind-upgrade in Phase 3). Classify as production-reachable transitive risk; schedule controlled upgrades in Phase 4 supply-chain work.

---

## 26. Issues fixed (findings table)

| ID | Severity | Category | Endpoint/File | Exploit | Status | Fix |
|----|----------|----------|---------------|---------|--------|-----|
| P3-01 | P1 | Open redirect | `sanitizeCtaUrl`, CMS CTA, notifications | `//evil` navigate | FIXED | `safeAppPath` + FE `sanitizeReturnTo` / `openSafeCtaUrl` |
| P3-02 | P1 | SSRF / LFI | `trainingReportPdf.service` logo | Fetch internal / read cwd files into PDF | FIXED | Upload-root only + `assertSafePublicUrl` + no SVG |
| P3-03 | P1 | Formula injection | CSV reports | `=1+1` cell | FIXED | `spreadsheetSafe` |
| P3-04 | P2 | Formula injection | Users + FT Excel | Formula prefixes | FIXED | Shared helper |
| P3-05 | P2 | XSS restore | Help version restore | Unsanitized HTML restore | FIXED | Re-`sanitizeHtml` |
| P3-06 | P2 | Upload | Eval template multer | Non-docx upload | FIXED | fileFilter |
| P3-07 | P2 | PDF SSRF | Puppeteer | Remote fetch from HTML | FIXED | Request allowlist |
| P3-08 | P2 | Headers | `app.js` Helmet | Clickjack / referrer | FIXED | frameguard + referrerPolicy |
| P3-09 | P2 | Validation | Org `logo_url` | Arbitrary URL | FIXED | Zod refine |
| P3-10 | P2 | Open redirect | `isSafeBackPath` | Weaker than returnTo | FIXED | Aligned guards |

---

## 27. Remaining risks

1. Phase **1D incomplete** (JWT query still on `/uploads` + SSE).  
2. Other Excel exporters not yet wired to `sanitizeSpreadsheetCell`.  
3. JSZip DOCX inflation / entry-count limits.  
4. LibreOffice document-engine risk.  
5. Custom HTML sanitizer ≠ DOMPurify.  
6. SPA CSP / Permissions-Policy at Nginx.  
7. Malware scanning absent.  
8. npm audit critical/high — needs staged major upgrades.  
9. DNS rebinding residual on FT URL fetch (documented).

---

## 28. Tests

| Suite | Result |
|-------|--------|
| `backend/tests/security.phase3.appHardening.unit.test.js` | PASS |
| `frontend/tests/security.phase3.ctaNavigation.unit.test.js` | PASS |
| Phase 2 hardening units | PASS |
| Frontend `vite build` | PASS |

---

## 29. Production deployment requirements (NOT performed)

1. Deploy FE+BE together with Phase 3 CTA/logo/export changes.  
2. Complete Phase 1D before relying on URL-token removal.  
3. Configure SPA CSP + HSTS on host Nginx.  
4. Plan puppeteer/exceljs upgrades separately.  
5. Optional: ClamAV quarantine pipeline.

---

## 30. Recommended Phase 4

**EPROJECTO SECURITY PHASE 4 — Infrastructure, container, database, secrets & supply-chain hardening**  
(plus finish Phase 1D JWT URL removal if not already production-ready).
