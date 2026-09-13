# Recorded Lectures authorization matrix (Phase 7)

Fixtures used in unit tests:

- University A: Zarqa (`4b85f423-c543-499e-9765-a5248dbfa583`), opportunity `cbe032b3-e7ef-475f-851e-faa7e61264b2`
- University B: Tafila (`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` in tests; production primary opp `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`)

Backend enforcement: `assertRecordedLectureReadAccess` / `assertRecordedLectureManageAccess` plus student enrollment checks. Admin/student routers also require `UNIVERSITY` organization type.

| ROLE | ORGANIZATION | OPPORTUNITY | LECTURE STATUS | ACTION | EXPECTED | ACTUAL (unit) |
| --- | --- | --- | --- | --- | --- | --- |
| super_admin (`isGlobal`) | none | Zarqa or Tafila | any | list / create | ALLOW | ALLOW |
| university admin | Zarqa | Zarqa | any | list / create / reorder / import / sync / publish / hide | ALLOW | ALLOW |
| university admin | Zarqa | Tafila | any | list / create / reorder / import | DENY 403 | DENY 403 |
| university admin | missing `universityId` | Zarqa | any | list / create | DENY 403 | DENY 403 |
| reviewer | Zarqa | Zarqa | any | list | ALLOW read-only | ALLOW |
| reviewer | Zarqa | Zarqa | any | create / edit / publish / hide / reorder / import / sync | DENY 403 | DENY 403 |
| reviewer | Zarqa | Tafila | any | list | DENY 403 | DENY 403 |
| student | Zarqa | Zarqa enrolled | PUBLISHED | list / detail / heartbeat | ALLOW | ALLOW |
| student | Zarqa | Zarqa enrolled | DRAFT or HIDDEN | detail / heartbeat | DENY 404 | DENY 404 |
| student | Zarqa | Tafila | PUBLISHED | list / detail / heartbeat | DENY | DENY |
| student | Zarqa | other Zarqa opportunity | PUBLISHED | detail by guessed id | DENY | DENY |
| institution admin | INSTITUTION | Zarqa | any | admin lecture endpoints | DENY | DENY |
| trainer | UNIVERSITY | Zarqa | any | admin lecture endpoints | DENY | DENY |
| trainee | UNIVERSITY | Zarqa | any | admin lecture endpoints | DENY | DENY |
| instructor (assigned) | UNIVERSITY | own opportunity | any | manage routes (instructor portal) | ALLOW if assigned | covered by `canManageFieldTraining` |
| academic / reviewer portal | UNIVERSITY | assigned university | any | read routes only | ALLOW read; no youtube import routes | ALLOW (academic mounts `mountReadRoutes` only) |

HTTP-level Playwright authenticated cells were skipped: QA admin/student/reviewer credentials were not provided. Isolation conclusions above are from backend unit tests, not live production accounts.
