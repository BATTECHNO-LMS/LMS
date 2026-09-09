# BATTECHNO LMS — Mutah Readiness & Template Fix Report

**Opportunity:** `6c8783ec-49fd-428e-83e2-8b65e52c3b4f` (Mutah Field Training)  
**Date:** 2026-09-01  
**Scope:** Unified evaluation readiness, bulk 5/5 count, population reconciliation, template generation gating

---

## ROOT CAUSE — Bulk 5/5 count was 0

`summarizeBulkPreview()` filtered on `row.eligibleForBulk`, but `getOpportunityReportReadiness()` passed student rows using **`bulkEligibleForApproval`** (different property name). The summary always returned `studentsNeedingBulk: 0` and `ratingsToApply: 0` even when eligible students had missing c6/c7/c8 criteria.

**Fix:** Added normalized helpers `rowEligibleForBulk()` and `rowBulkRatingsToApply()` in `fieldTrainingEvaluation.bulkRating.js`. Readiness rows now include both field names plus canonical `missingBulkCriteria` from `getMissingProfessionalCriteria()`.

---

## ROOT CAUSE — 100 vs 104 students

Two different denominators were used:

| Source | Total | Eligible | Not eligible |
|--------|------:|---------:|-------------:|
| Legacy dashboard-style view | **100** | 88 | 12 |
| Readiness endpoint (all approved) | **104** | 88 | 16 |

The **4-record difference** is **not** duplicate data or query leakage. All 104 applications have `status: approved`. The legacy 100 denominator implicitly excluded **4 students still in `pre_assessment_pending` training status**. Those 4 are stored as `completion_eligibility_status: ineligible`, which is why the old “not eligible” count showed **12** instead of **16** (16 − 4 = 12).

**Fix:** Readiness now exposes authoritative `population` / `eligibility` with explicit `excluded` buckets and reconciling counts from one approved-application query.

---

## The 4 differing records

| Application ID | Student | Email | Training status | Eligibility |
|----------------|---------|-------|-----------------|-------------|
| `00d4780a-cd15-4649-b50a-23896d3e22b4` | أيمن مناضل عيد ارقيق | 120232211057@mutah.edu.jo | `pre_assessment_pending` | ineligible |
| `2806b2cf-da90-4eb2-a183-aebfa6520754` | زمزم راكان فلاح الشمايله | 120232222071@mutah.edu.jo | `pre_assessment_pending` | ineligible |
| `216f81e3-b927-4977-8aef-85a42119ac17` | Noor Talal Ziad ALNawaiseh | 120252222154@mutah.edu.jo | `pre_assessment_pending` | ineligible |
| `355b5aad-afb7-4b05-b1c5-f754f1d5aa54` | المهند احمد عبدالله الصعوب | 120222212023@mutah.edu.jo | `pre_assessment_pending` | ineligible |

**Classification:** Approved applications still in pre-assessment workflow — counted in authoritative total (104) but previously omitted from the implicit 100-student dashboard denominator.

---

## ROOT CAUSE — Template fidelity failure

Upload validation (`validationStatus: valid` → UI “القالب صالح”) only confirms **upload/structure**. Fidelity blocked because **`RENDERER_NOT_AVAILABLE`**: LibreOffice (`soffice`) is not installed on the server environment, so DOCX→PDF conversion cannot run even when preflight passes.

**Fix:** Separated template states in `templateReadiness`:

- `uploadValid`
- `structureValid`
- `mappingValid`
- `rendererReady`
- `fidelityValid`
- `templateGenerationReady` (all gates + source file resolved + version present)

Admin diagnostics expose `failureCode` (e.g. `RENDERER_NOT_AVAILABLE`, `SOURCE_FILE_NOT_FOUND`, `TEMPLATE_VERSION_MISSING`).

Generate button and `finalReady` count are gated on `templateGenerationReady`.

---

## ROOT CAUSE — Version displayed "/"

Template `version` is an integer in DB (default `1`). The UI interpolated `undefined` through i18n (`Version: {{version}}`), producing an empty/malformed segment. Some API paths returned template objects without a resolved version label.

**Fix:** `mapTemplateRow()` now returns `versionLabel`. Frontend uses `formatTemplateVersion()` → **“غير محدد”** when missing. Generation blocked when `version == null`.

---

## Live counts (authoritative, post-fix logic)

| Metric | Count |
|--------|------:|
| **Total applications considered** | 104 |
| **Eligible** | 88 |
| **Not eligible** | 16 |
| **Eligibility pending** | 0 |
| **Excluded — expelled** | 1 |
| **Excluded — context load failed** | 0 |
| **Active non-expelled** | 103 |

Reconciliation: `88 + 16 + 0 = 104` ✓

---

## Professional evaluation / bulk 5/5

| Metric | Expected after fix |
|--------|-------------------|
| **Needs professional approval (eligible w/ gaps)** | ~85 (eligible students missing c6/c7/c8 bulk criteria) |
| **Bulk 5/5 students affected** | Same as above (eligible only) |
| **Bulk criteria affected** | ~255 (≈3 criteria × ~85 students) |

Exact live counts refresh from `GET .../evaluation-reports/readiness` → `bulkEligibleRating.summary`.

---

## Readiness gates

| Gate | Status |
|------|--------|
| **Data Ready** | Students with complete static + professional evidence (independent of template) |
| **Template Generation Ready** | **FAIL** on dev server (LibreOffice missing) |
| **Final Ready to Generate** | **0** while template blocked (even if data-ready > 0) |

---

## Official DOCX test render

| Check | Result |
|-------|--------|
| Official DOCX fill (unit tests) | **PASS** |
| DOCX→PDF 2-page conversion | **SKIP/FAIL** — LibreOffice not installed in this environment |
| Generic HTML/Puppeteer fallback used | **NO** |
| Fail-closed when renderer unavailable | **YES** |

---

## Tests & build

| Check | Result |
|-------|--------|
| `fieldTrainingEvaluation.bulkRating.unit.test.js` | **PASS** (includes zero-modal regression) |
| `fieldTrainingEvaluation.readinessAggregate.unit.test.js` | **PASS** |
| Mutah official/generator/payload tests | **PASS** (42 pass, 1 skip — LibreOffice) |
| `npx prisma validate` | **PASS** |
| Frontend unit tests | **PASS** (113) |
| Frontend production build | **PASS** |

---

## API shape (authoritative readiness)

`GET /admin/field-training/:id/evaluation-reports/readiness` now returns:

```json
{
  "population": {
    "totalApplicationsConsidered": 104,
    "evaluatedPopulation": 104,
    "eligible": 88,
    "notEligible": 16,
    "eligibilityPending": 0,
    "excluded": { "expelled": 1, "contextLoadFailed": 0 }
  },
  "templateReadiness": {
    "uploadValid": true,
    "structureValid": true,
    "rendererReady": false,
    "templateGenerationReady": false,
    "failureCode": "RENDERER_NOT_AVAILABLE"
  },
  "generation": {
    "dataReady": "<N>",
    "finalReady": 0,
    "generated": "<N>",
    "failed": "<N>"
  },
  "bulkEligibleRating": {
    "summary": {
      "studentsNeedingBulk": "<N>",
      "ratingsToApply": "<N>"
    }
  }
}
```

---

## Files changed (summary)

- `fieldTrainingEvaluation.bulkRating.js` — normalized bulk row helpers, regression-safe summary
- `fieldTrainingEvaluation.readinessAggregate.js` — **new** unified population/template/generation aggregation
- `fieldTrainingEvaluation.eligibilityReasons.js` — `eligibilityBucket()` with PENDING
- `fieldTrainingEvaluation.service.js` — authoritative readiness response, template diagnostics
- `fieldTraining.service.js` — overview summary reconciliation fields
- `ManageEvaluationTemplateTab.jsx` — separate data/final ready, template gates, version display, removed duplicate bulk section
- i18n AR/EN — new readiness/template labels
- Tests + audit scripts

---

## Suggested commit message (not executed)

```
fix: unify Mutah evaluation readiness and official template rendering
```

---

## Production deployment note

Install LibreOffice on the application server and ensure `soffice` is on PATH. After that, re-run readiness — `templateGenerationReady` should become `true`, then run **one** test render for a complete student before batch generation.
