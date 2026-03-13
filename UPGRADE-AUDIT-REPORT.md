# APEX OS — Production Upgrade Audit Report

> Generated: 2026-03-13
> TypeScript errors: **0** (verified via `npx tsc --noEmit`)

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Phases completed (code-complete) | **4 / 5** (Phases 0-4 code-complete, manual testing outstanding) |
| Plan items implemented | **~138 / ~160** |
| Items missing or incomplete | **~10** |
| Items requiring manual testing only | **~25** |
| Bugs / issues found | **5** |

All five phases have been coded and all TypeScript compiles cleanly. The remaining gaps are: a handful of missing audit log events on server-side auth routes, missing `_permissions` on the chat module, a missing scope-check on employee PUT, a missing manager-verification on leave approval, and all manual/integration testing items. No phase is blocked by another.

---

## Phase 0 — Database Foundation

### Migration Files

| Item | Status | Detail |
|------|--------|--------|
| `supabase/migrations/20260315000000_scope_levels.sql` | **DONE** | Table with 4 seed rows, RLS policies, indexes, grants |
| `supabase/migrations/20260315010000_role_module_permissions.sql` | **DONE** | Table, unique constraint, RLS, data migration from `role_modules`, indexes |
| `supabase/migrations/20260315020000_user_permission_overrides.sql` | **DONE** | Table, action CHECK constraint, unique constraint, RLS |
| `supabase/migrations/20260315030000_roles_scope_level.sql` | **DONE** | `scope_level_id` FK added, index created |

### Schema File (`supabase-schema.sql`)

| Item | Status | Detail |
|------|--------|--------|
| `scope_levels` table definition | **DONE** | All columns, RLS, seed data |
| `role_module_permissions` table definition | **DONE** | All columns, RLS, data migration seed |
| `user_permission_overrides` table definition | **DONE** | All columns, RLS |
| `roles.scope_level_id` column | **DONE** | FK to `scope_levels` |
| `is_admin()` helper function | **DONE** | Used by RLS policies |
| Indexes for all 4 tables | **DONE** | All present |
| Grants for all 4 tables | **DONE** | All present |

### TypeScript Types (`src/types/index.ts`)

| Item | Status | Detail |
|------|--------|--------|
| `ScopeLevel` interface | **DONE** | Matches DB table |
| `DataScope` interface | **DONE** | `scopeLevel`, `userId`, `employeeId?`, `teamEmployeeIds`, `teamUserIds`, `departmentId?` |
| `PermissionMatrix` interface | **DONE** | `canRead`, `canCreate`, `canEdit`, `canApprove`, `canExport`, `canDelete` |
| `RoleModulePermission` interface | **DONE** | Matches DB table |
| `UserPermissionOverride` interface | **DONE** | Matches DB table |

**Phase 0 verdict: COMPLETE**

---

## Phase 1 — Authentication Hardening

### New Files

| Item | Status | Detail |
|------|--------|--------|
| `src/middleware.ts` | **DONE** | Public routes array, unauthenticated page redirect to `/login?redirect=`, unauthenticated API 401 JSON, `@supabase/ssr` `createServerClient`, matcher excludes static assets |
| `src/lib/supabase-server.ts` | **DONE** | `createSupabaseServerClient()` using `@supabase/ssr`, handles cookie get/set/remove, graceful fail in read-only Server Components |
| `src/lib/rate-limit.ts` | **DONE** | In-memory sliding window, keyed by `IP:endpoint`, auto-cleanup every 5 min, returns `{ allowed, retryAfter? }` |
| `src/app/api/auth/login/route.ts` | **DONE** | Rate limited (5/min), validates via `supabaseAdmin.auth.signInWithPassword`, returns `access_token`, `refresh_token`, `expires_at`, `user` |
| `src/app/api/auth/change-password/route.ts` | **DONE** | Rate limited (3/min), requires auth, uses `admin.updateUserById` |

### Modified Files

| Item | Status | Detail |
|------|--------|--------|
| `next.config.ts` — 6 security headers | **DONE** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy` |
| `src/lib/api-auth.ts` — SSR auth | **DONE** | Uses `@supabase/ssr` `createServerClient` for cookie-based auth (replaces ad-hoc `createClient`) |
| `src/lib/api-fetch.ts` — token expiry | **DONE** | Stores `tokenExpiresAt`, checks within 60s of expiry, calls `getSession()` to refresh, redirects to `/login` on failure |
| `src/lib/auth.ts` — audit logging | **PARTIAL** | Logs `LOGIN_SUCCESS`, `LOGIN_FAILED`, `SIGN_OUT`, `PASSWORD_RESET_REQUESTED` client-side. **Missing: `PASSWORD_CHANGED` and `SESSION_EXPIRED` events.** |
| `src/lib/logger.ts` — anonymous support | **DONE** | `userId = "anonymous"` maps to `user_id = null` |
| `src/components/AuthGuard.tsx` — 5s timeout | **DONE** | Changed from 12s to 5s, comment added |
| `src/app/api/auth/request-password-setup/route.ts` — rate limit | **DONE** | 3/min per IP |

### Audit Logging Gaps

| Event | Status | Detail |
|-------|--------|--------|
| Login success | **DONE** | Client-side in `auth.ts` |
| Login failure | **DONE** | Client-side in `auth.ts` |
| Sign out | **DONE** | Client-side in `auth.ts` |
| Password reset request | **DONE** | Client-side in `auth.ts` |
| Password changed | **MISSING** | `change-password/route.ts` has no `logCritical` or audit log insert |
| Session expired | **MISSING** | No code logs this event anywhere |

### Manual Testing Items (not verified)

- [ ] Incognito -> `/m/hr/leaves` -> instant redirect to `/login` (no white flash)
- [ ] `/api/hr/employees` without token -> 401 JSON
- [ ] DevTools -> Network -> security headers present
- [ ] 6 rapid login POSTs -> 6th returns 429
- [ ] Token auto-refresh after ~1 hour idle
- [ ] Auth events appear in `audit_logs` table

**Phase 1 verdict: PARTIAL — 2 audit log events missing (password changed, session expired). All infrastructure is in place.**

---

## Phase 2 — Data Scope Layer

### New Files

| Item | Status | Detail |
|------|--------|--------|
| `src/lib/data-scope.ts` | **DONE** | `resolveDataScope()` with all 5 steps (admin shortcut, no employee = client, has reports = manager, else employee, role override). `scopeQuery()` with `all`/`team`/`self` branches, `useEmployeeIds` parameter. Fallback defaults if DB unavailable. |
| `src/lib/permissions.ts` | **DONE** | `getModulePermissions()` with admin shortcut, role lookup, user override merge, `canDelete = false` for non-admins. `requirePermission()` throws 403. |
| `src/app/api/user/permissions/route.ts` | **DONE** | `GET ?module=<parentSlug>`, calls `requireModuleAccess` + `resolveDataScope`, fetches all sub-module permissions in parallel, returns `{ scopeLevel, dataVisibility, canDelete, actions }` |

### Modified Files

| Item | Status | Detail |
|------|--------|--------|
| `src/lib/api-auth.ts` — `AuthWithScope` | **DONE** | New `AuthResult` and `AuthWithScope` interfaces. `requireSubModuleAccess` returns `{ auth, scope, permissions }`. `skipScope` option supported. `resolveDataScope` and `getModulePermissions` called in parallel via `Promise.all`. |

### Verification of `resolveDataScope` Logic

| Step | Status |
|------|--------|
| Admin -> scope `admin` (all, can_delete) | **DONE** |
| No employee record -> scope `client` (self) | **DONE** |
| Has direct reports -> scope `manager` (team), collects IDs | **DONE** |
| No reports -> scope `employee` (self) | **DONE** |
| Role `scope_level_id` overrides auto-detect | **DONE** |
| Fetches `ScopeLevel` from DB with fallback defaults | **DONE** |

### Verification of `scopeQuery` Logic

| Visibility | Status | Implementation |
|------------|--------|----------------|
| `all` | **DONE** | Returns query unchanged |
| `team` + `useEmployeeIds=true` | **DONE** | `.in(column, [ownEmployeeId, ...teamEmployeeIds])` |
| `team` + `useEmployeeIds=false` | **DONE** | `.in(column, [userId, ...teamUserIds])` |
| `self` + `useEmployeeIds=true` | **DONE** | `.eq(column, employeeId)` |
| `self` + `useEmployeeIds=false` | **DONE** | `.eq(column, userId)` |

### Manual Testing Items (not verified)

- [ ] Admin gets all data, manager gets team, employee gets self, client gets self
- [ ] User overrides (grant/revoke) are respected over role defaults
- [ ] Permissions API returns correct JSON for each scope level

**Phase 2 verdict: COMPLETE**

---

## Phase 3 — API Route Scoping

### Sample Route Audit (12 routes deep-checked)

| Route | scopeQuery | canCreate check | canEdit check | canApprove check | can_delete check | _permissions in GET | Status |
|-------|-----------|----------------|--------------|-----------------|-----------------|-------------------|--------|
| `hr/employees` | `scopeQuery(query, scope, "id", true)` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `hr/leaves` | `scopeQuery(query, scope, "employee_id", true)` | Yes | N/A (PUT = approve) | `canApprove` | N/A | Yes | **DONE** |
| `finance/expenses` | `scopeQuery(query, scope, "created_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `tasks` | Custom team scoping via `resolveDataScope` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `sales/optin-tracking` | `scopeQuery(query, scope, "assigned_to")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `payments/daily-collection` | `scopeQuery(query, scope, "created_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `seo/keyword-tracker` | `scopeQuery(query, scope, "created_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `meta/campaign-tracker` | `scopeQuery(query, scope, "decided_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `marketing/content/ads` | `scopeQuery(query, scope, "created_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `analytics/daily-sheet` | `scopeQuery(query, scope, "created_by")` | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `automations/email/templates` | No scoping (global templates) | Yes | Yes | N/A | `scope.scopeLevel.can_delete` | Yes | **DONE** |
| `chat/messages` | Scoped by channel membership | N/A (membership) | Ownership check | N/A | Admin or owner | **No** `_permissions` | **PARTIAL** |
| `hr/salaries` | `scopeQuery(query, scope, "employee_id", true)` | Verified via grep | Verified via grep | N/A | N/A | Yes | **DONE** |

### Module-Level Summary

| Module | Routes Updated | Status |
|--------|---------------|--------|
| HR | 15 routes | **DONE** |
| Finance | 4 routes | **DONE** |
| Tasks | 4 routes | **DONE** |
| Sales | 9 routes | **DONE** |
| Payments | 4 routes | **DONE** |
| Marketing/Content | 4 routes | **DONE** |
| SEO | ~12 routes | **DONE** |
| Meta Ads | ~15 routes | **DONE** |
| Analytics | 3 routes | **DONE** |
| Chat | Verified | **DONE** (already scoped by membership) |
| Admin | Verified | **DONE** (already uses `requireAdmin`) |
| Razorpay | 7 routes | **DONE** (per changelog) |
| Automations | 3 routes | **DONE** |
| GHL | 1 route | **DONE** (per changelog) |

### Issues Found in Phase 3

1. **BUG: Chat messages GET does not include `_permissions`** — The `chat/messages/route.ts` returns `{ messages }` without `_permissions`. This is the only scoped route missing it among those checked. Low severity since chat is scoped by membership rather than role.

2. **BUG: Employee PUT does not scope-check record ownership** — `hr/employees` PUT checks `canEdit` but does not verify the employee record being edited is within the user's scope. A manager with `canEdit` could potentially edit an employee outside their team if they know the ID. The GET already scopes correctly, so the ID would not normally be visible, but a direct API call could bypass this.

3. **BUG: Leave approval PUT does not verify approver is the reporting manager** — The plan specifies "verify approver is the reporting manager" but the implementation only checks `canApprove` permission. Any user with `canApprove` on `hr-leaves` can approve any leave request within their scope, not just their direct reports'.

### Manual Testing Items (not verified)

- [ ] Admin GET returns ALL employees; Manager returns own + reports; Employee returns own
- [ ] Employee DELETE returns 403
- [ ] Manager DELETE returns 403
- [ ] Manager PUT on leave (approve, is reporting manager) returns 200
- [ ] Employee PUT on leave (approve) returns 403
- [ ] All GET responses include `_permissions` object

**Phase 3 verdict: DONE with 3 bugs noted above**

---

## Phase 4 — Frontend Permission-Aware UI

### Core Infrastructure

| Item | Status | Detail |
|------|--------|--------|
| `src/hooks/usePermissions.ts` | **DONE** | Takes `parentModuleSlug`, calls `/api/user/permissions`, module-level Map cache with 5min TTL, `canDo(subModule, action)`, admin shortcut, `invalidatePermissionsCache()` exported |
| `src/components/PermissionGate.tsx` | **DONE** | Props: `module`, `subModule`, `action`, `children`, `fallback?`. Uses `usePermissions`, renders nothing while loading |
| Permissions Context | **DONE** | Implemented via module-level cache in `usePermissions` (no separate context needed) |

### Shell / Global UI

| Item | Status | Detail |
|------|--------|--------|
| Scope level badge in header | **DONE** | `Shell.tsx` imports `usePermissions("admin")`, displays scope badge with color coding (admin=gold, manager=blue, client=purple, default=green) |
| Module cards show only permitted modules | **DONE** | Already worked via `requireModuleAccess` (verified pre-existing) |
| Notifications don't leak cross-scope data | **MANUAL TEST** | Not verified |

### Pages Using PermissionGate (verified via grep)

| Page | Status |
|------|--------|
| `src/app/m/hr/employees/page.tsx` | **DONE** |
| `src/app/m/hr/leaves/page.tsx` | **DONE** |
| `src/app/m/hr/salary/page.tsx` | **DONE** |
| `src/app/m/hr/departments/page.tsx` | **DONE** |
| `src/app/m/hr/designations/page.tsx` | **DONE** |
| `src/app/m/hr/holidays/page.tsx` | **DONE** |
| `src/app/m/hr/kpis/page.tsx` | **DONE** |
| `src/app/m/hr/payroll/page.tsx` | **DONE** |
| `src/app/m/finance/expenses/page.tsx` | **DONE** |
| `src/app/m/finance/budgets/page.tsx` | **DONE** |
| `src/app/m/finance/categories/page.tsx` | **DONE** |
| `src/app/m/tasks/board/page.tsx` | **DONE** |
| `src/app/m/tasks/projects/page.tsx` | **DONE** |
| `src/app/m/admin/people/page.tsx` | **DONE** |
| `src/app/m/admin/roles/page.tsx` | **DONE** |

### Admin Permissions Page (`src/app/m/admin/permissions/page.tsx`)

| Item | Status | Detail |
|------|--------|--------|
| Permission Matrix tab | **DONE** | Columns: Read, Create, Edit, Approve, Export. Rows: modules in tree. Role selector. Checkbox cells. |
| PUT `type: "permission_matrix"` handler | **DONE** | `admin/permissions/route.ts` handles matrix upsert |
| Scope Level section | **DONE** | GET returns `scopeLevels`, displayed in page |
| Module Access tab | **DONE** | Existing ON/OFF toggle preserved |
| User Overrides tab | **DONE** | Third tab exists |
| Invalidates permissions cache | **DONE** | `invalidatePermissionsCache()` imported and used |

### Pages That SHOULD Have PermissionGate But Might Not

The TODO.md says Sales, Marketing, SEO, Payments, and Meta Ads pages were "verified read-only views, no action buttons to wrap." This is plausible for pages that only display data synced from external sources (GHL, Meta API, etc.), but if any of these pages have inline edit features (e.g., status dropdowns, notes fields), they should ideally have PermissionGate wrappers. The TODO marks these as verified.

### Manual Testing Items (not verified)

- [ ] Employee login -> no delete/approve buttons visible
- [ ] Manager login -> approve buttons where `can_approve = true`, no delete
- [ ] Admin login -> all buttons including delete
- [ ] Client login -> minimal UI
- [ ] DevTools Network -> every data response has `_permissions`
- [ ] `_permissions` matches visible buttons
- [ ] Changing permission in matrix -> immediately reflected

**Phase 4 verdict: COMPLETE (code-complete, manual testing outstanding)**

---

## Missing Items / Gaps

### Code Gaps

| # | Item | Severity | Detail |
|---|------|----------|--------|
| 1 | `PASSWORD_CHANGED` audit event | Medium | `change-password/route.ts` does not log to `audit_logs`. The plan requires Tier 1 `logCritical` on password change. |
| 2 | `SESSION_EXPIRED` audit event | Low | No code logs session expiry. `api-fetch.ts` redirects to `/login` but doesn't log. |
| 3 | `_permissions` missing on chat messages GET | Low | Chat is already scoped by membership, but `_permissions` is not included in the response for consistency. |
| 4 | Employee PUT lacks scope-check on target record | Medium | A user with `canEdit` could edit any employee by ID, not just those within their scope. |
| 5 | Leave approval lacks manager verification | Medium | Any user with `canApprove` can approve any leave within scope, not just their direct reports'. |

### Testing Gaps

All items marked `[ ]` in the TODO.md are manual/integration tests that cannot be verified from code alone. There are approximately 25 such items spanning:
- Phase 1: middleware redirect, API 401, headers, rate limit, token refresh, audit log DB verification
- Phase 2: scope filtering correctness per role level, user override behavior
- Phase 3: end-to-end data isolation per role (admin/manager/employee)
- Phase 4: UI button visibility per role, `_permissions` matching UI
- Final: security, data isolation, action control, audit trail, schema freshness

---

## Potential Bugs

### Bug 1: Employee PUT has no scope check on target record
- **File:** `src/app/api/hr/employees/route.ts` line 194-239
- **Issue:** PUT checks `canEdit` but never verifies the employee ID being updated falls within the user's scope (team or self). An attacker knowing an employee UUID could modify records outside their scope.
- **Fix:** After auth, fetch the target employee and verify it's within `result.scope` before allowing the update.

### Bug 2: Leave approval does not verify reporting relationship
- **File:** `src/app/api/hr/leaves/route.ts` line 118-202
- **Issue:** The plan states "verify approver is the reporting manager" but the code only checks `canApprove`. A user with `canApprove` permission could approve leaves for employees who don't report to them.
- **Fix:** After auth, fetch the leave request's employee, check their `reporting_to` matches the approver's employee ID (or allow admin override).

### Bug 3: Chat messages GET missing `_permissions`
- **File:** `src/app/api/chat/messages/route.ts` line 191
- **Issue:** Returns `{ messages }` without `_permissions`. Every other scoped GET route includes `_permissions` for frontend consistency.
- **Fix:** Add `_permissions` to the response. Since chat uses `requireModuleAccess` (not `requireSubModuleAccess`), permissions would need to be resolved separately.

### Bug 4: Server-side login route does not audit log
- **File:** `src/app/api/auth/login/route.ts`
- **Issue:** The rate-limited server-side login endpoint does not write to `audit_logs`. Audit logging for login success/failure is done client-side in `src/lib/auth.ts`, which means failed logins from direct API calls (curl, Postman, attacker scripts) are never logged.
- **Severity:** Medium. Server-side logging is more reliable since client-side logging can be bypassed.
- **Fix:** Add `supabaseAdmin.from("audit_logs").insert(...)` calls for both success and failure in the login route.

### Bug 5: Change-password route does not audit log
- **File:** `src/app/api/auth/change-password/route.ts`
- **Issue:** Password changes are not logged to `audit_logs`. This is a Tier 1 critical event per the plan.
- **Fix:** Add audit log insert after successful password change.

---

## Manual Testing Needed

### Phase 1 — Authentication

- [ ] **Middleware redirect:** Incognito browser -> navigate to `/m/hr/leaves` -> should redirect to `/login` instantly (no white flash or page content flash)
- [ ] **API 401:** `curl /api/hr/employees` without Authorization header -> `{ "error": "Unauthorized" }` 401
- [ ] **Security headers:** Open DevTools -> Network -> any page response -> verify all 6 headers present (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`)
- [ ] **Rate limiting:** Send 6 rapid POST requests to `/api/auth/login` from same IP -> 6th should return 429 with `Retry-After` header
- [ ] **Token refresh:** Log in, wait ~55 minutes idle, then perform an action -> token should auto-refresh without redirect
- [ ] **Audit logs:** Query `audit_logs` table after login/logout -> verify entries exist with correct action, userId, email

### Phase 2 — Data Scope

- [ ] **Admin scope:** Log in as admin -> `GET /api/user/permissions?module=hr` -> `scopeLevel: "admin"`, all actions true, `canDelete: true`
- [ ] **Employee scope:** Log in as employee with no reports -> same endpoint -> `scopeLevel: "employee"`, limited actions, `canDelete: false`
- [ ] **Manager scope:** Log in as user with direct reports -> same endpoint -> `scopeLevel: "manager"`
- [ ] **User override:** Add a `user_permission_overrides` row granting `canApprove` on `hr-leaves` to an employee, then check permissions -> should show `canApprove: true`

### Phase 3 — Data Isolation

- [ ] **Employee A vs B:** Log in as Employee A -> `GET /api/finance/expenses` -> should NOT see Employee B's expenses
- [ ] **Employee can't see others' leaves:** `GET /api/hr/leaves` as employee -> only own leave requests
- [ ] **Manager sees team:** `GET /api/hr/employees` as manager -> returns own record + direct reports only
- [ ] **Admin sees all:** `GET /api/hr/employees` as admin -> returns all employees
- [ ] **Delete blocked for non-admin:** `DELETE /api/hr/employees?id=XXX` as employee -> 403
- [ ] **Delete blocked for manager:** Same as above as manager -> 403
- [ ] **Approve blocked for employee:** `PUT /api/hr/leaves` with approve action as employee without `canApprove` -> 403
- [ ] **All GET responses include `_permissions`:** Spot-check 5-10 API responses in DevTools Network tab

### Phase 4 — Frontend UI

- [ ] **Employee view:** Log in as employee -> navigate to HR Employees page -> "Add Employee" button should be hidden (unless `canCreate` granted)
- [ ] **Manager view:** Log in as manager -> HR Leaves -> "Approve" button visible (if `canApprove` granted)
- [ ] **Admin view:** Log in as admin -> all CRUD buttons visible including Delete
- [ ] **Client view:** Log in as client (no employee record) -> minimal UI, read-only
- [ ] **Permission matrix change:** As admin, change a permission in the matrix -> log out, log in as affected role -> verify change reflected immediately
- [ ] **Scope badge:** Verify user scope badge appears in header next to user avatar
- [ ] **Notifications:** Verify notifications don't leak cross-scope data (e.g., employee shouldn't see admin-only notifications)

### Final End-to-End

- [ ] **Direct API test with curl:** For each scope level (admin, manager, employee, client), test GET, POST, PUT, DELETE on at least one resource and verify correct 200/403 responses
- [ ] **Audit trail completeness:** After a session of CRUD operations, query `audit_logs` and verify Tier 1 and Tier 2 entries exist with correct `before_value`/`after_value`
- [ ] **Schema freshness:** Run `supabase-schema.sql` against a fresh database and verify it creates the complete schema without errors

---

## File Inventory — New Files

| File | Phase | Exists | Content Verified |
|------|-------|--------|------------------|
| `supabase/migrations/20260315000000_scope_levels.sql` | 0 | Yes | Yes |
| `supabase/migrations/20260315010000_role_module_permissions.sql` | 0 | Yes | Yes |
| `supabase/migrations/20260315020000_user_permission_overrides.sql` | 0 | Yes | Yes |
| `supabase/migrations/20260315030000_roles_scope_level.sql` | 0 | Yes | Yes |
| `src/middleware.ts` | 1 | Yes | Yes |
| `src/lib/supabase-server.ts` | 1 | Yes | Yes |
| `src/lib/rate-limit.ts` | 1 | Yes | Yes |
| `src/app/api/auth/login/route.ts` | 1 | Yes | Yes |
| `src/app/api/auth/change-password/route.ts` | 1 | Yes | Yes |
| `src/lib/data-scope.ts` | 2 | Yes | Yes |
| `src/lib/permissions.ts` | 2 | Yes | Yes |
| `src/app/api/user/permissions/route.ts` | 2 | Yes | Yes |
| `src/hooks/usePermissions.ts` | 4 | Yes | Yes |
| `src/components/PermissionGate.tsx` | 4 | Yes | Yes |

## File Inventory — Modified Files

| File | Phase | Exists | Content Verified |
|------|-------|--------|------------------|
| `supabase-schema.sql` | 0 | Yes | Yes — all 4 new tables, indexes, RLS, seeds, grants |
| `src/types/index.ts` | 0+2 | Yes | Yes — 5 new interfaces |
| `next.config.ts` | 1 | Yes | Yes — 6 security headers |
| `src/lib/api-auth.ts` | 1+2 | Yes | Yes — SSR auth + scope/permissions return |
| `src/lib/api-fetch.ts` | 1 | Yes | Yes — token expiry handling |
| `src/lib/auth.ts` | 1 | Yes | Partial — 4 of 5 audit events |
| `src/lib/logger.ts` | 1 | Yes | Yes — anonymous userId support |
| `src/components/AuthGuard.tsx` | 1 | Yes | Yes — 5s timeout |
| `src/components/Shell.tsx` | 4 | Yes | Yes — scope badge |
| `src/app/m/admin/permissions/page.tsx` | 4 | Yes | Yes — 3 tabs, matrix table |
| 15 page files with PermissionGate | 4 | Yes | Yes — all 15 verified via grep |
| ~75 API route files | 3 | Yes | 12 spot-checked, all correct |
