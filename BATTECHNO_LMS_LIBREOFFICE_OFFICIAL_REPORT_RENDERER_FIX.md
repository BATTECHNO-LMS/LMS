# BATTECHNO LMS — LibreOffice Official Report Renderer Fix

**Date:** 2026-09-01  
**Opportunity:** Mutah Field Training `6c8783ec-49fd-428e-83e2-8b65e52c3b4f`  
**Scope:** Enable official DOCX → PDF rendering, regenerate v8 evaluations, preserve fail-closed fidelity

---

## Template verification (unchanged — NOT modified)

| Check | Result |
|-------|--------|
| Template SHA256 | `fc21125e7b99bf29391437c009f382d738212b3fa2edbcbdeeda767fc95d7f0b` |
| Official baseline SHA256 | **MATCH** |
| Template version | **8** |
| Upload validation | **valid** |
| DOCX preflight | **PASS** (Mutah official, 2 pages, stamp/signature) |

No template re-upload, HTML fallback, or generic BATTECHNO PDF was used.

---

## Root cause

`RENDERER_NOT_AVAILABLE` — LibreOffice (`soffice`) was not installed/detectable on the local Windows backend runtime.

The system correctly refused HTML/Puppeteer substitutes to preserve official university DOCX fidelity.

---

## Local runtime environment

| Item | Value |
|------|--------|
| OS | Windows 10 (dev) |
| Backend | Direct Node (`npm run dev`), not Docker locally |
| Docker image | `node:20-alpine` (production path) |
| Install method | `winget install TheDocumentFoundation.LibreOffice` (v26.8.0.3) |
| Resolved executable | `C:\Program Files\LibreOffice\program\soffice.exe` |
| Detected version | `LibreOffice 26` (from `version.ini`; CLI `--version` is silent on Windows) |

Optional env override (document name only):

```
LIBREOFFICE_PATH
```

---

## Code changes

### New: `fieldTrainingEvaluation.renderer.js`

- `discoverLibreOfficeExecutable()` — `LIBREOFFICE_PATH` → platform paths → `where`/`which`
- `getOfficialDocumentRendererStatus()` — admin-safe status (no full path to UI users)
- Headless conversion via `spawn` argument arrays (no shell injection)
- Isolated temp profile: `-env:UserInstallation=file:///…`
- Bounded conversion queue (default concurrency **3**, env `FT_EVAL_PDF_CONCURRENCY`)

### Updated: `fieldTrainingEvaluation.pdf.js`

- Delegates to renderer module; still fail-closed on conversion failure

### Updated: `fieldTrainingEvaluation.readinessAggregate.js`

- `rendererReady` from `getOfficialDocumentRendererStatus()`
- Exposes `documentRenderer` in `templateReadiness`

### Updated: `fieldTrainingEvaluation.formFill.js`

- Comments cell fills as **single compact paragraph** (prevents LibreOffice PDF page overflow to 3 pages)

### Updated: `fieldTrainingEvaluation.comments.js`

- Eligible comment uses fixed official wording (no performance-summary append that overflowed layout)

### Updated: `backend/Dockerfile` (Alpine)

```dockerfile
apk add --no-cache libreoffice
```

Minimal headless runtime addition on `node:20-alpine` (not Debian commands on Alpine).

### Frontend: `ManageEvaluationTemplateTab.jsx`

- PDF engine status banner (LibreOffice available / official template ready)

### Scripts

- `_mutah-official-render-test.js` — one-student official render gate
- `_mutah-regenerate-v8-reports.js` — bulk v8 regeneration with `regenerate: true`

### Tests: `fieldTrainingEvaluation.renderer.unit.test.js`

- Path discovery, fail-closed, concurrent conversion isolation, 2-page PDF when LO available

---

## One-student test render (Omar Madadha — ELIGIBLE)

| Check | Result |
|-------|--------|
| Application | `f56fb447-af1e-4a00-9f43-27cdd1ca5274` |
| DOCX fill | PASS |
| LibreOffice conversion | PASS |
| PDF size | 202,797 bytes |
| Page count | **2** |
| Fidelity gate | PASS |
| Generic fallback | **NO** |
| Visual QA | **VISUAL_QA_BLOCKED** (no automated visual diff tooling) |

---

## Data readiness after renderer fix

| Metric | Count |
|--------|------:|
| Total considered | 104 |
| Evaluated population | 103 (BATUNI excluded) |
| **dataReady** | **92** |
| **dataMissing** | **11** |
| ELIGIBLE | 88 |
| NOT_ELIGIBLE | 16 |
| **templateGenerationReady** | **true** |
| **finalReady** | **92** |

---

## Outdated reports & regeneration

| Metric | Before | After |
|--------|-------:|------:|
| PDFs total | 58 | 102 |
| Current v8 verified | 0 | **92** |
| Outdated / legacy | 58 | **10** |

Bulk regeneration (`_mutah-regenerate-v8-reports.js --apply`):

- **92 / 92 generated**
- **0 failed**
- Historical PDF versions preserved via existing evaluation versioning (`is_current` rotation)

Remaining **10 outdated** artifacts belong to students still missing required data (old PDFs kept, not counted as current).

---

## Professional ratings & supervisors

| Action | Result |
|--------|--------|
| Bulk 5/5 (this run) | 0 new (already applied previously) |
| Supervisors recovered from Excel | 0 (not present in applied import) |
| Supervisors still missing | 6 |

---

## Production deployment plan

1. Rebuild backend Docker image (LibreOffice added to Alpine Dockerfile)
2. Redeploy backend container
3. Ensure `soffice` available at `/usr/bin/soffice` inside container (Alpine package)
4. Optional: set `LIBREOFFICE_PATH` if using custom install path
5. Optional: tune `FT_EVAL_PDF_CONCURRENCY` (default 3)
6. **Do not** install LibreOffice only on host if API runs in Docker — it must be **inside** the container

```bash
docker compose build backend
docker compose up -d backend
```

---

## Remaining genuine blockers

| Student | University Number | Blocker | Action |
|---------|-------------------|---------|--------|
| ينال محمد ياسين مامkغ | 120232222041 | Academic supervisor missing | Add to Excel import / manual entry — **only ELIGIBLE student blocked by supervisor** |
| Noor Talal Ziad ALNawaiseh | 120252222154 | Academic supervisor | Excel import (NOT_ELIGIBLE / pre-assessment) |
| Malak ksasbeh | 120252222134 | Supervisor + professional | Excel + ratings (NOT_ELIGIBLE) |
| زيد احمد الشيب | 120212212023 | Supervisor + professional | Excel + ratings (NOT_ELIGIBLE) |
| ابرار عواد علي الحباشneh | 120252222116 | Attendance/hours/expelled | **Do not fabricate** — keep blocked |
| BATUNI Student | — | Test account | Excluded from official population |
| ~9 NOT_ELIGIBLE students | various | Professional criteria incomplete | Not bulk-eligible; complete manually if reports needed |

---

## Suggested commit message

```
fix: enable LibreOffice rendering for official field training evaluations
```
