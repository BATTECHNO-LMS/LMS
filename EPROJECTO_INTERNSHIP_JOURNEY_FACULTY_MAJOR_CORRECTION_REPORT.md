# EPROJECTO Internship Journey — Faculty/Major Correction Report

**Route:** `/internship-journey`  
**Execution:** LOCAL ONLY  
**Date:** 2026-10-21

---

## Root cause of previous selector issue

The academic selector showed a **global major list** (and previously a flat list of unrelated faculty labels). Majors were not filtered by faculty, so Business and IT majors could appear together under any faculty. University options were also pulled from **eprojecto tenant universities** (or a short fallback), which excluded many Jordanian institutions.

---

## Jordan university directory

| Category | Count (active) |
|---|---|
| PUBLIC | 10 |
| PRIVATE | 18 |
| SPECIAL_LAW | 2 |
| REGIONAL | 1 |
| **Total** | **31** (+ `OTHER`) |

Source modules:

- Frontend: `internshipJourney.universities.js`
- Backend: `internshipJourney.universities.js`

**Not** loaded from Prisma `universities` tenants. Selecting a university does not create Organization/University rows. Optional trusted map `EPROJECTO_UNIVERSITY_ID_BY_CODE` remains empty until configured.

---

## Faculty taxonomy

| Code | UI label |
|---|---|
| `BUSINESS` | كلية الأعمال والعلوم الإدارية |
| `INFORMATION_TECHNOLOGY` | كلية تكنولوجيا المعلومات والحوسبة |
| `OTHER` | كلية أخرى |

Aliases are search-only (not separate faculties).

---

## Faculty → Major mapping

- **BUSINESS:** Business Administration, Digital Marketing, Marketing, Finance & Banking, MIS, Accounting, HR, Entrepreneurship, FinTech, BI, Supply Chain, Other Business  
- **INFORMATION_TECHNOLOGY:** CS, SE, Cybersecurity, InfoSec, AI, Data Science, CIS, BIT, Networks, Cloud, XR, Other IT  

Cybersecurity **never** appears under Business. Finance **never** appears under IT.

---

## Major → Track mapping

| Majors | Track |
|---|---|
| Business Administration | `BUSINESS_ADMINISTRATION` |
| Digital Marketing / Marketing | `DIGITAL_MARKETING` |
| Finance & Banking (+ sciences) | `FINANCE_BANKING` |
| MIS | `MIS` |
| CS / SE / CIS / BIT | `SOFTWARE_DEVELOPMENT` |
| Cybersecurity / InfoSec / Networks | `CYBERSECURITY` |
| AI / Data Science / AI+DS | `DATA_AI` |
| Accounting, HR, etc. | `TRACK_NOT_CONFIGURED` |
| Other faculty/major | `REQUIRES_REVIEW` |

Unsupported majors are **never** silently mapped to Business Administration or Digital Marketing.

---

## Server validation

`POST /api/v1/public/internship-journey/validate` enforces:

1. University code ∈ Jordan directory (or OTHER + custom name)
2. Faculty ∈ controlled set
3. Major belongs to faculty (`isMajorAllowedForFaculty`)
4. Track derived server-side; client `trackCode` mismatch → 400
5. Hours 80–300 step 10
6. `persisted: false` — no DB writes

`GET /api/v1/public/internship-journey/universities` returns `source: jordan_directory`.

---

## UI behavior

- Majors options = `getMajorsForFaculty(facultyCode)` only  
- Faculty change clears major immediately  
- Helper text per faculty  
- Track preview after University + Faculty + Major + Hours  

---

## Migration status

**NONE** — configuration/modules only.

---

## Tests

- Frontend: faculty filters, directory completeness, track mappings, hours, CSS scope  
- Backend: directory source, tampering (IT+Finance / Business+Cyber), track derivation, hours  

---

## Remaining limitations

- Faculty/major taxonomy is **training-supported**, not a claim of each university’s official catalog.  
- `EPROJECTO_UNIVERSITY_ID_BY_CODE` not yet populated.  
- Some majors intentionally `TRACK_NOT_CONFIGURED` until curricula are authored.  
