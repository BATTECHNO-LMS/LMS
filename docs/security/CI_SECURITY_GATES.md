# CI Security Gates (Phase 4)

## Required (block merge)

| Gate | Command / action | Blocks on |
|---|---|---|
| Unit tests | `cd backend && npm run test:unit` | Failure |
| Integration (guarded) | CI postgres + `ALLOW_TEST_DB_WRITES` | Failure / guard abort |
| Frontend build | `cd frontend && npm run build` | Failure |
| Secret scan | `gitleaks detect --source . --verbose` | Verified secret |
| Dependency audit | `npm audit --audit-level=high` (backend + frontend) | High/Critical (review exceptions) |

## Recommended (warn → graduate to block)

| Gate | Tool | Notes |
|---|---|---|
| SAST | Semgrep `p/owasp-top-ten` or CodeQL | Focus injection, SSRF, secrets |
| Container scan | Trivy image | After local/CI Docker build |
| Dockerfile lint | Hadolint / Trivy config | Misconfig only |
| SBOM | `syft` / Trivy SBOM | Store artifact, not secrets |
| Image signing | Cosign | Future — registry must support |

## Failure policy

- **Block:** verified leaked secret, failing security unit tests, confirmed critical/high *reachable* vulnerability, failed production build
- **Warn / exception:** low/medium CVEs, unreachable transitive issues — use exception format in `PRODUCTION_SECURITY_BASELINE.md`

## Artifact identity

Prefer deploy by:

- Git SHA
- Image digest (`repo@sha256:…`)
- Build timestamp label

Avoid ambiguous `latest` as the sole production pin.

## Local Windows note

Docker/Trivy/Gitleaks may be unavailable on developer Windows hosts. Run scans on CI Linux runners or a Docker-capable workstation before production deploy approval.
