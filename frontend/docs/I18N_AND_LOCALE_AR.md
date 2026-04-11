BATTECHNO-LMS — Deep technical audit
1. Executive summary
BATTECHNO-LMS is a learning / micro-credential management product delivered mainly as a React + Vite SPA with Arabic-first i18n, role-based shells (admin, instructor, student, reviewer), UI-only RBAC and permissions, frontend-only multi-tenant simulation, and in-memory mock CRUD for several admin domains. A Node/Express backend exists under backend/ with route registration and Prisma, but almost all HTTP modules are empty stubs; the database schema is a minimal User model. In practice, login and data are mock- or client-driven; @tanstack/react-query is mounted but unused for server data. The app is best described as an advanced UI prototype / frontend foundation with a backend skeleton, not an integrated full stack yet.

2. What this project is
System type: LMS-style platform for universities, tracks, micro-credentials, cohorts, sessions, attendance, assessments, submissions, grades, evidence, QA / risk / integrity, recognition requests, certificates, reports, audit logs, plus a super-admin analytics dashboard.
Supported roles (code): super_admin, program_admin, academic_admin, qa_officer (admin shell), instructor, student, university_reviewer.
Problem it targets: Operational and academic workflows for credential programs across institutions, with separate portals and navigation per persona.
3. Tech stack and why each tool is used
Technology	Role in repo (actual usage)
React 18
UI composition, hooks, context.
Vite
Dev server and production bundling.
React Router v6
Nested routes, layouts, guards (ProtectedRoute, RoleBasedRoute, RoleShellPermissionOutlet).
@tanstack/react-query
QueryClientProvider + queryClient in lib/queryClient.js — no useQuery/useMutation in src/; reserved for future API.
Axios
apiClient with base URL from VITE_API_BASE_URL, Bearer from localStorage — used by auth.service.js login/logout; falls back to mock on failure.
SCSS
Layered design system: abstracts, components, layouts, pages (app.scss orchestrates @use).
i18next / react-i18next
Multi-namespace translations; fallbackLng: 'ar'; DOM lang/dir synced in i18n/config.js + locale.js.
lucide-react
Icons (sidebar, KPIs, analytics, etc.).
Zod
schemas/adminCrudSchemas.js — client-side validation for admin CRUD forms (Arabic error strings).
Recharts
Super-admin analytics charts (components/analytics/charts/AnalyticsCharts.jsx).
4. High-level architecture
App
 └─ AppProviders (QueryClient → Theme → Locale → BrowserRouter → Auth → Tenant)
     └─ AppRouter (public login + protected role shells)
Shells: /admin, /instructor, /student, /reviewer each use BaseDashboardLayout: sidebar + AppNavbar + <Outlet /> + AppFooter.
Data: Most admin lists/forms read/write adminCrudStore (in-memory clones of mocks/adminCrud.js). No React Query layer for that.
Auth: Try API → catch → mockLoginResponse in features/auth/auth.service.js. User + token persisted as JSON in localStorage (utils/storage.js).
Authorization: Route-level (RoleBasedRoute, SuperAdminAnalyticsRoute) + pathname → UI permission (RoleShellPermissionOutlet + rolePermissions.js) + optional PermissionGate on components. Explicitly not server enforcement.
5. Folder structure (frontend-focused)
Path	Purpose
frontend/src/main.jsx
Boot: i18n init, SCSS, ReactDOM.createRoot, <App />.
frontend/src/App.jsx
AppProviders + AppRouter.
frontend/src/app/providers/
Global provider composition.
frontend/src/app/router/
All route definitions.
frontend/src/layouts/
AuthLayout, BaseDashboardLayout, thin *Layout wrappers.
frontend/src/pages/
Route targets: auth/, admin/ (CRUD + feature pages), instructor/, student/, reviewer/, common/.
frontend/src/components/
admin/, common/, forms/, navigation/, permissions/, tables/, analytics/, etc.
frontend/src/features/
Vertical slices: auth/, locale/, theme/, tenant/, analytics/ (+ other small features/* indexes).
frontend/src/constants/
roles.js, permissions.js, adminNavigation.js, navigation.js, tenants.js, authMockScenarios.js.
frontend/src/utils/
storage, locale, theme, helpers, rolePermissions, tenant, portal, i18n helpers.
frontend/src/mocks/
adminCrud.js, adminCrudStore.js, instructor/student mock data.
frontend/src/schemas/
Zod schemas for admin CRUD.
frontend/src/services/
apiClient.js, endpoints.js.
frontend/src/i18n/
config.js + `locales/ar
frontend/src/assets/styles/
SCSS design system.
Backend: backend/src/server.js → app → routes/index.js mounts many modules/*/*.routes.js — files inspected are empty Router() exports (no router.get/post).

6. Core systems (implementation detail)
6.1 Auth
features/auth/auth.service.js: login POSTs to endpoints.auth.login; on any error, returns mockLoginResponse built from AUTH_MOCK_SCENARIOS + tenants.js (tenant names/codes). logout / fetchCurrentUser similarly catch and return empty/null.
features/auth/context/AuthContext.jsx: readInitialUser from storageKeys.authUser; normalizeUser adds isGlobal (defaults super_admin → global), roles array, tenantId (fallback uni-1 for non-global). login stores token + user; logout clears token, user, tenantScope.
Conclusion: Mock-first auth; real JWT/session not integrated in the paths exercised by the UI.
6.2 Roles and permissions
constants/roles.js: Role string constants + ADMIN_ROLE_SET + legacy MOCK_LOGIN_PRESETS (portal pages may still reference roles).
constants/permissions.js: UI_PERMISSION keys — documented as UI-only, not backend RBAC.
utils/rolePermissions.js: Maps student / instructor / reviewer to booleans per permission; any admin role in ADMIN_ROLE_SET gets ADMIN_ALL (everything true). ROUTE_RULES regex-list maps pathname → required permission for non-admin shells. Unknown paths under those shells → UI_ROUTE_DENY → denied.
RoleBasedRoute: If user.role ∉ allowedRoles, redirect to role dashboard (not always UnauthorizedPage).
RoleShellPermissionOutlet: If permission missing → UnauthorizedPage (default common.unauthorized unless overridden).
Admin shell: No RoleShellPermissionOutlet — access is role set + sidebar path list (flattenAdminNavPaths in canAccessPath). Program admin cannot open super-admin-only items if those items’ roles array excludes them (e.g. analytics is [S] only in adminNavigation.js).
6.3 i18n
i18n/config.js: Registers many namespaces (common, auth, dashboard, navigation, CRUD namespaces, analytics, etc.). defaultNS: 'common', fallbackLng: 'ar'.
utils/locale.js: ar/en, applyDocumentLocale sets documentElement and body lang + dir (RTL for Arabic).
features/locale: Subscribes to i18n.on('languageChanged') for React state.
Mixed patterns: Many admin CRUD pages use useTranslation + JSON; some older pages (e.g. SessionsPage, QAPage) still use tr(isArabic, ar, en) from utils/i18n.js — not namespace keys.
6.4 Layout and design system
BaseDashboardLayout: Resolves getDashboardNavGroups(role, tNav) — admin uses getAdminNavGroupsForRole from adminNavigation.js (per-item roles filter); others use NAV_BY_ROLE filtered by hasUiPermission. Header title via getPageTitleForPath (CRUD-aware via CRUD_MODULE_NS + i18n.getFixedT).
SCSS: Tokens in _variables.scss (product gold/gray palette, CSS variables for light/dark). ThemeProvider toggles light/dark, persists to storage, applyDocumentTheme on document.
Hover: Analytics page SCSS adds rules for white text on primary/outline hover where specified; global buttons elsewhere follow existing _buttons.scss.
6.5 Multi-tenant (frontend-only)
constants/tenants.js: Three universities + TENANT_SCOPE_ALL.
features/tenant/context/TenantContext.jsx: scopeId: forced to user.tenantId for non-global users; global users read/write storageKeys.tenantScope. Exposes filterRows(rows, key='tenantId') (all rows if scope is “all”, else filter).
TenantSwitcher / TenantReadonlyBadge in header (AppNavbar).
Explicitly simulated: No tenant in JWT validation, no server isolation — client-side filtering only.
6.6 Analytics (super admin)
SuperAdminAnalyticsRoute: user.role === super_admin else UnauthorizedPage with analytics.unauthorized.* copy.
features/analytics: mockAnalytics.js + analytics.service.js (fetchAnalytics / buildAnalyticsPayload) + useAnalytics (local filter state, async refresh).
SuperAdminAnalyticsPage: KPI grid, Recharts inside AnalyticsChartCard (dir="ltr" on chart area), filter bar (placeholders), module summary blocks — all mock.
7. Module-by-module (honest status)
Legend: Complete = functional UI with real navigation; Partial = UI exists but static/mock/inconsistent i18n; Placeholder = ModulePlaceholderPage or empty table only; Backend = not wired.

Module	Admin UI	Data source	Notes
Users
Partial–strong
adminCrudStore + tenant filter
Full list/create/edit/view + Zod; mock store.
Universities
Partial–strong
Same pattern
CRUD + tenant filter.
Tracks
Partial–strong
Same
CRUD + tenant filter.
Micro-credentials
Partial–strong
Same
CRUD + tenant filter.
Cohorts
Partial–strong
Same
CRUD + tenant filter.
Learning outcomes
Partial
Likely static page
Routed; verify vs CRUD depth.
Content
Partial
Static/demo
ContentManagementPage pattern similar to sessions.
Sessions
Partial
Static tr() strings, empty tables
No store integration observed.
Attendance
Partial
Mixed
Admin page + instructor attendance with mock learners.
Assessments
Partial–strong
Admin: store; instructor/student: instructorAssessmentWorkspace.js
Tenant-filtered where wired.
Rubrics
Partial
Static/demo
Submissions
Partial
Admin static; instructor/student mocks
Grades
Partial
Mock rows + tenant filter on some pages
Evidence
Partial
MOCK_EVIDENCE + tenant filter
QA / QA reviews / corrective actions
Partial
Mostly static KPIs / empty tables
At-risk / risk cases
Partial
Placeholder-style content
Integrity cases
Partial
Placeholder-style
Recognition requests
Partial–strong
adminCrudStore.recognition + tenant
Certificates
Partial
List/UI level
Reports
Partial
MOCK_REPORTS + tenant
Audit logs
Partial
Likely static
Settings
Partial
UI
Analytics
Complete (for spec)
Mock only, super_admin only
Recharts bundle.
Roles & permissions
Partial
Informational UI
Not a real policy engine.
Instructor / student / reviewer: Dashboards use tenant-scoped mock counts where implemented; assessments/submissions/grades use mock arrays + filterRows. Unknown routes under shell → ModulePlaceholderPage if allowed by canAccessPath.

8. Important file-by-file walkthrough
File	Purpose / exports	Used by	Completeness
main.jsx
App bootstrap
Entry
Complete
App.jsx
Providers + router
main
Complete
app/providers/index.jsx
Provider tree order
App
Complete
app/router/index.jsx
All routes, portals, guards
App
Complete
features/auth/context/AuthContext.jsx
AuthProvider, user state
Whole app
Mock-oriented
features/auth/auth.service.js
login, logout, fetchCurrentUser
AuthContext
API + mock fallback
components/common/ProtectedRoute.jsx
Auth gate
Router
Complete
components/common/RoleBasedRoute.jsx
Role list gate
Router
Complete
components/permissions/RoleShellPermissionOutlet.jsx
Path → UI permission
Instructor/student/reviewer
Complete (UI-only)
components/permissions/PermissionGate.jsx
Conditional render
Various pages
Complete
constants/adminNavigation.js
Grouped admin nav + per-entry roles
Sidebar
Complete
constants/navigation.js
Non-admin nav + page titles + canAccessPath
Layout, placeholder
Complete
layouts/BaseDashboardLayout.jsx
Shell
All dashboard layouts
Complete
mocks/adminCrudStore.js
In-memory CRUD
Admin CRUD pages
Demo persistence
features/tenant/context/TenantContext.jsx
Tenant scope + filterRows
Admin + some role pages
Frontend simulation
services/apiClient.js
Axios + token
Auth (and future)
Partial (401 TODO)
pages/admin/SuperAdminAnalyticsRoute.jsx
super_admin gate
Router
Complete
pages/common/ModulePlaceholderPage.jsx
“Under construction”
* routes
Complete
schemas/adminCrudSchemas.js
Zod
Form pages
Partial coverage of all fields
backend/src/routes/index.js
Mounts modules
Express
Wiring only
backend/src/modules/auth/auth.routes.js
Empty router
—
Stub
backend/src/modules/users/users.routes.js
Empty router
—
Stub
backend/prisma/schema.prisma
User only
DB
Starter
9. Current project status
Completed (relative to “UI shell” goals)
Multi-portal routing and layouts.
Persistent mock auth with scenario-based tenants and logout clearing tenant scope.
Rich admin CRUD for core catalog entities against in-memory store with Zod on key forms.
i18n with RTL and multiple namespaces; theme toggle.
Tenant switcher (global) + filtering across many admin and some role pages.
Super-admin analytics page with Recharts and structured mock/service/hook.
UI permission map for non-admin shells + sidebar filtering by permission.
Partially completed
Many admin feature pages (sessions, QA, etc.): visual structure without domain store or API.
Auth: axios path exists but backend auth routes empty → always mock path today if API missing or errors.
i18n consistency: mix of namespaces vs tr() hardcoded pairs.
fetchCurrentUser: not used to rehydrate session on load in AuthProvider (user comes from storage only unless you add that call).
Placeholder / mock
ModulePlaceholderPage for unmatched routes still allowed by canAccessPath.
All adminCrudStore data; analytics dataset; instructor/student assessment mocks.
Backend HTTP handlers for listed resources: stubs in sampled files.
Missing
Real authentication (password verify, JWT refresh, secure cookies if desired).
Prisma models matching LMS domains; migrations; repositories wired to routes.
Frontend ↔ backend integration for CRUD (replace store with API + React Query).
Server-side authorization and multi-tenant isolation.
Tests (frontend/backend) beyond any minimal backend test script.
Stage (one sentence)
The project is in a “production-grade frontend prototype + backend skeleton” stage: demonstrable product UI with clear architecture, but no real data plane or security boundary yet.

10. Risks and weak points
Security gap: UI roles/permissions do not protect data; tenant scope is tamperable in localStorage.
Auth drift: Token may be stored but no /auth/me hydration; 401 handler in axios is a comment only.
Admin RBAC simplification: All ADMIN_ROLE_SET roles get full UI permission map — finer admin RBAC not modeled in rolePermissions.js (only sidebar items differ).
React Query dead weight: Provider without queries adds bundle/complexity until used.
Backend illusion: Routes registered but empty — easy to assume API exists.
i18n debt: tr() pages block consistent translation workflow.
Analytics bundle size: Recharts increases JS payload (~1 MB build mentioned in prior work).
11. Recommended next step (engineering)
Shortest path to “real product”: implement POST /api/auth/login (and GET /api/auth/me) on the backend, return JWT + user + tenant claims, then switch auth.service.js to success path, hydrate user on app load, and replace one vertical slice (e.g. users or universities) with API + useQuery/useMutation while deprecating adminCrudStore for that slice.

If backend-first is required: expand Prisma schema to core entities and implement one module end-to-end (route → controller → service → DB) before touching more UI.

12. Final verdict
The frontend architecture is strong for a SPA: clear feature folders, guards, tenant context, mock service boundary for analytics, and consistent admin components. The backend is not yet an API in practice—mostly empty routers and a toy schema. The honest position: ready for backend integration and hardening, not ready for production without auth, data, and server-side authorization.

Summary table
Area	Status	Notes	Next action
Routing
Completed
Nested routes, portals, fallbacks
Keep in sync when adding APIs
Auth
Placeholder/mock
Mock fallback; storage-based session
Implement real login + /me + 401 handling
Permissions
Partial (UI only)
Admin = all UI caps; shells mapped by path
Mirror with server RBAC later
I18n
Partial
AR default + namespaces; some tr() pages
Migrate remaining pages to JSON keys
Admin pages
Partial
Strong CRUD subset; many static modules
Prioritize API for CRUD entities
Instructor pages
Partial
Mock data + tenant filter on key flows
Wire to API + real cohort context
Student pages
Partial
Same
Same
Reviewer pages
Partial
Dashboard + listed routes
Same
Analytics
Completed (mock)
Super_admin only, Recharts
Connect to warehouse/API when exists
Multi-tenant
Partial
Frontend scope + filterRows only
Server tenant claims + row-level security
API integration
Missing
Axios ready; endpoints unused for CRUD
First vertical slice + React Query
Backend readiness
Placeholder
Routes mounted; handlers/schema minimal
Implement auth + one domain module + Prisma models
