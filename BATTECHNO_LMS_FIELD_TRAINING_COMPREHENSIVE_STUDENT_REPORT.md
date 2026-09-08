# BATTECHNO LMS — Field Training Comprehensive Student Report

## Summary

Redesigned the Field Training eligibility student cards (Tafila monitoring) and added an on-demand **تقرير الطالب الشامل** with qualification, scoring, attendance, tasks, assessments, behavior, and platform activity (including login tracking going forward).

Suggested commit message (not created):

`feat: add comprehensive field training student report and activity timeline`

---

## Old student card problems

- Identity disconnected from eligibility badge
- Flat horizontal metrics with weak hierarchy
- Eligibility reason shown as one long technical sentence
- Final score not emphasized; threshold gap not computed
- Task/attendance/hours/post hard to compare
- Actions cramped; horizontal space wasted
- Low-value fields (e.g. final task when unused) competed with primary metrics

## New card layout

Component: `EligibilityStudentCard.jsx` (used by `ManageEligibilityTab`)

1. **Header (RTL):** name → university → specialty → university number + status badge (مؤهل / غير مؤهل / قيد الاستكمال)
2. **Final score hero:** `XX / 100`, threshold `80 / 100`, explicit deficit/surplus text
3. **Score breakdown (canonical snapshot only):** حضور 20 / بعدي 20 / تاسكات 40 / سلوك 20 / مجموع 100
4. **Training requirements** with pass/fail icons
5. **Tasks:** `X من أصل Y مكتملة` + optional expandable details
6. **Reasons / success checklist** as separate human-readable items
7. **Actions:** إعادة حساب الأهلية · تقرير الطالب الشامل

List API stays lightweight: qualification comes from stored `eligibility_reason.details` (no live recalc / no activity log on the list).

---

## Comprehensive report architecture

### Route

- Admin: `/admin/field-training/:id/students/:applicationId/report`
- Instructor: `/instructor/field-training/:id/students/:applicationId/report`

### Backend endpoint

`GET /field-training/opportunities/:opportunityId/applications/:applicationId/comprehensive-report`

(admin + instructor routers)

Payload (normalized):

- `student`, `opportunity`, `application`
- `eligibility` (gates, score difference, Arabic reason labels)
- `scoring` (canonical components from qualification engine)
- `attendance` (+ session rows with Arabic statuses)
- `tasks`, `assessments`, `professionalEvaluation`
- `activitySummary`, `activityTimeline`

### Frontend

`FieldTrainingComprehensiveStudentReportPage.jsx` — sectioned RTL report, activity filters, print / print-as-PDF toolbar.

---

## Activity / login data source

| Source | Use |
|--------|-----|
| `audit_logs.action_type = USER_LOGIN_SUCCESS` | Authoritative login count going forward |
| `users.last_login_at` | Last login display (may exist historically) |
| Field Training audit actions | Timeline (attendance, tasks, eligibility, letters, ratings) |

### Login-count definition

- One successful password authentication = **one** `USER_LOGIN_SUCCESS`
- Recorded in `auth.service.js` after token issuance
- Does **not** count: page refresh, API calls, token refresh (no refresh login audit), failed logins

### Historical login availability

Before tracking activation there is **no reconstructable login count**.

UI label when no `USER_LOGIN_SUCCESS` rows exist:

`غير متوفر تاريخياً قبل تفعيل التتبع`

Do **not** show fake `0`.

### Human-readable log mapping

`fieldTraining.activityTranslate.js` → `translateStudentActivityEvent(event)`

Returns `{ title, description, category, categoryLabelAr }`.

Unknown codes → `نشاط على المنصة` (raw codes not shown to reviewers).

Categories: الدخول والحساب · الحضور · التاسكات · التقييمات · التدريب · الأهلية · التقارير

Privacy: IP / UA / JWT / session tokens / stack traces are not included in the report payload timeline.

---

## Performance

- Eligibility list: stored snapshot only
- Comprehensive report: aggregated queries for one application/student; activity `take` capped; category filter applied after bounded fetch
- No N+1 live qualification on list page
- Activity loaded only when opening the report

## Authorization

Uses existing Field Training manage access:

- Super Admin: all
- University Admin: own university scope
- Instructor: assigned opportunity scope
- Reviewer: read-only per current FT staff rules
- Students / institution portal: not granted this admin report

## Tests

- `tests/fieldTraining.activityTranslate.unit.test.js` (node:test)
- Existing Tafila qualification unit tests remain the scoring authority

## Files (primary)

Backend:

- `fieldTraining.comprehensiveReport.service.js`
- `fieldTraining.activityTranslate.js`
- `auth.service.js` (`USER_LOGIN_SUCCESS`)
- `fieldTraining.workflow.controller.js` / routes / validation
- `fieldTraining.service.js` (eligibility list enrichment)

Frontend:

- `EligibilityStudentCard.jsx`
- `ManageEligibilityTab.jsx`
- `FieldTrainingComprehensiveStudentReportPage.jsx`
- Admin/Instructor page wrappers + router + lazyPages
- `_field-training.scss`, i18n `fieldTraining.json` (ar/en)
