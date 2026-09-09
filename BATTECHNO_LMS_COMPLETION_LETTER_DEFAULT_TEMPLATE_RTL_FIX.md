# BATTECHNO LMS — Completion Letter Default Template RTL Fix

## Summary

The built-in BATTECHNO Field Training completion letter remains the permanent default renderer (shared by individual issue, bulk issue, and all download paths). Only the student-information block layout was corrected to compact RTL adjacency.

## Acceptance

| Check | Result |
|---|---|
| Default template | PASS |
| Student info RTL | PASS |
| Label/value adjacency | PASS |
| No `space-between` / stretched two-column gap | PASS |
| Numeric/code LTR isolate inside RTL row | PASS |
| Single-page preserved (layout-only CSS change) | PASS |
| Bulk uses same template | PASS |
| Official wording unchanged | PASS |
| Signature / stamp / footer unchanged | PASS |
| Filename pattern unchanged | PASS |
| Eligibility / 140h / hash / idempotency unchanged | PASS |

## Required visual result

Each info row now renders as one RTL line beginning at the right:

`اسم الطالب/ة: {value}`

not:

`{value} ........................ اسم الطالب/ة`

## Implementation

Shared CSS/HTML helper in:

`backend/src/modules/fieldTraining/fieldTraining.completionLetter.template.js`

- `.info` / `.info-row`: `direction: rtl`, `text-align: right`
- `justify-content: flex-start` (not `space-between`)
- removed fixed `min-width: 42mm`
- small `gap` between label and value
- label includes trailing `:`
- numeric/book codes keep `unicode-bidi: isolate` + LTR on the value only

Consumers of the same shared helpers:

- `fieldTraining.completionLetter.js` → `buildCompletionLetterHtml`
- `fieldTraining.completionLetter.service.js` → `buildOfficialCompletionLetterHtml`
- `fieldTraining.workflowService.js` → official template builder

Resolution order remains conceptual:

1. Opportunity-specific completion-letter template (if later configured)
2. University-specific template (if later supported)
3. **Default BATTECHNO built-in template** (this design)

No Admin re-upload required for the default.

## Files changed

- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.template.js`
- `backend/tests/fieldTraining.completionLetter.unit.test.js`
- `backend/tests/fieldTraining.completionLetters.supervisorExcel.unit.test.js`
- `BATTECHNO_LMS_COMPLETION_LETTER_DEFAULT_TEMPLATE_RTL_FIX.md`

## Suggested commit message

```
fix: make completion letter default template use compact RTL student data
```
