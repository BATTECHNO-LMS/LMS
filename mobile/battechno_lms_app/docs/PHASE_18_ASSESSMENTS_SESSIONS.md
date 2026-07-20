# Phase 18 — Student Assessments & Sessions

Implemented in `mobile/battechno_lms_app`.

## Scope

- Pre/post field-training assessments (list, overview, paginated attempt, result)
- Training sessions list and session detail (from list payload; no student session GET)
- Read-only attendance display
- Field-training detail journey section
- Student home priority next action

## Endpoints used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/field-training/:id/assessments` | Assessment list + `can_take` |
| GET | `/api/v1/student/field-training/:id/assessments/:type` | Questions + existing attempt |
| POST | `/api/v1/student/field-training/:id/assessments/:type/submit` | Submit answers |
| GET | `/api/v1/student/field-training/:id/sessions` | Sessions + attendance |
| GET | `/api/v1/student/field-training/:id/progress` | Progress refresh after completion |

## Routes

- `/student/field-training/:id/assessments`
- `/student/field-training/:id/assessments/:type`
- `/student/field-training/:id/assessments/:type/attempt`
- `/student/field-training/:id/assessments/:type/result`
- `/student/field-training/:id/sessions`
- `/student/field-training/:id/sessions/:sessionId`

## Supported question types

- `multiple_choice`
- `multi_select`
- `true_false`
- `short_text` / `short_answer`
- `long_text`

## Backend gaps (UI handles safely)

- No start-attempt endpoint (submit creates attempt)
- No retakes (409 on second submit)
- No assessment deadline field
- No student session detail GET (mobile uses list `extra`)
- No student attendance write
- Per-question grading details only in submit response

## Testing

```bash
dart format .
flutter analyze
flutter test
```

## Next phase (19)

- Instructor mobile grading shortcuts
- Push notifications inbox
- Offline cache for progress/assessments
- Presigned file upload parity with web (R2)
