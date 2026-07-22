# Phase 21 — Training Hours End-to-End

Authoritative field-training hours workflow across Backend, web, and Flutter.

## Authoritative model (Model A)

| Concept | Source | Write semantics |
|---------|--------|-----------------|
| Required hours | `field_training_opportunities.required_training_hours` (INTEGER NULL) | Opportunity create/update (admin manage roles) |
| Completed hours | `field_training_applications.completed_training_hours` (INTEGER NULL) | **Replace total** via instructor/admin PATCH |
| Remaining / % | Computed server-side from required + completed | Read-only |

**Null vs zero**

- Required `null` = no configured target (not the same as `0`).
- Required when set must be a positive integer.
- Completed `null` = not yet recorded.
- Completed `0` is a valid recorded total.

**Not chosen**

- Model B ledger (deferred; audit_logs cover change history).
- Model C attendance-derived hours as write source (attendance remains independent for eligibility %).

## Migration

Additive migration **29**:

`20260720140000_field_training_completed_hours`

Adds on `field_training_applications`:

- `completed_training_hours`
- `hours_updated_at`
- `hours_updated_by_id`
- non-negative CHECK
- index on `hours_updated_at`

Baseline **v1 remains 27**. Empty-DB flow:

1. Resolve baseline 27  
2. Deploy migration 28 (`required_training_hours`)  
3. Deploy migration 29 (`completed_training_hours`)  
4. Status **29/29**

Do **not** run on production from this phase.

## API endpoints

### Required hours

Already via opportunity create/update bodies:

- `required_training_hours` (optional, positive int or null)

Returned on opportunity list/detail mappers.

### Completed hours

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/instructor/field-training/applications/:applicationId/hours` | Assigned instructor |
| PATCH | `/api/v1/instructor/field-training/applications/:applicationId/hours` | Assigned instructor |
| GET | `/api/v1/admin/field-training/applications/:applicationId/hours` | FT staff |
| PATCH | `/api/v1/admin/field-training/applications/:applicationId/hours` | FT staff |

Also embedded in:

- Progress `metrics` + top-level `hours` on `.../progress`
- University student report rows
- Student semester schedule (prefers recorded completed; falls back to session-duration estimate)

### PATCH body (replace)

```json
{
  "completed_hours": 48,
  "note": "optional",
  "expected_completed_hours": 40
}
```

- `completed_hours` — new total (integer ≥ 0)
- `expected_completed_hours` — optimistic concurrency (must match current; `null` if none recorded)
- Rejects exceed-required when required is set (`HOURS_EXCEED_REQUIRED`)
- Stale expected → **409** `HOURS_CONFLICT`

## Authorization

- Instructors: only `assigned_instructor_id === current user`
- Students: read-only via progress/home payloads (no write route)
- Cross-university / unassigned → 403
- Expelled / non-approved application → 409

## Completion / certificates

Unchanged. Eligibility still uses attendance %, post-assessment, final task — **not hours**.

Hours progress is informational for UI/reports until product explicitly gates completion on hours.

## Audit trail

`recordAudit` action `field_training.hours.update` with previous/new completed hours, difference, note, opportunity id. Not exposed to students.

## Web

- Opportunity composer: required hours field + validation
- Manage overview: displays required hours
- Student detail drawer: `ApplicationHoursPanel` (replace total + note + conflict handling)

## Flutter

- Instructor participant detail: write sheet (replace total, concurrency, validation)
- Training detail: required hours display
- Student screens: continue reading Backend metrics (read-only)

## Concurrency

Optimistic via `expected_completed_hours`. Flutter/web refresh on 409.

## Known limitations

- No hours ledger / per-session hour entries
- Completion eligibility not gated on hours
- Integration tests against disposable Postgres not executed in this agent run (unit + Prisma validate + Flutter suite were)
- Migration 29 not deployed to production

## Test results (this phase)

| Suite | Result |
|-------|--------|
| Backend `fieldTraining.hours` + baseline + workflow focus | pass |
| Prisma validate | pass |
| Flutter analyze | 0 errors, 0 warnings (info only) |
| Flutter test | **59/59** pass |

## Next phase

Phase 22 — university/academic admin mobile surfaces using reusable hours widgets; optional eligibility gate when product confirms hours requirement.
