# 27 — Performance and Observability QA (QA-001)

**Policy:** Evidence-based observations only; no speculative rewrites.

---

## Confirmed observations

| ID | Severity | Evidence | Impact | Next |
|----|----------|----------|--------|------|
| **QA-PERF-001** | P2 | Vite build: main + charts chunks >500kB | Slower first load on admin analytics | Code-split / lazy already partial; measure LCP on staging |
| **QA-PERF-002** | P2 | Sync Puppeteer PDF / ExcelJS on request thread (analytics, FT reports, user export) | Long requests; worker saturation risk | Timeouts/limits first; queue later (ISS-012) |
| **QA-PERF-003** | P2 | Protected requests rebuild auth context from DB | Extra query/latency per request; correctness tradeoff | Accept for security; cache carefully only with invalidation plan |
| **QA-PERF-004** | P3 | List endpoints may lack strict pagination caps | Unbounded payloads | Audit hottest list routes under load |
| **QA-OBS-001** | P2 | No Sentry/APM wired in repo baseline | 500s → logs only | Add error tracking before heavy prod traffic |
| **QA-OBS-002** | P3 | Morgan request logs; ensure no secrets | Standard | Log review checklist |

---

## N+1 / duplicate load

Not profiled with production data this phase. Recommend:

1. Enable Prisma query logging on staging for academic list + FT manage.
2. Capture p95 for `/submissions`, `/grades`, FT opportunity detail.

---

## Database

- Academic unique index live (Neon + empty baseline).
- Performance indexes migration included in history (`20260709160000_*`).
- Empty-DB reproducibility validated (DB-MIGRATION-002/003).
