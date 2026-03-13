# APEX OS — Production Upgrade Changelog (Phase 0–3)

> Completed: 2026-03-13
> TypeScript: 0 errors after all changes

---

## Phase 0 — Database Foundation

### What was done
Created 4 new database tables and modified 1 existing table to support the permission matrix and data scoping system.

### Migration files created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260315000000_scope_levels.sql` | `scope_levels` table with 4 seed rows |
| `supabase/migrations/20260315010000_role_module_permissions.sql` | `role_module_permissions` table + data migration from `role_modules` |
| `supabase/migrations/20260315020000_user_permission_overrides.sql` | `user_permission_overrides` table |
| `supabase/migrations/20260315030000_roles_scope_level.sql` | Added `scope_level_id` FK column to `roles` |

### New tables

**`scope_levels`** — Defines 4 data visibility tiers:
| slug | rank | data_visibility | can_delete |
|------|------|-----------------|------------|
| admin | 1 | all | true |
| manager | 2 | team | false |
| employee | 3 | self | false |
| client | 4 | self | false |

- RLS: all authenticated users can read; only admins can write
- `is_system = true` for all 4 default rows (prevents deletion)

**`role_module_permissions`** — Action-level permissions per role per module:
- Columns: `role_id`, `module_id`, `can_read`, `can_create`, `can_edit`, `can_approve`, `can_export`
- No `can_delete` column — delete is admin-only in code, never in the matrix
- Unique constraint on `(role_id, module_id)`
- Auto-migrated from `role_modules`: every existing row got `can_read = true`, all others `false`
- Verified: 297 rows migrated (matches `role_modules` count exactly)

**`user_permission_overrides`** — Per-user action-level overrides:
- Columns: `user_id`, `module_id`, `action` (read|create|edit|approve|export), `granted` (bool)
- Unique constraint on `(user_id, module_id, action)`
- User overrides always win over role-level permissions

**`roles` table update** — Added nullable `scope_level_id` FK to `scope_levels`:
- `null` means auto-detect scope from `hr_employees` hierarchy
- Set to a specific scope level ID to override auto-detection

### Schema file updated
- `supabase-schema.sql` now includes all 4 new tables, their indexes, RLS policies, and seed data
- Added `is_admin()` helper function definition
- File can recreate the full schema on a fresh DB

### TypeScript types added (`src/types/index.ts`)
- `ScopeLevel` — matches `scope_levels` table
- `DataScope` — runtime scope object with employee/team IDs
- `PermissionMatrix` — `{ canRead, canCreate, canEdit, canApprove, canExport, canDelete }`
- `RoleModulePermission` — matches `role_module_permissions` table
- `UserPermissionOverride` — matches `user_permission_overrides` table

---

## Phase 1 — Authentication Hardening

### What was done
Added server-side route protection (middleware), SSR-aware Supabase client, security headers, rate limiting on auth endpoints, token expiry handling, auth event logging, and reduced AuthGuard timeout.

### New files

**`src/middleware.ts`** — Next.js middleware for server-side route protection:
- Public routes: `/login`, `/auth/callback`, `/auth/reset-password`, `/api/auth/*`, `/api/public/*`
- Unauthenticated page requests → redirect to `/login?redirect=<path>`
- Unauthenticated API requests → `401 { error: "Unauthorized" }`
- Authenticated requests → refresh token if needed via `@supabase/ssr`, pass through
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, static assets

**`src/lib/supabase-server.ts`** — SSR-aware Supabase client:
- Uses `@supabase/ssr`'s `createServerClient` with Next.js `cookies()` API
- Handles cookie get/set/remove; setAll gracefully fails in read-only Server Components
- Replaces the ad-hoc `createClient` in `api-auth.ts` lines 37-51

**`src/lib/rate-limit.ts`** — In-memory sliding window rate limiter:
- Keyed by `IP:endpoint`
- Returns `{ allowed: boolean, retryAfter?: number }`
- Auto-cleanup of stale entries every 5 minutes
- Suitable for single-server; replace with Redis for multi-instance

**`src/app/api/auth/login/route.ts`** — Server-side login endpoint:
- Rate limited: 5 attempts per minute per IP
- Validates credentials via `supabaseAdmin.auth.signInWithPassword`
- Returns `{ access_token, refresh_token, expires_at, user }` to client
- Client-side `signIn()` now calls this instead of direct Supabase

**`src/app/api/auth/change-password/route.ts`** — Password change endpoint:
- Rate limited: 3 attempts per minute per IP
- Requires authentication
- Uses `supabaseAdmin.auth.admin.updateUserById`

### Modified files

**`next.config.ts`** — Added 6 security headers:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` — allows self, Supabase domain; blocks frame-ancestors
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**`src/lib/api-auth.ts`** — Replaced ad-hoc `createClient` with `@supabase/ssr`'s `createServerClient` for cookie-based auth in API routes.

**`src/lib/api-fetch.ts`** — Token expiry handling:
- Stores `tokenExpiresAt` alongside `cachedAccessToken` from `onAuthStateChange`
- Before each `apiFetch`: if token within 60s of expiry, calls `supabase.auth.getSession()` to refresh
- If refresh fails: redirects to `/login`

**`src/lib/auth.ts`** — Auth event logging:
- `signIn()` now calls `/api/auth/login` (rate-limited) instead of direct Supabase
- Sets session on client via `supabase.auth.setSession()`
- Tier 1 `logCritical` on: login success, login failure, sign-out, password reset request
- `logCritical("anonymous", ...)` for pre-auth events (maps to `user_id = null`)

**`src/lib/logger.ts`** — Supports `"anonymous"` userId for pre-auth events.

**`src/components/AuthGuard.tsx`** — Timeout reduced from 12s to 5s with comment: "Middleware is primary gate; this is fallback only"

**`src/app/api/auth/request-password-setup/route.ts`** — Added rate limiting (3/min per IP).

---

## Phase 2 — Data Scope Layer

### What was done
Built the centralized scope resolution and permission checking system that all API routes use. Created the permissions API endpoint for the frontend.

### New files

**`src/lib/data-scope.ts`** — Scope resolver + query helper:

`resolveDataScope(userId, roleId, isAdmin)` → `DataScope`:
1. Admin → scope level "admin" (data_visibility: all, can_delete: true)
2. No employee record → scope level "client" (self only)
3. Has direct reports (`hr_employees.reporting_to`) → scope level "manager" (team)
4. Otherwise → scope level "employee" (self only)
5. Role's `scope_level_id` can override auto-detected level

`scopeQuery(query, scope, column, useEmployeeIds?)`:
- `data_visibility = "all"` → returns query unchanged
- `data_visibility = "team"` → applies `.in(column, [ownId, ...teamIds])`
- `data_visibility = "self"` → applies `.eq(column, ownId)`
- `useEmployeeIds = true` → uses employee IDs instead of user IDs (for HR tables)

Includes fallback defaults if `scope_levels` table doesn't exist yet.

**`src/lib/permissions.ts`** — Permission matrix checker:

`getModulePermissions(userId, roleId, moduleSlug, isAdmin?)` → `PermissionMatrix`:
1. Admin → all true including canDelete
2. Looks up `role_module_permissions` for (roleId, moduleId)
3. Applies `user_permission_overrides` — user overrides win
4. `canDelete` is always false for non-admins (admin-only in code)

`requirePermission(matrix, action)` — throws 403-style error if denied.

**`src/app/api/user/permissions/route.ts`** — Frontend permissions endpoint:
- `GET /api/user/permissions?module=<parentSlug>`
- Returns `{ scopeLevel, dataVisibility, canDelete, actions: { [subModuleSlug]: PermissionMatrix } }`
- Fetches permissions for all sub-modules under the parent in parallel

### Modified files

**`src/lib/api-auth.ts`** — Major enhancement:
- New exports: `AuthResult` (interface), `AuthWithScope` (interface)
- `requireSubModuleAccess` now returns `{ auth, scope, permissions }` instead of just `{ auth }`
- Calls `resolveDataScope` and `getModulePermissions` in parallel via `Promise.all`
- Supports `{ skipScope: true }` option for routes that don't need scope resolution
- All existing routes continue to work (`.auth` is still available)

---

## Phase 3 — API Route Scoping

### What was done
Updated ~75 API route files across all modules to enforce data scoping, action-level permission checks, and include `_permissions` metadata in GET responses.

### Pattern applied to every route

```
auth → permission check → scope resolve → filtered query → _permissions in response
```

- **GET**: `scopeQuery(query, result.scope, "column")` filters data by scope level, `_permissions: result.permissions` added to response
- **POST**: `if (!result.permissions.canCreate) return 403`
- **PUT**: `if (!result.permissions.canEdit) return 403` (or `canApprove` for approval actions)
- **DELETE**: `if (!result.scope.scopeLevel.can_delete) return 403` (admin-only)

### Module-by-module breakdown

#### HR Module (15 routes)
| Route | Scope Column | useEmployeeIds | Notes |
|-------|-------------|----------------|-------|
| employees | `id` | true | Scopes the employee list itself |
| leaves | `employee_id` | true | Approve checks `canApprove` |
| salaries | `employee_id` | true | |
| salary-cycles | `employee_id` | true | |
| kpi-entries | `employee_id` | true | |
| kras | `employee_id` | true | |
| commission-rules | `employee_id` | true | |
| leave-balances | `employee_id` | true | |
| dashboard | `id` + `employee_id` | true | Scoped aggregation |
| kpis | — | — | Reference data, no scope |
| departments | — | — | Reference data |
| designations | — | — | Reference data |
| holidays | — | — | Global calendar |
| leave-types | — | — | Reference data |
| settings | — | — | Permission checks only |

#### Finance Module (4 routes)
| Route | Scope Column | Notes |
|-------|-------------|-------|
| expenses | `created_by` | Full CRUD scoping |
| budgets | — | Department-level, no user scope |
| categories | — | Reference data |
| summary | `created_by` | Uses `resolveDataScope` manually (requireModuleAccess route) |

#### Tasks Module (4 routes)
| Route | Scope Column | Notes |
|-------|-------------|-------|
| tasks | `assigned_to` | Enhanced existing tasks-my/team/board logic with team scoping |
| projects | `owner_id` | |
| comments | — | Scoped by task ownership |
| users | — | User list for assignment, no scope |

#### Sales Module (9 routes)
| Route | Scope Column | Notes |
|-------|-------------|-------|
| optin-tracking | `assigned_to` | |
| call-booked-tracking | `assigned_to` | |
| payment-done-tracking | `assigned_to` | |
| meeting-analysis-sheet | `created_by` | |
| maverick-meet/sales | — | No created_by column, permission checks only |
| jobin-meet/sales | — | No created_by column, permission checks only |
| onboarding-tracking | — | Permission checks only |

#### Payments Module (4 routes)
| Route | Scope Column | Notes |
|-------|-------------|-------|
| daily-collection | `created_by` | |
| failed-tracking | `created_by` | |
| invoice-follow-ups | `created_by` | |
| revenue-targets | — | Broader visibility, permission checks only |

#### Marketing/Content Module (4 routes)
All scoped on `created_by`: ads, social, sop-tracker, video-editing

#### SEO Module (~12 routes)
- Internal tables (keyword-tracker, content-briefs, competitor-tracker, task-log): scoped on `created_by`
- GBP routes: scoped where applicable
- External API routes (daily, page-health, quick-wins, etc.): `_permissions` only, no scoping

#### Meta Ads Module (~15 routes)
- Internal tables: campaign-tracker (`decided_by`), creative-tracker (`reviewed_by`), budget-plans (`created_by`), conversion-log (`created_by`)
- External API proxies: `_permissions` only, no scoping

#### Analytics Module (3 routes)
- cohort-metrics: `_permissions` added (read-only aggregate)
- cohort-sync: `canCreate` check
- daily-sheet: scoped on `created_by`

#### Chat Module
- Already scoped by channel membership — verified sufficient
- DELETE on messages: admin can now delete any message

#### Admin Module
- All routes already use `requireAdmin()` — verified
- Permissions route enhanced: GET returns `roleModulePermissions` + `scopeLevels`
- Permissions route: PUT handles `type: "permission_matrix"` for `role_module_permissions` upsert

#### Razorpay Module (7 routes)
All GET responses include `_permissions`. Mutations check `canCreate`/`can_delete`.

#### Automations Module (3 routes)
- send-invoice: `canCreate` check
- sent-invoices: scoped on `sent_by`
- templates: `_permissions` + permission checks

#### GHL Module (1 route modified)
- opportunities: `_permissions` on GET, `canEdit` on PUT

---

## Complete File Inventory

### New Files (Phase 0–3)
| File | Phase |
|------|-------|
| `supabase/migrations/20260315000000_scope_levels.sql` | 0 |
| `supabase/migrations/20260315010000_role_module_permissions.sql` | 0 |
| `supabase/migrations/20260315020000_user_permission_overrides.sql` | 0 |
| `supabase/migrations/20260315030000_roles_scope_level.sql` | 0 |
| `src/middleware.ts` | 1 |
| `src/lib/supabase-server.ts` | 1 |
| `src/lib/rate-limit.ts` | 1 |
| `src/app/api/auth/login/route.ts` | 1 |
| `src/app/api/auth/change-password/route.ts` | 1 |
| `src/lib/data-scope.ts` | 2 |
| `src/lib/permissions.ts` | 2 |
| `src/app/api/user/permissions/route.ts` | 2 |

### Modified Files (Phase 0–3)
| File | Phase | Changes |
|------|-------|---------|
| `supabase-schema.sql` | 0 | 4 new tables + is_admin() function + seed data |
| `src/types/index.ts` | 0+2 | 5 new interfaces |
| `next.config.ts` | 1 | 6 security headers |
| `src/lib/api-auth.ts` | 1+2 | SSR auth + scope/permissions return type |
| `src/lib/api-fetch.ts` | 1 | Token expiry handling |
| `src/lib/auth.ts` | 1 | Rate-limited login + audit logging |
| `src/lib/logger.ts` | 1 | Anonymous userId support |
| `src/components/AuthGuard.tsx` | 1 | 12s → 5s timeout |
| `src/app/api/auth/request-password-setup/route.ts` | 1 | Rate limiting |
| ~75 API route files in `src/app/api/` | 3 | Scope + permissions + _permissions |

---

## What's left for Phase 4

Phase 4 (Frontend Permission-Aware UI) is not yet implemented. It includes:
- `usePermissions` hook
- `PermissionGate` component
- Wrapping all create/edit/delete/approve/export buttons with `PermissionGate`
- Admin permissions page with permission matrix table
- Scope level indicator in user UI

## Manual testing needed
- Middleware redirect in incognito (no flash)
- API 401 without token
- Security headers in DevTools
- Rate limit on 6th login attempt
- Token auto-refresh after idle
- Scope filtering per role level (admin/manager/employee)
- Permission enforcement (403 on denied actions)
- `_permissions` in all GET responses
