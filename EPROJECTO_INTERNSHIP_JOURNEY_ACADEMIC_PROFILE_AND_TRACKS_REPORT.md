# EPROJECTO Internship Journey — Academic Profile & Specialized Tracks

**Route:** `/internship-journey`  
**Execution:** LOCAL ONLY (no production deploy, no git commit)  
**Date:** 2026-10-21

---

## Existing route architecture

| Layer | Location |
|---|---|
| Public route | `frontend/src/app/router/index.jsx` → `INTERNSHIP_JOURNEY_PATH` |
| Page | `frontend/src/pages/public/InternshipJourneyPage.jsx` |
| Feature data | `frontend/src/features/internshipJourney/*` |
| UI components | `frontend/src/components/internshipJourney/*` |
| Scoped CSS | `internship-journey.css` (all selectors under `.ij-root`) |

Preserved from the prior page:

- Animated brand intro, roadmap, missions, evaluation weights, enrollment contacts/map/WhatsApp
- Local plan builder (no DB write on every dropdown change)
- Pass score `80` and EPROJECTO evaluation weight model

---

## University data source

**Primary:** `GET /api/v1/public/internship-journey/universities`  
Loads **active** universities from canonical `universities` table with public fields only (`id`, `name`, `name_en`, `short_name`, `code`).

**Fallback:** `FALLBACK_UNIVERSITIES` static Arabic list (used if API unreachable).  
Does **not** invent a second university database.  
**Other university:** free-text intake metadata only — never auto-creates a `universities` row.

---

## Faculty data source

**No canonical Faculty / College model** exists in Prisma (only optional `college_name_*` on `university_specialties`).

**Implementation:** extensible intake list `FACULTY_OPTIONS` + `كلية أخرى` free text.  
**Limitation:** faculties are not university-dependent (no fabricated University→Faculty graph).

---

## Major architecture

Stable codes (not Arabic labels):

| Code | Arabic label | Track |
|---|---|---|
| `MIS` | نظم المعلومات الإدارية (MIS) | MIS |
| `DIGITAL_MARKETING` | التسويق الرقمي | DIGITAL_MARKETING |
| `FINANCE_BANKING` | المالية والمصرفية | FINANCE_BANKING |
| `BUSINESS_ADMINISTRATION` | إدارة الأعمال | BUSINESS_ADMINISTRATION |

Catalog is code-driven (`TRACK_CATALOG` + `ACADEMIC_MAJORS` + `MAJOR_TO_TRACK`). Future majors require config entries only.  
Legacy IT tracks archived at `internshipJourney.legacyItTracks.js` (not shown in UI).

---

## Hours validation

| Rule | Value |
|---|---|
| Min | 80 |
| Max | 300 |
| Increment | 10 |
| Frontend | `validateAcademicProfile` / `HOURS_OPTIONS` |
| Backend | Zod schema + `isSupportedHours` on `POST /public/internship-journey/validate` |

Rejected examples: 75, 85, 310.

---

## Supported tracks & mapping

Each major maps 1:1 to a specialized Field Training track with skills, curriculum modules, practical tasks, and final project (see `internshipJourney.tracks.js`).

Intensity labels (same curriculum, scaled workload):

| Hours | Band |
|---|---|
| 80–110 | Foundation |
| 120–170 | Standard |
| 180–230 | Extended |
| 240–300 | Advanced |

---

## Training-hours scaling

Allocation (sums exactly to selected hours):

| Bucket | % |
|---|---|
| Professional Foundation | 20% |
| Specialization Core | 45% |
| Practical Tasks | 20% |
| Final Project / Portfolio | 15% |

Example 100h → 20 / 45 / 20 / 15. Example 200h → 40 / 90 / 40 / 30.

---

## UI/UX changes

1. Compact hero: specialty-oriented Arabic copy + CTA → `#configure`
2. Academic profile panel (progressive disclosure): University → Faculty → Major → Hours
3. Searchable combobox (RTL, mobile bottom-sheet panel)
4. Recommended track preview after valid submit
5. Roadmap / missions adapt to selected track + hours
6. Enrollment receives profile summary + prefilled WhatsApp message
7. Visual language aligned to eprojecto navy / ivory / champagne (existing `.ij-root` identity overrides)

---

## Mobile behavior

- One field per row below 800px
- Touch targets ~52px
- Combobox panel fixed to bottom safe area on small screens
- `.ij-root { overflow-x: hidden }`
- Dependent fields disabled until prior step complete

---

## Registration handoff

On successful build:

1. `sessionStorage` key `eprojecto.internshipAcademicProfile`
2. Enrollment WhatsApp message includes university, faculty, major, hours, track
3. Privacy-safe analytics events (`internship_*`) via `CustomEvent` / optional `dataLayer`

Query params are **not** authoritative. Server validates POST body on continue.

---

## API / schema changes

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/public/internship-journey/universities` | Public university directory |
| `GET /api/v1/public/internship-journey/tracks` | Major/track summaries |
| `POST /api/v1/public/internship-journey/validate` | Server validation (no persistence) |

**Database migration:** NONE  
No Faculty table, no auto university creation, no intake row on dropdown change.

---

## Tests

| Suite | Result |
|---|---|
| `frontend/tests/internshipJourney.publicPage.test.js` | 21 passed |
| `backend/tests/internshipJourney.public.unit.test.js` | 9 passed |

Coverage includes required fields, hours bounds/increments, major→track mapping, dependent reset wiring, WhatsApp handoff, and server validation without persistence.

---

## Responsive QA

Implemented via scoped CSS + media queries (`800`, `760`, `420`, `340`, `900`).  
Live screenshot loop across all listed viewports was not executed in a headed browser during this local session; layout rules target those sizes.

---

## Remaining limitations

1. Faculty list is intake config, not DB-backed per university.
2. Registration remains WhatsApp/phone/map handoff (no new Field Training application API write from this public page).
3. Legacy IT career tracks are archived, not deleted — UI focuses on the four business Field Training majors.
4. Live multi-viewport visual screenshot QA still recommended before production release.
5. Public university API requires a running local API for live directory; offline uses fallback names.
