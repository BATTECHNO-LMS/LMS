# BATTECHNO LMS P0.2 — Reduce Authentication Database Overhead

**Date:** 2026-09-10  
**Mode:** Authentication / session authorization performance only. No Field Training business-query work. No frontend auth changes. No JWT redesign.  
**Production:** `https://lms.battechno.com` → `187.55.228.232` (`/root/BATTECHNO_LMS`, `battechno-lms-backend`)  
**Measurement:** local backend against `DATABASE_URL` (same Neon latency class as P0.1; SSH to production remains blocked).  
**Suggested commit (not created):** `perf: reduce authentication database overhead`

---

## Before

### Auth architecture

```text
JWT verify (jwt.js)
  claims: userId, roles, universityId, isGlobal, portalType
  ↓
auth.middleware.js authenticate
  ↓
loadCurrentAuthContext(userId, { portalType })
  ↓
loadCurrentAuthContextFromDb   (every request; JWT roles/isGlobal/universityId not authoritative)
  ↓
Wave 1 Promise.all
  users.findUnique (profile + active org assignments)
  user_roles.findMany (role_id)
  reviewer_university_assignments.findFirst
  ↓
Wave 2 Promise.all
  roles.findMany
  universities.findUnique (60s lookupCache)
  role_permissions.findMany + permissions.findMany (60s rolePermissionCache)
  ↓
applyPortalScope
  ↓
req.user / req.authContext
  ↓
authorizeRoles / requirePermission (in-memory on req.user)
  ↓
/api/auth/me reuses ctx._profile + _assignmentRows (already no extra assignment queries)
```

JWT `roles`, `isGlobal`, and `universityId` were already informational. Authorization was DB-authoritative after verify. That is preserved.

`super_admin` is global only via `isGlobalFromRoleRecords` (explicit `super_admin` role row). Missing organization assignment does not imply global access.

Reviewer university scope comes only from `reviewer_university_assignments` (no `primary_university_id` fallback).

### DB queries per authenticated request

| Path | Prisma operations | Typical wall time (this session) |
|---|---|---|
| Catalog cold (process start) | **7** | **4601 ms** |
| Catalog warm (60s role/university caches already filled) | **3** (parallel) | **1615 ms** |
| `/api/auth/me` extra after auth | **0** (already reused) | — |
| Simple / admin / reviewer / student authenticated routes | same **3** auth queries before business logic | ~**1615 ms** auth |

Catalog-warm operations:

1. `users.findUnique`
2. `user_roles.findMany`
3. `reviewer_university_assignments.findFirst`

Catalog-cold extra:

4. `roles.findMany`
5. `universities.findUnique`
6. `role_permissions.findMany`
7. `permissions.findMany`

P0.1 established ~500 ms app→Neon RTT. Auth therefore paid that RTT on **every** protected request.

### Duplicate lookups (classified)

| Lookup | Classification |
|---|---|
| User status / org assignments / role links / reviewer assignment | **REQUIRED_PER_REQUEST** on cache miss |
| Full resolved auth context (`req.user`) | **CACHEABLE_SHORT_TERM** (was not cached) |
| Role catalog rows by id | **CACHEABLE_LONG_TERM** (was re-queried; permissions already 60s) |
| Role → permission codes | **CACHEABLE_LONG_TERM** (already 60s) |
| University / organization identity | **CACHEABLE_LONG_TERM** (60s lookupCache) |
| `isGlobal`, portal-scoped roles, `/me` profile | **DERIVABLE_FROM_EXISTING_CONTEXT** |
| JWT roles / `isGlobal` / `universityId` as authorization | **REDUNDANT** (already ignored) |
| Reloading roles in authorize middleware | **REDUNDANT** (uses `req.user`) |
| `/me` assignment + university re-fetch | **REDUNDANT** (already removed in prior work) |

---

## Changes

Exact files / functions:

| File | Change |
|---|---|
| `backend/src/modules/auth/authContextCache.js` | **New.** In-process TTL cache: `createAuthContextCache`, `invalidateAuthContextForUser`, `clearAuthContextCache` |
| `backend/src/modules/auth/currentAuthContext.js` | `loadCurrentAuthContextCached`; production path uses cache; test loaders skip cache; Wave 2 uses `getRoleRecordsByIds` |
| `backend/src/modules/auth/rolePermissionCache.js` | `getRoleRecordsByIds` (same 60s catalog TTL as permissions) |
| `backend/src/config/env.js` | `AUTH_CONTEXT_CACHE_TTL_MS` (0 disables), `AUTH_CONTEXT_CACHE_MAX` |
| `backend/src/modules/users/users.repository.js` | Invalidate after role-link create/delete and `updateUser` |
| `backend/src/modules/users/users.service.js` | Invalidate after user-update transaction commit |
| `backend/src/modules/users/reviewerAssignment.service.js` | Invalidate after assign / deactivate |
| `backend/src/modules/organizations/organizations.service.js` | Invalidate after org assignment (after role link) and activation/verify |
| `backend/src/modules/auth/auth.service.js` | Invalidate after preferred-organization change (login + `setActiveOrganization`) |
| `backend/src/modules/auth/universityEmailLink.service.js` | Invalidate after `primary_university_id` link |
| `backend/src/modules/roles/roles.repository.js` | `replaceRolePermissions` clears role catalog **and** all auth-context entries |
| `backend/src/modules/trainingPrograms/trainerAssignments.service.js` | Invalidate after trainer role / org assignment |
| `backend/src/modules/accountDeletion/accountDeletion.service.js` | Invalidate after identity anonymize |
| `backend/tests/auth.contextCache.unit.test.js` | **New.** Cache, TTL=0, LRU, portal keys, super_admin / reviewer semantics |
| `backend/package.json` | `test:unit` includes `auth.contextCache.unit.test.js` |
| `backend/scripts/p0-2-auth-query-count.js` | **New.** Read-only query-count probe |

Not changed: JWT shape, frontend interceptors, Field Training scoring/eligibility/hours/reports/letters, `authorizeRoles` / permission middleware (still read `req.user` only).

---

## Cache design

| Item | Value |
|---|---|
| Cache | In-process `Map` (single backend container; Redis not introduced) |
| Key | `userId\|UNIVERSITY` / `userId\|INSTITUTION` / `userId\|_` |
| TTL | **15 seconds** (`AUTH_CONTEXT_CACHE_TTL_MS`; clamp 5–60s; `0` disables) |
| Max size | **2000** entries, LRU eviction (`AUTH_CONTEXT_CACHE_MAX`) |
| Payload | Authorization snapshot only (roles, permissions, org/university scope, `/me` profile fields). No passwords, tokens, or secrets. |
| Clone | `structuredClone` on get/set so `req.user` mutation cannot poison the cache |
| Coalesce | In-flight promise per key so concurrent misses share one DB load |
| Fail closed | Load errors are **not** cached. Deleted/disabled users throw and miss the cache. DB outage still fails the request. |
| Test loaders | Injected `setCurrentAuthContextLoaderForTests` **bypasses** the cache |

### Invalidation strategy

Immediate `invalidateAuthContextForUser(userId)` after:

* user status / profile / preferred organization updates
* role add / remove
* organization assignment create
* reviewer university assign / deactivate
* university email link (`primary_university_id`)
* trainer role / institution assignment
* account deletion anonymize

Permission catalog mutation (`replaceRolePermissions`):

* `clearRolePermissionCache()`
* `clearAuthContextCache()` (all users)

Fallback if a mutation path is missed: **maximum 15s** stale authorization, then DB reload.

### Security rationale

* Mutable authorization (roles, org membership, reviewer assignment, permissions, active status) stays **DB-authoritative**.
* JWT still carries only identifiers + informational claims. Permissions were **not** added to the token.
* Warm cache is a **short replica** of the last successful DB snapshot, not a new authority.
* Missing org / missing reviewer assignment still cannot become global: `isGlobal` is computed from role records inside `loadCurrentAuthContextFromDb` before insert.

---

## After

Measured with `backend/scripts/p0-2-auth-query-count.js` (read-only; one active user; University portal).

| Path | Prisma operations | Auth wall time |
|---|---|---|
| Cold, catalog empty (`loadCurrentAuthContextFromDb`) | **7** | **4601 ms** |
| Cold user, catalog warm (`loadCurrentAuthContext` miss) | **3** | **1615 ms** |
| Warm cache hit | **0** | **0–1 ms** |

### `/api/auth/me`

| | Auth DB queries | Auth duration | Total (auth + me assemble) |
|---|---|---|---|
| **BEFORE** (catalog warm, every request) | 3 | ~1615 ms | ~1615 ms |
| **AFTER** cold (catalog warm) | 3 | ~1615 ms | ~1615 ms |
| **AFTER** warm | **0** | **~1 ms** | **~1 ms** |

`me()` already reused `_profile` / `_assignmentRows`; the remaining cost was the middleware auth load. That load is now 0 when the cache is warm.

### Simple authenticated / admin / reviewer / student

Same middleware path (`authenticate` → `loadCurrentAuthContext`). Business queries are unchanged (P1.1). Auth portion:

| | BEFORE (warm catalog) | AFTER warm cache |
|---|---|---|
| Auth DB queries | 3 | **0** |
| Auth time | ~1615 ms | **~1 ms** |

Cold after process start is unchanged in query count (7 then 3); only the **repeat** request is eliminated.

---

## Security regression

Existing characterization / unit tests (DB-free unless noted). One LRU assertion was fixed during this phase; the suite was re-run.

| Case | Result |
|---|---|
| True global `super_admin` (`isGlobal` from role records only) | **PASS** |
| Ordinary `admin` is not global | **PASS** |
| Token `isGlobal` / roles cannot override DB | **PASS** |
| Missing / inactive / deleted user denied; errors not treated as success | **PASS** |
| Missing organization does not become global | **PASS** |
| University scope: own university allowed, other university 403 | **PASS** |
| Institution portal vs university portal role filtering | **PASS** |
| Reviewer kept on university portal; stripped on institution portal | **PASS** |
| Reviewer university from assignment table only (no primary fallback) | **PASS** (loader unchanged) |
| Student / instructor university-only helpers | **PASS** |
| Trainer / trainee institution-only portal evaluation | **PASS** |
| `/auth/me` reuse for super_admin, university admin, institution admin, reviewer, instructor, student, trainer, trainee | **PASS** |
| Cache skipped for injected test loaders (no stale mock privilege) | **PASS** |
| Expired / invalid / missing token denied before DB | **PASS** |

**194 / 194** tests in the P0.2 security batch passed after the LRU floor fix (auth cache + IDENTITY-001/002/003 + middleware/scope/portal/reviewer/FT auth + `/me` reuse).

Permission semantics: **unchanged**. Organization / university / reviewer scoping: **unchanged**. Frontend: **unchanged**.

---

## Remaining issues

Do not fix in this phase:

* Field Training and other **business** Prisma waterfalls (P1.1).
* Frontend Axios / React Query / logout / refresh (P1.3).
* Login still loads roles/assignments independently of the request cache (not the hot authenticated-request path).
* Cold `users.findUnique` still selects `/me` profile fields (needed so `/me` stays 0 extra queries).
* Catalog miss still does `role_permissions` then `permissions` sequentially (rare; 60s TTL).
* In-process cache is **per Node process**. A second backend replica would not share entries (current deploy is one container). TTL + invalidation still fail closed.
* Maximum **15s** stale window if a mutation path forgets to invalidate.
* Production container not restarted; SSH to `187.55.228.232` still `Permission denied (publickey)`.
* Neon region RTT (~500 ms) remains; P0.2 only removes repeat auth round trips.

---

## Call graph (after)

```text
JWT verify
  ↓
authenticate
  ↓
loadCurrentAuthContext
  ↓
cache hit → clone snapshot (0 DB)
cache miss → loadCurrentAuthContextFromDb
  ↓
Wave 1 Promise.all
  users.findUnique
  user_roles.findMany
  reviewer_university_assignments.findFirst
  ↓
Wave 2 Promise.all (usually catalog/lookup cache)
  getRoleRecordsByIds
  getUniversityIdentity
  getPermissionCodesForRoleIds
  ↓
applyPortalScope → set cache
  ↓
req.user / req.authContext
```
