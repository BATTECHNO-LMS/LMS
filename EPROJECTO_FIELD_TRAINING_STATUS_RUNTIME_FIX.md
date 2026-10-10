# EPROJECTO Field Training Status Runtime Fix

## Production error observed

```text
ReferenceError: trainingStatusVariant is not defined
```

Caught repeatedly by the application `ErrorBoundary`. The production stack named the page bundle `AdminFieldTrainingManagePage-B7Lr0ha2.js`. TanStack Query frames around that error are the eligibility-tab data update that reached the broken render. They are not the cause.

## Exact source file

`frontend/src/pages/admin/fieldTraining/components/manage/EligibilityStudentCard.jsx`

Rendered by `ManageEligibilityTab` when `AdminFieldTrainingManagePage` is on `?tab=eligibility` (`/admin/field-training/:id/manage`).

## Exact stale reference

```jsx
<StatusBadge variant={trainingStatusVariant(trainingStatus)}>
```

The call reads `row.training_status`. It does not read eligibility status. Eligibility still uses the local `eligibilityVariant` helper in the same file.

## Root cause

`trainingStatusVariant` is called during render and was not imported or declared in `EligibilityStudentCard.jsx`.

## Why trainingStatusVariant was undefined

The canonical function already exists:

```js
export function trainingStatusVariant(status) { ... }
```

in `frontend/src/features/fieldTraining/fieldTrainingUi.js`.

Sibling Field Training screens already import it (`StudentApplicationCard`, `ManageLinkTab`, `AdminFieldTrainingApplicationsPage`, and the student pages). The eligibility card was left calling the same name with no import. In an ES module that unbound name throws `ReferenceError` as soon as a participant has a training status other than empty or `none`.

`fieldTrainingUi.js` imports nothing, so the restored import does not create a cycle.

## Canonical helper/component used

`trainingStatusVariant` from `frontend/src/features/fieldTraining/fieldTrainingUi.js`, rendered with the existing `StatusBadge`.

No new status map was added. Arabic labels stay on the existing `fieldTraining.trainingStatus.*` i18n keys via:

```jsx
t(`trainingStatus.${trainingStatus}`, trainingStatus)
```

## Files changed

- `frontend/src/pages/admin/fieldTraining/components/manage/EligibilityStudentCard.jsx` — restored the missing import
- `frontend/tests/fieldTraining.trainingStatusVariant.ui.test.js` — regression test
- `frontend/package.json` — registered that test on `npm run test:unit`
- `EPROJECTO_FIELD_TRAINING_STATUS_RUNTIME_FIX.md` — this report

Field Training scoring, eligibility, applications, attendance, assessments, grading, letters, reports, and database code were not changed.

## Statuses validated

Authoritative list: `TRAINING_STATUSES` in `frontend/src/features/fieldTraining/fieldTrainingConstants.js`.

| Status | Badge variant | Arabic label |
| --- | --- | --- |
| `none` | `muted` (badge omitted by the existing card guard) | لم يبدأ |
| `pre_assessment_pending` | `warning` | بانتظار الاختبار القبلي |
| `pre_assessment_completed` | `muted` | اكتمل الاختبار القبلي |
| `ready_for_training` | `muted` | جاهز للتدريب |
| `in_training` | `info` | قيد التدريب |
| `task_pending` | `muted` | بانتظار المهام |
| `task_submitted` | `info` | تم تسليم المهام |
| `post_assessment_pending` | `warning` | بانتظار الاختبار البعدي |
| `post_assessment_completed` | `muted` | اكتمل الاختبار البعدي |
| `eligible_for_completion` | `success` | مؤهل للإنهاء |
| `completed` | `success` | مكتمل |
| `failed` | `danger` | لم يجتز |
| `expelled` | `danger` | مستبعد من التدريب |

The regression render covered `in_training`, `completed`, `failed`, `pre_assessment_completed`, an unknown token, `null`, `undefined`, and `none`. The helper itself was asserted for every `TRAINING_STATUSES` value.

## Unknown/null behavior

- Unknown status: `trainingStatusVariant` returns `muted`. The badge renders. The label falls back to the existing i18n second argument (the raw token) when no translation exists. It does not throw.
- `null` / `undefined` / `none`: the card keeps its existing guard and does not render the training-status badge. The eligibility badge still renders. Calling the helper with `null` or `undefined` returns `muted` and does not throw.

## Build result

`npm run build` (Vite 5.4.21) completed successfully.

Local manage-page chunk: `dist/assets/AdminFieldTrainingManagePage-15J2QfgY.js`.

A search of `frontend/dist` for `trainingStatusVariant` returned no matches. The name is now a local import and is minified. An unbound reference would have survived minification, which is how production reported that exact identifier. Sourcemaps are off (`vite.config.js` `build.sourcemap: false`). Generated `dist` files were not edited.

## Typecheck result

Not available. The frontend has no `tsconfig` and no `typecheck` script. `EligibilityStudentCard.jsx` is JavaScript.

## Lint result

Not available. The frontend has no ESLint config and no `lint` script.

## Tests

`frontend/tests/fieldTraining.trainingStatusVariant.ui.test.js`: 4 passed, 0 failed.

- every supported status maps to the existing variant
- every supported status has an Arabic label that is not the raw enum
- the eligibility card imports `trainingStatusVariant` from `fieldTrainingUi.js` and does not declare a local stub
- the real card renders the statuses above, including unknown/null, without throwing

`npm run test:unit`: 138 passed, 1 failed.

The failure is pre-existing and unrelated: `hides the native file chooser and keeps generate-missing in the incomplete section` in `frontend/tests/fieldTrainingEvaluation.ui.test.js`. That assertion reads `ManageEvaluationTemplateTab.jsx`, which this fix does not modify.

## Browser console result

No browser automation was available in this session, so the authenticated `/admin/field-training/:id/manage?tab=eligibility` route was not opened in Chrome.

Substitute: the regression test bundles and server-renders `EligibilityStudentCard` (the component that threw) for the statuses above. That render produced no `ReferenceError`.

## ErrorBoundary result

`frontend/src/components/ErrorBoundary.jsx` was not removed or changed.

The boundary fires only when a child render throws. The eligibility card render that previously threw now completes, so this route does not hit the boundary for `trainingStatusVariant`.

## Regression checks

Focused scan of Field Training admin status helpers (`*Variant` on the manage page and applications pages):

- `trainingStatusVariant` — one declaration in `fieldTrainingUi.js`; every call site now imports it
- `applicationBadgeVariant`, `opportunityStatusVariant`, `lectureStatusVariant`, `journeyBadgeVariant`, `eligibilityVariant`, `statusBadgeVariant`, `stepVariant`, `validationVariant` — each is imported or declared in the file that calls it

Applications, completion letters, and student cards already imported `trainingStatusVariant`. There is one eligibility card renderer for every viewport; no separate mobile path still calls an undefined helper. Attendance, assessment, and reports tabs do not call `trainingStatusVariant`.

Successive renders of the same card with different statuses (the path a TanStack Query refetch takes through `ManageEligibilityTab`) did not throw.

## Cache / old chunk

Vite emits content-hashed files (`AdminFieldTrainingManagePage-<hash>.js`). There is no service worker or Workbox registration in the frontend.

`frontend/nginx.conf` caches `/assets/` as `public, max-age=31536000, immutable` and sends `Cache-Control: no-cache, no-store, must-revalidate` for `index.html`. A normal deploy that publishes the new `index.html` points browsers at the new hash. No cache-busting hack was added. This task did not deploy, so production still has `AdminFieldTrainingManagePage-B7Lr0ha2.js` until that separate step.

## Why this reached production

Repository evidence:

- The crashing file is `.jsx`, outside TypeScript.
- The frontend has no typecheck and no ESLint `no-undef` run.
- `.github/workflows/ci.yml` frontend job runs only `npm run build`.
- Vite/esbuild production builds do not fail on an unbound identifier, so CI stayed green while the eligibility tab threw at runtime.
- The same UI work left other manage-page status helpers imported; this card's import was omitted.
- No route smoke test rendered the eligibility card before this fix. `npm run test:unit` exists locally and now includes the regression test. That script is not part of the CI frontend job. It was not added to CI here because the suite already has an unrelated failure.

## Production deployment performed

NO
