# Field Training QA — Video Index

Generated: 2026-09-10

Base URL: `https://lms.battechno.com`

All videos recorded with Playwright `video: "on"` and on-screen QA overlays.

| Video | Tests covered | Start / end | Result | Related QA IDs |
|-------|---------------|-------------|--------|----------------|
| `videos/01_admin_field_training_full_flow.webm` | Gateway → university portal → FT admin entry | Start: portal gateway with FT university-only note; End: FT/admin navigation attempt | PASS (auth via later authenticated run) | UI-01, UI-02, ARCH-01 |
| `videos/02_student_training_flow.webm` | Unauth student FT + gateway FT scope copy | Start: `/student/field-training`; End: gateway cards | PASS | UI-01, SEC-02 |
| `videos/03_attendance_hours_flow.webm` | Attendance/hours admin surface reachability | Start: overlay; End: FT hub | PASS_WITH_ISSUES (deep manage tabs require authenticated deep links — see FULL video) | MUT-01 |
| `videos/04_tasks_submission_grading_flow.webm` | Tasks surface reachability | Start: overlay; End: FT hub | PASS_WITH_ISSUES | ARCH-03 |
| `videos/05_assessments_flow.webm` | Assessments navigation + pageerror watch | Start: overlay; End: FT hub | PASS | — |
| `videos/06_professional_evaluation_flow.webm` | Evaluation/reports hub | Start: overlay; End: reports route | PASS | — |
| `videos/07_eligibility_logic_flow.webm` | Eligibility surface / Tafila presence | Start: overlay; End: FT hub | PASS | TAF-01, LAITH-01 |
| `videos/08_reports_exports_flow.webm` | Reports hub | Start: overlay; End: reports | PASS / Excel deep export BLOCKED | EXCEL-01 |
| `videos/09_permissions_scope_flow.webm` | Unauth API + gateway permissions evidence | Start: API 401 checks; End: unauth FT redirect | PASS | SEC-01, SEC-02, SEC-03 |
| `videos/10_edge_cases_and_invalid_states.webm` | Invalid opportunity UUID / bogus route | Start: API negative; End: invalid UI route | PASS | BUG-CL-01 (context) |
| `videos/FIELD_TRAINING_FULL_QA.webm` | **Authenticated** super_admin deep journey (API session inject) | Start: FT hub with Tafila 151 / Mutah / Zarqa cards; End: reports/evals deep routes + API smoke | PASS | UI-02, TAF-01, TAF-03, API-01 |

## Traces

Playwright traces (zip) under `qa-artifacts/field-training/traces/` and raw folders under `playwright-raw/`.

## Screenshots (selected)

- `screenshots/01_gateway_university_only_ft_note.png` — FT university-only policy on gateway
- `screenshots/auth_01_admin_ft_hub.png` — authenticated FT hub (4 opportunities, 295 applications)
- `screenshots/login_failed.png` — UI form login hung without reliable portalType wait (API login works)
- `screenshots/09_permissions_ui.png` — unauth admin FT redirect
- `screenshots/10_invalid_opportunity_route.png` — invalid route handling

## Notes for reviewers

1. Early videos include portal-gateway evidence and overlays even when UI password login was flaky.
2. Deep authenticated evidence is in `FIELD_TRAINING_FULL_QA.webm` (token injected via `/api/auth/login` + `battechno_lms_auth_*` storage keys).
3. No production student data was mutated during video QA.
