# APEX OS — Production Upgrade TODO

> Track every task from `PRODUCTION-UPGRADE.md`. Tick boxes as completed.
> Order: Phase 0 → 1 → 2 → 3 → 4. Do not skip phases.

---

## PHASE 0 — Database Foundation

### 0.1 `user_module_overrides` Table
- [x] Migration file exists (`supabase/migrations/20260308200000_user_module_overrides.sql`)
- [x] Verify table columns: `id`, `user_id`, `module_id`, `access_type` (`grant`|`revoke`), `granted_by`, `created_at`
- [x] Verify unique constraint on `(user_id, module_id)`
- [x] Verify RLS: admins can read/write all; users can read their own
- [x] Add table definition to `supabase-schema.sql` if missing

### 0.2 `scope_levels` Table
- [x] Create migration file `supabase/migrations/20260315000000_scope_levels.sql`
- [x] Add columns: `id` (UUID PK), `name`, `slug`, `rank` (int), `data_visibility` (`all`|`team`|`self`), `can_delete` (bool), `is_system` (bool), `description`, `created_at`
- [x] Add unique constraint on `slug`
- [x] Seed 4 default rows:
  - [x] Admin — rank 1, data_visibility `all`, can_delete `true`, is_system `true`
  - [x] Manager — rank 2, data_visibility `team`, can_delete `false`, is_system `true`
  - [x] Employee — rank 3, data_visibility `self`, can_delete `false`, is_system `true`
  - [x] Client — rank 4, data_visibility `self`, can_delete `false`, is_system `true`
- [x] Add RLS: all authenticated users can read; only admins can write
- [x] Run migration in Supabase and verify 4 rows seeded
- [x] Add table definition to `supabase-schema.sql`

### 0.3 `role_module_permissions` Table
- [x] Create migration file `supabase/migrations/20260315010000_role_module_permissions.sql`
- [x] Add columns: `id` (UUID PK), `role_id` (FK → roles), `module_id` (FK → modules), `can_read`, `can_create`, `can_edit`, `can_approve`, `can_export` (all bool, default false), `created_at`, `updated_at`
- [x] Add unique constraint on `(role_id, module_id)`
- [x] **No `can_delete` column** — delete is admin-only in code, never in matrix
- [x] Migrate existing data from `role_modules`: for every existing `role_modules` row, insert into `role_module_permissions` with `can_read = true`, all other actions `false`
- [x] Add RLS: admins can read/write all; authenticated users can read their own role's permissions
- [x] Run migration in Supabase and verify data migrated (297 rows = 297 role_modules rows)
- [x] Add table definition to `supabase-schema.sql`

### 0.4 `user_permission_overrides` Table
- [x] Create migration file `supabase/migrations/20260315020000_user_permission_overrides.sql`
- [x] Add columns: `id` (UUID PK), `user_id`, `module_id` (FK → modules), `action` (`read`|`create`|`edit`|`approve`|`export`), `granted` (bool), `granted_by`, `created_at`
- [x] Add unique constraint on `(user_id, module_id, action)`
- [x] Add RLS: admins can read/write all; users can read their own overrides
- [x] Run migration in Supabase
- [x] Add table definition to `supabase-schema.sql`

### 0.5 `roles` Table Update
- [x] Add `scope_level_id` FK column to `roles` table (nullable — null means auto-detect)
- [x] Create migration for this column addition (`supabase/migrations/20260315030000_roles_scope_level.sql`)
- [x] Update `supabase-schema.sql`

### 0.6 Phase 0 Verification
- [x] All 4 tables exist in Supabase (verified via REST API)
- [x] `scope_levels` has exactly 4 seed rows
- [x] `role_module_permissions` has rows migrated from `role_modules` (297 = 297)
- [x] `src/types/index.ts` — add TypeScript interfaces: `ScopeLevel`, `RoleModulePermission`, `UserPermissionOverride`

---

## PHASE 1 — Authentication Hardening

### 1.1 Next.js Middleware (`src/middleware.ts`)
- [x] Create `src/middleware.ts`
- [x] Install / confirm `@supabase/ssr` is available (already installed per CLAUDE.md)
- [x] Define public routes array: `/login`, `/auth/callback`, `/auth/reset-password`, `/api/public/*`
- [x] Logic: if route is public → pass through
- [x] Logic: if no valid session cookie → redirect to `/login` (for page routes)
- [x] Logic: if no valid session cookie → return 401 JSON `{ error: "Unauthorized" }` (for `/api/*` routes)
- [x] Logic: if valid session → refresh token if needed, pass through
- [x] Export `config.matcher` to exclude `/_next/static`, `/_next/image`, `/favicon.ico`
- [ ] Test: incognito → navigate to `/m/hr/leaves` → instant redirect to `/login` (no white flash)
- [ ] Test: call `/api/hr/employees` without token → `{ "error": "Unauthorized" }` 401

### 1.2 SSR-Aware Supabase Client (`src/lib/supabase-server.ts`)
- [x] Create `src/lib/supabase-server.ts`
- [x] Use `@supabase/ssr`'s `createServerClient`
- [x] Export `createSupabaseServerClient(cookieStore)` function
- [x] Handle cookie get/set/remove for Next.js `cookies()` API
- [x] Update `src/lib/api-auth.ts` lines 37-51 (ad-hoc client creation) to use `createSupabaseServerClient` instead
- [x] Update middleware to use `createSupabaseServerClient`

### 1.3 Security Headers (`next.config.ts`)
- [x] Open `next.config.ts`
- [x] Add `headers()` async function returning array of header objects
- [x] Add `X-Frame-Options: DENY`
- [x] Add `X-Content-Type-Options: nosniff`
- [x] Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [x] Add `Content-Security-Policy` — allow self, Supabase domain, trusted CDNs; block inline scripts (or use nonce if needed)
- [x] Add `Referrer-Policy: strict-origin-when-cross-origin`
- [x] Add `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Test: DevTools → Network tab → any page response → verify headers present

### 1.4 Rate Limiting (`src/lib/rate-limit.ts`)
- [x] Create `src/lib/rate-limit.ts`
- [x] Implement in-memory sliding window counter keyed by IP address
- [x] Export `rateLimit(ip, endpoint, limit, windowMs)` function
- [x] Returns `{ allowed: boolean, retryAfter?: number }`
- [x] Apply to `/api/auth/login` — 5 attempts per 1 minute
- [x] Apply to `/api/auth/reset-password` — 3 requests per 1 minute
- [x] Apply to `/api/auth/change-password` — 3 attempts per 1 minute
- [x] Return `429 Too Many Requests` with `Retry-After` header when exceeded
- [ ] Test: 6 rapid login POSTs from same IP → 6th returns 429

### 1.5 Token Expiry Handling (`src/lib/api-fetch.ts`)
- [x] Open `src/lib/api-fetch.ts`
- [x] Store `expires_at` timestamp alongside `cachedAccessToken` in `onAuthStateChange`
- [x] Before each `apiFetch` call, check: is token within 60 seconds of `expires_at`?
- [x] If yes: call `supabase.auth.getSession()` to force-refresh token
- [x] If refresh fails: redirect to `/login`
- [x] Update `cachedAccessToken` after successful refresh

### 1.6 Auth Event Logging (`src/lib/auth.ts`)
- [x] Open `src/lib/auth.ts`
- [x] Add Tier 1 `logCritical` call on: login success (userId, email, IP, timestamp)
- [x] Add Tier 1 `logCritical` call on: login failure (email, IP, timestamp, reason)
- [x] Add Tier 1 `logCritical` call on: password reset request (email, IP, timestamp)
- [x] Add Tier 1 `logCritical` call on: password changed (userId, timestamp)
- [x] Add Tier 1 `logCritical` call on: session expired (userId, timestamp)
- [ ] Verify `audit_logs` table receives these entries after each event

### 1.7 AuthGuard Timeout Reduction (`src/components/AuthGuard.tsx`)
- [x] Open `src/components/AuthGuard.tsx`
- [x] Find the 12-second timeout constant
- [x] Change to 5 seconds (middleware is now primary gate)
- [x] Add comment: `// Middleware is primary gate; this is fallback only`

### 1.8 Phase 1 Verification
- [ ] Middleware redirects unauthenticated users instantly (no flash)
- [ ] API routes return 401 without token
- [ ] Security headers visible in DevTools
- [ ] Rate limit triggers on 6th login attempt
- [ ] Token auto-refreshes after ~1 hour idle
- [ ] Auth events appear in `audit_logs` table

---

## PHASE 2 — Data Scope Layer

### 2.1 TypeScript Types (`src/types/index.ts`)
- [x] Add `ScopeLevel` interface: `{ id, name, slug, rank, data_visibility, can_delete, is_system }`
- [x] Add `DataScope` interface: `{ scopeLevel: ScopeLevel, userId, employeeId?, teamEmployeeIds: string[], teamUserIds: string[], departmentId? }`
- [x] Add `PermissionMatrix` interface: `{ canRead, canCreate, canEdit, canApprove, canExport, canDelete }`
- [x] Add `RoleModulePermission` interface (matches DB table)
- [x] Add `UserPermissionOverride` interface (matches DB table)

### 2.2 Scope Resolver (`src/lib/data-scope.ts`)
- [x] Create `src/lib/data-scope.ts`
- [x] Export `resolveDataScope(userId, roleId, isAdmin): Promise<DataScope>`
- [x] Step 1: if `isAdmin = true` → return scope level `admin` (data_visibility `all`, can_delete `true`), no employee lookup needed
- [x] Step 2: query `hr_employees` for this `userId`; if no record → scope level `client` (data_visibility `self`)
- [x] Step 3: query `hr_employees` where `reporting_to = employeeId`; if results → scope level `manager`
  - [x] Collect all direct report `employee_id`s as `teamEmployeeIds`
  - [x] Fetch `auth_user_id` for each direct report → `teamUserIds`
- [x] Step 4: else → scope level `employee` (data_visibility `self`)
- [x] Step 5: check `roles.scope_level_id` — if set, override auto-detected level with custom scope
- [x] Fetch `ScopeLevel` row from `scope_levels` table by slug
- [x] Return full `DataScope` object
- [x] Export `scopeQuery(query, scope, column)` helper:
  - [x] `data_visibility = all` → return query unchanged
  - [x] `data_visibility = team` → apply `.in(column, [ownId, ...teamIds])`
  - [x] `data_visibility = self` → apply `.eq(column, ownId)`

### 2.3 Permission Matrix Checker (`src/lib/permissions.ts`)
- [x] Create `src/lib/permissions.ts`
- [x] Export `getModulePermissions(userId, roleId, moduleSlug): Promise<PermissionMatrix>`
- [x] Step 1: look up `modules` table by `slug` to get `module_id`
- [x] Step 2: query `role_module_permissions` for `(roleId, moduleId)`
- [x] Step 3: query `user_permission_overrides` for `(userId, moduleId)` — fetch all action overrides
- [x] Step 4: merge — user overrides win over role permissions
- [x] Step 5: if `isAdmin` → return all `true` (including `canDelete = true`)
- [x] Step 6: always set `canDelete = scope.can_delete` (admin only)
- [x] Return `PermissionMatrix`
- [x] Export `requirePermission(matrix, action): void | throws 403` helper for API use

### 2.4 Extend API Auth (`src/lib/api-auth.ts`)
- [x] Import `resolveDataScope` from `data-scope.ts`
- [x] Import `getModulePermissions` from `permissions.ts`
- [x] Update `requireSubModuleAccess` return type to include `scope: DataScope` and `permissions: PermissionMatrix`
- [x] After successful auth + access check, call `resolveDataScope` and `getModulePermissions`
- [x] Return `{ auth, scope, permissions }` from `requireSubModuleAccess`

### 2.5 Permissions API Endpoint (`src/app/api/user/permissions/route.ts`)
- [x] Create directory `src/app/api/user/permissions/`
- [x] Create `route.ts` with `GET` handler
- [x] Accept `?module=<slug>` query param
- [x] Call `requireModuleAccess` for auth
- [x] Call `resolveDataScope` to get user's scope level
- [x] For each sub-module under the requested parent module, call `getModulePermissions`
- [x] Return JSON: `{ scopeLevel, dataVisibility, canDelete, actions: { [subModuleSlug]: PermissionMatrix } }`
- [ ] Test: Admin → `GET /api/user/permissions?module=hr` → all `true`, canDelete `true`
- [ ] Test: Employee → same endpoint → limited actions, canDelete `false`

### 2.6 Phase 2 Verification
- [ ] `resolveDataScope` correctly identifies Admin / Manager / Employee / Client
- [ ] `scopeQuery` adds correct WHERE clauses
- [ ] `getModulePermissions` correctly merges role permissions + user overrides
- [ ] Permissions API returns correct JSON for each scope level
- [ ] User overrides (grant/revoke) are respected over role defaults

---

## PHASE 3 — API Route Scoping

> Pattern for every route: auth → permission check → scope resolve → filtered query → `_permissions` in response

### 3.0 Universal Helper Update
- [x] Update `requireSubModuleAccess` to optionally skip scope resolve (for routes that don't need it, e.g. POST-only)
- [x] Create `_permissions` metadata pattern (added directly to responses instead of separate helper)

### 3.1 HR Module — `src/app/api/hr/` (15 routes updated)

#### Employees (`/api/hr/employees`)
- [x] `GET`: apply `scopeQuery` on `id` column (self/team/all); respect `can_read`
- [x] `POST`: check `can_create`; return 403 if denied
- [x] `PUT /[id]`: check `can_edit`; scope-check that record is within user's scope
- [x] `DELETE /[id]`: check `scope.can_delete`; return 403 if not admin
- [x] Add `_permissions` to GET response

#### Leaves (`/api/hr/leaves`)
- [x] `GET`: apply `scopeQuery` on `employee_id` column; respect `can_read`
- [x] `POST`: check `can_create`; employee can only create for themselves
- [x] `PUT /[id]` (approve/reject): check `can_approve`; verify approver is the reporting manager
- [x] Add `_permissions` to GET response

#### Salaries (`/api/hr/salaries`)
- [x] `GET`: apply `scopeQuery` on `employee_id`; respect `can_read`
- [x] `POST`: check `can_create`
- [x] Add `_permissions` to GET response

#### KPIs / KRAs (`/api/hr/kpis`, `/api/hr/kras`)
- [x] `GET`: scope by `employee_id` (kpi-entries, kras); reference data unscoped (kpis)
- [x] `PUT`: check `can_edit`
- [x] `DELETE`: admin-only

#### Designations / Departments / Holidays / Leave Types (reference data)
- [x] `GET`: allow all users with HR access (`can_read`), `_permissions` added
- [x] `POST`/`PUT`: check `can_create`/`can_edit`
- [x] `DELETE`: admin-only

#### Additional HR routes
- [x] salary-cycles: scoped on `employee_id`, permission checks
- [x] commission-rules: scoped on `employee_id`, permission checks
- [x] leave-balances: scoped on `employee_id`
- [x] dashboard: scoped aggregation queries
- [x] settings: permission checks

### 3.2 Finance Module — `src/app/api/finance/` (4 routes updated)

#### Expenses (`/api/finance/expenses`)
- [x] `GET`: apply `scopeQuery` on `created_by` column; `_permissions` added
- [x] `POST`: check `can_create`; set `created_by = userId`
- [x] `PUT`: check `can_edit`
- [x] `DELETE`: admin-only

#### Budgets (`/api/finance/budgets`)
- [x] `GET`: allow all with Finance access, `_permissions` added
- [x] `POST`/`PUT`: check `can_create`/`can_edit`

#### Categories (`/api/finance/categories`)
- [x] `GET`: allow all, `_permissions` added
- [x] `POST`: check `can_create`; `DELETE`: admin-only

#### Summary / Reports
- [x] `GET`: scope data by user scope level via `resolveDataScope` + `scopeQuery`

### 3.3 Tasks Module — `src/app/api/tasks/` (4 routes updated)
- [x] tasks/route.ts: Enhanced with `resolveDataScope`, team scoping for tasks-team, `_permissions`, canCreate/canEdit, admin-only DELETE
- [x] tasks/projects: scoped on `owner_id`, permission checks
- [x] tasks/comments: `_permissions` added, canCreate check
- [x] tasks/users: `_permissions` added

### 3.4 Sales Module — `src/app/api/sales/` (9 routes updated)
- [x] `GET` all routes: `scopeQuery` on `assigned_to` or `created_by` where columns exist
- [x] `POST`: check `can_create`
- [x] `PUT`: check `can_edit`
- [x] `DELETE`: admin-only
- [x] `_permissions` added to all GET responses

### 3.5 Payments Module — `src/app/api/payments/` (4 routes updated)
- [x] daily-collection: scoped on `created_by`, permission checks
- [x] failed-tracking: scoped on `created_by`, permission checks
- [x] invoice-follow-ups: scoped on `created_by`, permission checks
- [x] revenue-targets: broader visibility, permission checks, `_permissions`

### 3.6 Marketing Module — `src/app/api/marketing/content/` (4 routes updated)
- [x] ads, social, sop-tracker, video-editing: all scoped on `created_by`, permission checks, `_permissions`

### 3.7 SEO Module — `src/app/api/seo/` (~12 routes updated)
- [x] Internal tables (keyword-tracker, content-briefs, competitor-tracker, task-log): scoped on `created_by`
- [x] GBP routes: scoped where applicable
- [x] External API routes: `_permissions` added, no scoping needed
- [x] All mutation routes: permission checks added

### 3.8 Meta Ads Module — `src/app/api/meta/` (~15 routes updated)
- [x] Internal tables (campaign-tracker, creative-tracker, budget-plans, conversion-log): scoped on `decided_by`/`reviewed_by`/`created_by`
- [x] External API proxy routes: `_permissions` added, no scoping
- [x] All mutations: permission checks

### 3.9 Analytics Module — `src/app/api/analytics/` (3 routes updated)
- [x] cohort-metrics: `_permissions` added
- [x] cohort-sync: canCreate check
- [x] daily-sheet: scoped on `created_by`, full permission checks

### 3.10 Chat Module — `src/app/api/chat/`
- [x] Already scoped by channel membership — verified sufficient
- [x] DELETE on messages: admin can delete any message

### 3.11 Admin Module — `src/app/api/admin/`
- [x] All routes already use `requireAdmin()` — verified no regressions
- [x] permissions route: GET now returns `roleModulePermissions` + `scopeLevels`
- [x] permissions route: PUT handles `type: "permission_matrix"` for `role_module_permissions` upsert

### 3.12 Additional Modules
- [x] Razorpay (7 routes): `_permissions` added, permission checks on mutations
- [x] Automations (3 routes): scoped + permission checks
- [x] GHL (1 route): `_permissions` + canEdit on opportunities PUT

### 3.13 Phase 3 Verification (Run each test per module)
- [ ] Admin — `GET /api/hr/employees` → returns ALL employees
- [ ] Manager — `GET /api/hr/employees` → returns own + direct reports only
- [ ] Employee — `GET /api/hr/employees` → returns own record only
- [ ] Employee — `DELETE /api/hr/employees/[id]` → 403
- [ ] Manager — `DELETE /api/hr/expenses/[id]` → 403
- [ ] Manager — `PUT /api/hr/leaves/[id]` (approve, is reporting manager) → 200
- [ ] Employee — `PUT /api/hr/leaves/[id]` (approve) → 403
- [ ] All GET responses include `_permissions` object

---

## PHASE 4 — Frontend Permission-Aware UI

### 4.1 `usePermissions` Hook (`src/hooks/usePermissions.ts`)
- [x] Create `src/hooks/` directory if it doesn't exist
- [x] Create `src/hooks/usePermissions.ts`
- [x] Hook takes `moduleSlug` as parameter
- [x] On mount: call `GET /api/user/permissions?module={moduleSlug}` using `apiFetch`
- [x] Cache response (don't refetch on every render; refetch on user change) — module-level Map cache with 5min TTL
- [x] Return `{ scope, canDo(subModuleSlug, action), loading, error }`
- [x] `canDo(subModuleSlug, action)` returns boolean from cached response
- [x] Handle loading state (return `false` for all `canDo` while loading; admins return `true`)
- [x] Handle error state gracefully
- [x] `invalidatePermissionsCache()` exported for admin permission changes

### 4.2 `PermissionGate` Component (`src/components/PermissionGate.tsx`)
- [x] Create `src/components/PermissionGate.tsx`
- [x] Props: `module`, `subModule`, `action`, `children`, `fallback?`
- [x] Uses `usePermissions` hook internally
- [x] If `canDo(subModule, action)` → render `children`
- [x] If not → render `fallback` (or nothing if no fallback)
- [x] During loading → render nothing (prevents flash of unauthorized UI)

### 4.3 Permissions Context (optional optimization)
- [x] Implemented via module-level cache in `usePermissions` — no separate context needed
- [x] Multiple components using same parent module slug share cached data
- [x] `PermissionGate` reads from shared cache instead of making per-component API calls

### 4.4 HR Pages

#### Employees Page (`src/app/m/hr/employees/`)
- [x] Wrap "Add Employee" button in `<PermissionGate module="hr" subModule="hr-employees" action="canCreate">`
- [x] Wrap "Edit" button/icon in `<PermissionGate action="canEdit">`
- [x] Wrap "Delete" button/icon in `<PermissionGate action="canDelete">`
- [x] Verify data shown is only what the API returns (no client-side filtering needed)

#### Leaves Page (`src/app/m/hr/leaves/`)
- [x] Wrap "Apply for Leave" in `<PermissionGate action="canCreate">`
- [x] Wrap "Approve" / "Reject" buttons in `<PermissionGate action="canApprove">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Salaries Page (`src/app/m/hr/salary/`)
- [x] Wrap "Add Salary" in `<PermissionGate action="canCreate">`
- [x] Wrap "Edit" in `<PermissionGate action="canEdit">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Departments Page (`src/app/m/hr/departments/`)
- [x] Wrap "Add Department" in `<PermissionGate action="canCreate">`
- [x] Wrap "Edit" in `<PermissionGate action="canEdit">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Designations Page (`src/app/m/hr/designations/`)
- [x] Wrap "Add Designation" in `<PermissionGate action="canCreate">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Holidays Page (`src/app/m/hr/holidays/`)
- [x] Wrap "Add Holiday" in `<PermissionGate action="canCreate">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### KPIs Page (`src/app/m/hr/kpis/`)
- [x] Wrap "Define KPI", "Log Entry", "Add KRA" in `<PermissionGate action="canCreate">`

#### Payroll Page (`src/app/m/hr/payroll/`)
- [x] Wrap "Generate" in `<PermissionGate action="canCreate">`

### 4.5 Finance Pages

#### Expenses Page (`src/app/m/finance/expenses/`)
- [x] Wrap "Add Expense" in `<PermissionGate action="canCreate">`
- [x] Wrap "Edit" in `<PermissionGate action="canEdit">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Budgets Page
- [x] Wrap "Create Budget" in `<PermissionGate action="canCreate">`
- [x] Wrap "Edit" in `<PermissionGate action="canEdit">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

#### Categories Page
- [x] Wrap "Add Category" in `<PermissionGate action="canCreate">`
- [x] Wrap "Delete" in `<PermissionGate action="canDelete">`

### 4.6 Tasks Pages

#### Board (`src/app/m/tasks/board/`)
- [x] Wrap "Add task" inline button in `<PermissionGate action="canCreate">`

#### Projects (`src/app/m/tasks/projects/`)
- [x] Wrap "New Project" in `<PermissionGate action="canCreate">`
- [x] Wrap "Delete project" in `<PermissionGate action="canDelete">`

### 4.7 Admin Permissions Page (`src/app/m/admin/permissions/`)
- [x] Replace ON/OFF toggle UI with permission matrix table (new "Permission Matrix" tab)
- [x] Columns: Read, Create, Edit, Approve, Export (no Delete column — admin-only note shown)
- [x] Rows: each module in tree structure
- [x] Role selector dropdown at top
- [x] Each cell: checkbox (ticked = granted)
- [x] On change: `PUT /api/admin/permissions` with `{ type: "permission_matrix", ... }`
- [x] Add "Scope Level" section showing all scope levels with visibility
- [x] Keep existing Module Access tab and User Overrides tab (3 tabs total)
- [x] Invalidates permissions cache on change

### 4.8 All Other Module Pages (Sales, Marketing, SEO, Payments, Meta Ads)
- [x] Sales pages — verified read-only views, no action buttons to wrap
- [x] Marketing pages — verified read-only views, no action buttons to wrap
- [x] SEO pages — verified read-only views, no action buttons to wrap
- [x] Payments pages — verified read-only views, no action buttons to wrap
- [x] Meta Ads pages — verified read-only views, no action buttons to wrap

### 4.8b Admin Pages
- [x] People page — wrap Invite, Edit, Delete buttons with PermissionGate
- [x] Roles page — wrap Add Role, Edit, Delete buttons with PermissionGate

### 4.9 Shell / Global UI
- [x] Verify module cards on home page only show permitted modules (already works — `requireModuleAccess`)
- [x] Add user scope level indicator badge in header next to user name (Admin/Manager/Employee/Client with color coding)
- [ ] Ensure notifications don't leak cross-scope data (manual verification needed)

### 4.10 Phase 4 Verification
- [ ] Login as Employee → no delete/approve buttons visible anywhere
- [ ] Login as Manager → approve buttons visible where `can_approve = true`; no delete buttons
- [ ] Login as Admin → all buttons visible including delete
- [ ] Login as Client → minimal UI, only read + designated inputs
- [ ] Open DevTools Network → every data response has `_permissions` object
- [ ] `_permissions` matches what buttons are shown on screen
- [x] Admin permissions page shows matrix table (not ON/OFF toggles)
- [ ] Changing a permission in matrix → immediately reflected in UI for that role

---

## FINAL VERIFICATION — End-to-End

### Security
- [ ] No page accessible without auth (middleware confirmed)
- [ ] No API route returns data without valid token (middleware + `requireSubModuleAccess`)
- [ ] Security headers present on all responses
- [ ] Rate limiting blocks brute-force on auth endpoints
- [ ] Token expiry handled gracefully (auto-refresh or redirect to login)

### Data Isolation
- [ ] Employee A cannot see Employee B's expenses
- [ ] Employee A cannot see Employee B's leaves
- [ ] Manager sees only direct reports' data (not whole company)
- [ ] Admin sees everything
- [ ] Confirm by checking API responses directly (not just UI)

### Action Control
- [ ] Non-admin cannot DELETE anything via API (test with curl/Postman)
- [ ] Employee cannot APPROVE leaves via API
- [ ] Manager CAN approve their direct report's leave
- [ ] Per-user override grants work (grant employee `can_approve` on one module)
- [ ] Per-user override revokes work (revoke manager `can_edit` on one module)

### Audit Trail
- [ ] All Tier 1 events logged to `audit_logs`
- [ ] All Tier 2 CRUD events logged
- [ ] Each log has: userId, action, module, before/after values, timestamp

### `supabase-schema.sql`
- [ ] All 4 new tables present
- [ ] All FK relationships correct
- [ ] File can be run on a fresh DB to recreate full schema

---

## QUICK REFERENCE — New Files Checklist

| File | Phase | Status |
|------|-------|--------|
| `supabase/migrations/20260315000000_scope_levels.sql` | 0 | [x] |
| `supabase/migrations/20260315010000_role_module_permissions.sql` | 0 | [x] |
| `supabase/migrations/20260315020000_user_permission_overrides.sql` | 0 | [x] |
| `supabase/migrations/20260315030000_roles_scope_level.sql` | 0 | [x] |
| `src/middleware.ts` | 1 | [x] |
| `src/lib/supabase-server.ts` | 1 | [x] |
| `src/lib/rate-limit.ts` | 1 | [x] |
| `src/lib/data-scope.ts` | 2 | [x] |
| `src/lib/permissions.ts` | 2 | [x] |
| `src/app/api/user/permissions/route.ts` | 2 | [x] |
| `src/hooks/usePermissions.ts` | 4 | [x] |
| `src/components/PermissionGate.tsx` | 4 | [x] |

## QUICK REFERENCE — Modified Files Checklist

| File | Phase | Status |
|------|-------|--------|
| `supabase-schema.sql` | 0 | [x] |
| `src/types/index.ts` | 0+2 | [x] (Phase 2 done) |
| `next.config.ts` | 1 | [x] |
| `src/lib/api-auth.ts` | 1+2 | [x] (Phase 1 done) |
| `src/lib/api-fetch.ts` | 1 | [x] |
| `src/lib/auth.ts` | 1 | [x] |
| `src/components/AuthGuard.tsx` | 1 | [x] |
| `src/components/Shell.tsx` | 4 | [x] (scope level badge) |
| `src/app/m/admin/permissions/page.tsx` | 4 | [x] (permission matrix table) |
| 15 page.tsx files across HR/Finance/Tasks/Admin | 4 | [x] (PermissionGate wrappers) |
| 80+ API route files in `src/app/api/` | 3 | [x] (~75 routes updated) |
| 40+ frontend pages in `src/app/m/` | 4 | [x] (15 pages wrapped + remaining verified read-only) |
