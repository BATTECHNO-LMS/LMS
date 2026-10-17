# Dependency security exceptions (Phase 4)

Use this register for findings that are not immediately fixable without unsafe major upgrades.
Do not silently ignore CI audit output.

| Finding | Severity | Reason | Owner | Expiry / review | Mitigation |
|---|---|---|---|---|---|
| `puppeteer` / `@puppeteer/browsers` chain (basic-ftp, extract-zip, proxy-agent) | high | Major bump to 25.x deferred pending PDF regression | platform | 2026-11-30 | Chromium request allowlist; timeouts; `--no-sandbox` documented; non-root + read_only |
| `xlsx` (frontend) | high | No upstream fix; SheetJS community build | frontend | 2026-11-30 | Prefer server-side ExcelJS for sensitive exports; limit untrusted workbook parse |
| `firebase-admin` → uuid/teeny-request | moderate/high | Transitive; push notifications only | platform | 2026-11-30 | Keep admin SDK offline to clients; upgrade when Firebase releases |
| `exceljs` → uuid | moderate | Force-fix would downgrade exceljs major | platform | 2026-11-30 | Trusted admin export paths only |
| Frontend `vite`/`tailwind`/`sharp` highs | high | Mostly build-time; Vite 8 / Tailwind 4 majors deferred | frontend | 2026-11-30 | Production image ships static assets only (no Vite runtime) |
| Alpine Chromium `--no-sandbox` | n/a (config) | Required for container Chromium | platform | 2026-12-31 | Non-root user, cap_drop ALL, network allowlist in pdfRenderer |

## Resolved in Phase 4 (local)

| Finding | Action |
|---|---|
| `proxy-addr` critical (Express) | `overrides.proxy-addr=2.0.8` + `express@4.22.3` |
| `tar` critical (via bcrypt native tooling) | `overrides.tar=^7.5.22` |
| Frontend `axios` high | Bumped to `1.20.0` |
