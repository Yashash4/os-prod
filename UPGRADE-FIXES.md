# APEX OS — Production Upgrade: Issues & Remaining Work

Post-audit of Phase 0–3 implementation + Phase 4 completion spec. This document is the actionable task list for coding agents.

---

## Critical Issues (Must Fix)

### ISSUE-1: Middleware Does NOT Protect Page Routes

**File:** `src/middleware.ts`

**Problem:** Line 13 skips ALL non-API routes: `if (!pathname.startsWith("/api/")) return NextResponse.next()`. This means `/m/*` page routes have ZERO server-side auth protection. Anyone can load the page HTML — they'll see the shell briefly before `AuthGuard` (client-side, 5s timeout) kicks them to `/login`.

**What was planned:** Middleware should intercept `/m/*` and `/settings/*` page requests, check for a valid Supabase session via `@supabase/ssr`, and redirect to `/login?redirect=<path>` if unauthenticated. The existing `supabase-server.ts` was created specifically for this.

**Fix:**

```
1. For paths starting with /m/ or /settings/:
   - Use createServerClient from @supabase/ssr to read session cookies
   - Call supabase.auth.getUser() (NOT getSession — getUser validates with Supabase server)
   - If no valid user → redirect to /login?redirect=<encoded_pathname>
   - If valid user → call supabase.auth.getSession(), refresh token if needed, set updated cookies on response
2. Keep current API route logic (check for Bearer header, return 401 if missing)
3. Keep skipping: /login, /auth/*, /api/public/*, /api/auth/*, static assets
```

**Why it matters:** Without this, the client downloads full page HTML (including component code and potentially SSR'd data) before any auth check. This is the #1 security gap remaining.

---

### ISSUE-2: PUT/DELETE Routes Missing Scope Check on Target Row

**Affected routes:**

| Route | Method | Problem |
|-------|--------|---------|
| `finance/expenses` | PUT | Checks `canEdit` but doesn't verify the expense belongs to the user's scope. User can edit any expense by passing its ID. |
| `finance/expenses` | DELETE | Checks `can_delete` but doesn't verify expense is in scope. Admin-only so lower risk, but still wrong. |
| `finance/budgets` | PUT/DELETE | Same — no scope check on target row. |
| `payments/daily-collection` | PUT/DELETE | Same pattern. |
| `payments/failed-tracking` | PUT/DELETE | Same pattern. |
| `payments/invoice-follow-ups` | PUT/DELETE | Same pattern. |
| `payments/revenue-targets` | PUT/DELETE | Same pattern. |
| `marketing/content/ads` | PUT/DELETE | Same pattern. |
| `marketing/content/social` | PUT/DELETE | Same pattern. |
| `marketing/content/sop-tracker` | PUT/DELETE | Same pattern. |
| `marketing/content/video-editing` | PUT/DELETE | Same pattern. |
| `meta/budget-plans` | PUT/DELETE | Same pattern. |
| `meta/campaign-tracker` | PUT/DELETE | Same pattern. |
| `meta/conversion-log` | PUT/DELETE | Same pattern. |
| `meta/creative-tracker` | PUT/DELETE | Same pattern. |
| `seo/keyword-tracker` | PUT/DELETE | Same pattern. |
| `seo/content-briefs` | PUT/DELETE | Same pattern. |
| `seo/competitor-tracker` | PUT/DELETE | Same pattern. |
| `seo/task-log` | PUT/DELETE | Same pattern. |
| `sales/optin-tracking` | PUT/DELETE | Same pattern. |
| `sales/call-booked-tracking` | PUT/DELETE | Same pattern. |
| `sales/payment-done-tracking` | PUT/DELETE | Same pattern. |
| `sales/meeting-analysis-sheet` | PUT/DELETE | Same pattern. |
| `tasks/route` | PUT/DELETE | Same pattern. |
| `tasks/projects` | PUT/DELETE | Same pattern. |
| `analytics/daily-sheet` | PUT/DELETE | Same pattern. |
| `razorpay/amount-groups` | PUT/DELETE | Same pattern. |
| `razorpay/payment-links` | PUT/DELETE | Same pattern. |

**What HR employees route does correctly (reference pattern):**

```typescript
// PUT in hr/employees — CORRECT approach
const { data: targetEmp } = await supabaseAdmin
  .from("hr_employees")
  .select("id")
  .eq("id", id);
const scopedTarget = targetEmp?.filter((e) => {
  if (result.scope.scopeLevel.data_visibility === "all") return true;
  if (result.scope.scopeLevel.data_visibility === "team") {
    return e.id === result.scope.employeeId || result.scope.teamEmployeeIds.includes(e.id);
  }
  return e.id === result.scope.employeeId;
});
if (!scopedTarget || scopedTarget.length === 0) {
  return NextResponse.json({ error: "Not authorized" }, { status: 403 });
}
```

**Fix:** Create a reusable helper and apply it to all PUT/DELETE routes:

```
1. Add to data-scope.ts:

   async function verifyScopeAccess(
     scope: DataScope,
     table: string,
     id: string,
     column: string,         // the column to check (e.g. "created_by", "id", "assigned_to")
     useEmployeeIds?: boolean
   ): Promise<boolean>

   Logic:
   - data_visibility "all" → return true (admin sees everything)
   - Fetch the row from the table by ID
   - data_visibility "team" → check if row[column] is in [userId/employeeId, ...teamIds]
   - data_visibility "self" → check if row[column] === userId/employeeId

2. Apply to every PUT/DELETE handler that modifies a specific record by ID.
   Pattern:

   const allowed = await verifyScopeAccess(result.scope, "expenses", id, "created_by");
   if (!allowed) return NextResponse.json({ error: "Not authorized to modify this record" }, { status: 403 });
```

**Why it matters:** Without this, a user can guess/enumerate IDs and modify records that belong to other users, even though their GET response only shows their own data. The scope filter on GET creates a false sense of security.

---

### ISSUE-3: API Routes Missing Scope Imports Entirely (Data Leak)

**Severity:** CRITICAL — these routes return ALL data to ANY authenticated user with module access.

Of ~109 API route files, only 37 import from `data-scope` or `permissions`. Most of the remaining 72 fall into exempt categories (admin-only, auth, GHL/Razorpay/Meta API proxies, reference data). But the following routes handle user-owned data and have NO scope filtering at all:

**Sales routes — completely missed:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `sales/jobin-meet-tracking` | `jobin_meet_tracking` | `assigned_to` (user ID) |
| `sales/jobin-sales-tracking` | `jobin_sales_tracking` | `assigned_to` (user ID) |
| `sales/maverick-meet-tracking` | `maverick_meet_tracking` | `assigned_to` (user ID) |
| `sales/maverick-sales-tracking` | `maverick_sales_tracking` | `assigned_to` (user ID) |
| `sales/onboarding-tracking` | `onboarding_tracking` | `assigned_to` (user ID) |

**SEO routes — missed:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `seo/daily` | `seo_daily_tasks` | `assigned_to` (user ID) |
| `seo/gbp/keywords` | `seo_gbp_keywords` | `created_by` (user ID) |
| `seo/gbp/locations` | `seo_gbp_locations` | Read-all OK (reference), write: admin/manager |
| `seo/gbp/performance` | `seo_gbp_performance` | Read-all OK (analytics) |
| `seo/gbp/reviews` | `seo_gbp_reviews` | Read-all OK (analytics) |
| `seo/keyword-comparison` | N/A (computed) | Should inherit from `seo/keyword-tracker` scope |

**Finance/Payments routes — missed:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `finance/budgets` | `finance_budgets` | Read: all. Write: check `canCreate`/`canEdit`. Delete: admin-only |
| `finance/categories` | `finance_categories` | Reference data — read-all OK, write: admin-only |
| `payments/revenue-targets` | `revenue_targets` | Read: all (company-wide targets). Write: admin/manager |

**Analytics routes — missed:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `analytics/cohort-metrics` | `cohort_daily_metrics` | Read: all (aggregate analytics). Write: admin-only |
| `analytics/cohort-sync` | N/A (sync job) | Admin-only trigger |

**Notifications route:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `notifications` | `notifications` | `user_id` — MUST scope to current user only |

**Chat routes — need review:**

| Route | Table | Should scope by |
|-------|-------|----------------|
| `chat/channels` | `chat_channels` | Member-based (user must be channel member) |
| `chat/channels/members` | `chat_channel_members` | Channel membership check |
| `chat/messages` | `chat_messages` | Channel membership check |
| `chat/reactions` | `chat_reactions` | Channel membership check |

**Fix pattern:** Same as existing scoped routes:
```
1. Import { scopeQuery } from "@/lib/data-scope"
2. GET handler: apply scopeQuery(query, result.scope, "<column>")
3. POST: check result.permissions.canCreate
4. PUT: check result.permissions.canEdit + verifyScopeAccess (see ISSUE-2)
5. DELETE: check result.scope.scopeLevel.can_delete (admin-only)
6. Return _permissions in GET response
```

**Priority:** The 5 sales routes and `notifications` route are the most critical — they contain personal/sensitive data that is currently exposed to all users.

---

### ISSUE-4: Auth Event Logging Not Implemented

**File:** `src/lib/auth.ts`

**Problem:** The PRODUCTION-UPGRADE.md plan (Phase 1G) specified Tier 1 audit logging for: login success, login failure, password reset requests, logout. None of these are implemented. `auth.ts` has no calls to `logCritical` from `@/lib/logger.ts`.

**What exists:** The login API route (`src/app/api/auth/login/route.ts`) handles authentication server-side but doesn't log to `audit_logs`. The password reset route (`src/app/api/auth/request-password-setup/route.ts`) also doesn't log.

**Fix:** Add audit logging to these 3 API routes:

```
1. src/app/api/auth/login/route.ts:
   - On success: logCritical({ action: "auth.login.success", userId, email, ip: req.headers.get("x-forwarded-for") })
   - On failure: logCritical({ action: "auth.login.failure", email, ip, reason: "invalid_credentials" })

2. src/app/api/auth/change-password/route.ts:
   - On success: logCritical({ action: "auth.password.changed", userId })

3. src/app/api/auth/request-password-setup/route.ts:
   - On request: logCritical({ action: "auth.password.reset_requested", email })
```

**Why it matters:** Without auth event logging, there's no forensic trail for brute force attempts, account takeovers, or credential stuffing. This is a compliance and security operations gap.

---

### ISSUE-5: `marketing/content/ads` POST Doesn't Auto-Set `created_by`

**File:** `src/app/api/marketing/content/ads/route.ts`

**Problem:** The POST handler inserts `body` directly without setting `created_by: result.auth.userId`. This means:
1. The client must pass `created_by` in the request body (trusting the client = bad)
2. A malicious client could set `created_by` to another user's ID
3. The `scopeQuery` on GET filters by `created_by` — if it's wrong, records appear under the wrong user

**Compare to finance/expenses POST** which correctly does:
```typescript
const insertData = { ...body, created_by: result.auth.userId };
```

**Fix:** In every POST handler that inserts data with a `created_by` column, force-set it server-side:
```
const insertData = { ...body, created_by: result.auth.userId };
```

**Affected routes to check:** All routes that scope GET by `created_by`:
- `marketing/content/ads`
- `marketing/content/social`
- `marketing/content/video-editing`
- `marketing/content/sop-tracker`
- `meta/budget-plans`
- `meta/campaign-tracker`
- `meta/conversion-log`
- `meta/creative-tracker`
- `seo/keyword-tracker`
- `seo/content-briefs`
- `seo/competitor-tracker`
- `seo/task-log`

---

### ISSUE-6: Tasks DELETE Missing Audit Logging

**File:** `src/app/api/tasks/route.ts`

**Problem:** The DELETE handler (admin-only, correctly gated) deletes the task but doesn't log to `audit_logs`. All other routes with DELETE handlers log the deletion. This is an inconsistency.

**Fix:** Add Tier 2 audit log before/after delete:
```
1. Fetch the task before deletion (for "before" snapshot)
2. Delete the task
3. logImportant({ action: "task.deleted", table: "tasks", recordId: id, before: taskData })
```

---

### ISSUE-7: `usePermissions` Hook Returns `true` While Loading

**File:** `src/hooks/usePermissions.ts`

**Problem:** The `canDo()` method returns `true` while `loading` is true. This is permissive-by-default during the loading window. If someone uses `canDo()` directly (not via `<PermissionGate>`), buttons/actions will flash as enabled before permissions load.

**Note:** `<PermissionGate>` itself renders `null` while loading, so this doesn't affect PermissionGate usage. But any developer using the hook directly (e.g., `if (canDo("hr-leaves", "canDelete")) { ... }`) will have a vulnerability during the loading window.

**Fix:** Change `canDo()` to return `false` while loading (deny-by-default):
```
// BEFORE (line ~110):
if (loading) return true;

// AFTER:
if (loading) return false;
```

---

### ISSUE-8: Reference Data Routes Missing Consistent Audit Logging

**Affected routes:**

| Route | Has Audit Logging? |
|-------|-------------------|
| `hr/departments` | YES (POST, DELETE) |
| `hr/designations` | NO |
| `hr/holidays` | NO |
| `hr/kpis` | NO |
| `hr/leave-types` | NO |
| `hr/settings` | NO |

**Fix:** Add Tier 2 audit logging to POST/PUT/DELETE on all reference data routes. These are admin operations and should be tracked. Pattern:
```
import { logImportant } from "@/lib/logger";
// After successful write:
await logImportant({ action: "designation.created", userId: result.auth.userId, table: "hr_designations", recordId: data.id, after: data });
```

---

### ISSUE-9: Leaves Page Has Redundant Client-Side `canApprove` Logic

**File:** `src/app/m/hr/leaves/page.tsx`

**Problem:** Line 259 computes `canApprove` client-side:
```typescript
const canApprove = isAdmin || employees.some((e) => e.reporting_to === myEmployee?.id);
```

This duplicates what the server already handles (the API checks `result.permissions.canApprove` AND verifies the approver is the `reporting_to` manager). The client-side logic is used to show/hide the Actions column and approve/reject buttons alongside `<PermissionGate>`.

**Fix:**
- Remove the client-side `canApprove` derivation
- Use `usePermissions("hr")` hook to get `canDo("hr-leaves", "canApprove")` for showing/hiding the column header
- The `<PermissionGate>` already handles button visibility — the `canApprove` variable is redundant with it
- The server already enforces the actual manager check, so even if the button shows, a non-manager gets 403

---

## Phase 4 — Remaining Frontend Work

### 4A. Pages Missing `PermissionGate` (35+ pages)

Currently only 15 page files import `PermissionGate`. The following pages have action buttons (create/edit/delete/approve/export) that are NOT wrapped:

**Sales module** (none have PermissionGate):
- `sales/pipeline/settings/page.tsx`
- `sales/pipeline/onboarding/management/page.tsx`
- `sales/pipeline/meetings/maverick/meet-management/page.tsx`
- `sales/pipeline/meetings/maverick/sales-management/page.tsx`
- `sales/pipeline/meetings/jobin/meet-management/page.tsx`
- `sales/pipeline/meetings/jobin/sales-management/page.tsx`
- `sales/ghl/opportunities/page.tsx`

**Marketing module** (none have PermissionGate):
- `marketing/content/ads/page.tsx`
- `marketing/content/social/linkedin/page.tsx`
- `marketing/content/social/instagram/page.tsx`
- `marketing/content/social/youtube/page.tsx`
- `marketing/content/social/sop-tracker/page.tsx`
- `marketing/content/video-editing/page.tsx`
- `marketing/meta/campaign-tracker/page.tsx`
- `marketing/meta/creative-tracker/page.tsx`
- `marketing/meta/budget-planner/page.tsx`
- `marketing/meta/conversion-log/page.tsx`
- `marketing/seo/keyword-tracker/page.tsx`
- `marketing/seo/content-briefs/page.tsx`
- `marketing/seo/competitor-tracker/page.tsx`
- `marketing/seo/task-log/page.tsx`

**Payments module** (none have PermissionGate):
- `payments/collection-log/page.tsx`
- `payments/failed-payments/page.tsx`
- `payments/outstanding/page.tsx`
- `payments/send-links/page.tsx`
- `payments/invoices/page.tsx`

**Automations module** (none have PermissionGate):
- `automations/email/compose/page.tsx`
- `automations/email/templates/page.tsx`

**Analytics module** (none have PermissionGate):
- `analytics/daily-sheet/page.tsx`
- `analytics/cohort-tracker/page.tsx`

**Chat module:**
- `chat/page.tsx` — delete message button needs admin-only gate

**Pattern to follow** (from `finance/expenses/page.tsx`):

```tsx
import PermissionGate from "@/components/PermissionGate";

// Wrap create buttons:
<PermissionGate module="<parent>" subModule="<sub-slug>" action="canCreate">
  <button onClick={handleCreate}>Add Item</button>
</PermissionGate>

// Wrap delete buttons:
<PermissionGate module="<parent>" subModule="<sub-slug>" action="canDelete">
  <button onClick={handleDelete}><Trash2 /></button>
</PermissionGate>

// Wrap approve/status change controls:
<PermissionGate module="<parent>" subModule="<sub-slug>" action="canApprove">
  <select onChange={handleStatusChange}>...</select>
</PermissionGate>

// Wrap inline edit triggers (optional but recommended):
// Inline edits call PUT, which checks canEdit server-side.
// Wrapping them prevents the "click to edit" UI from appearing for users without edit permission.
```

**Module → subModule slug mapping for PermissionGate:**

| Parent module | Sub-module slug | Page |
|--------------|----------------|------|
| sales | pipeline | pipeline settings |
| sales | onboarding-management | onboarding management |
| sales | maverick-meet | meet management |
| sales | maverick-sales | sales management |
| sales | jobin-meet | meet management |
| sales | jobin-sales | sales management |
| sales | opportunities | GHL opportunities |
| marketing | content-ads | ad content |
| marketing | content-linkedin | LinkedIn content |
| marketing | content-instagram | Instagram content |
| marketing | content-youtube | YouTube content |
| marketing | content-sop-tracker | SOP tracker |
| marketing | content-video | video editing |
| marketing | meta-campaign-tracker | campaign tracker |
| marketing | meta-creative-tracker | creative tracker |
| marketing | meta-budget-planner | budget planner |
| marketing | meta-conversion-log | conversion log |
| marketing | seo-keyword-tracker | keyword tracker |
| marketing | seo-content-briefs | content briefs |
| marketing | seo-competitor-tracker | competitor tracker |
| marketing | seo-task-log | task log |
| payments | payments-collection-log | collection log |
| payments | payments-failed | failed payments |
| payments | payments-outstanding | outstanding |
| payments | payments-send-links | send links |
| payments | payments-invoices | invoices |
| automations | automations-email-compose | compose |
| automations | automations-email-templates | templates |
| analytics | analytics-daily-sheet | daily sheet |
| analytics | analytics-cohort | cohort tracker |
| chat | chat | chat (admin delete) |

### 4B. Inline Edit Fields Need Permission Awareness

Several pages have "click to edit" inline fields (e.g., `finance/expenses/page.tsx` has inline editing for title, amount, notes, date). These call PUT directly without checking if the user has `canEdit` permission.

**Problem:** The server blocks with 403, but the UI still shows the edit affordance (click cursor, input appears, then fails on save). Bad UX.

**Fix options (pick one per page):**

1. **Read `_permissions` from the API response** — the GET response already includes `_permissions: { canRead, canCreate, canEdit, canApprove, canExport, canDelete }`. Store it in component state and conditionally render edit affordances.

2. **Use `usePermissions` hook** — call `const { canDo } = usePermissions("finance")` and check `canDo("finance-expenses", "canEdit")` before showing edit UI.

Option 1 is preferred since it doesn't add another API call — the data is already there.

**Pattern:**

```tsx
// In component state:
const [permissions, setPermissions] = useState<PermissionMatrix | null>(null);

// In fetch:
const data = await res.json();
setExpenses(data.records || []);
setPermissions(data._permissions || null);

// In render — only show edit affordance if permitted:
<span
  className={`text-sm ${permissions?.canEdit ? "cursor-pointer" : ""}`}
  onClick={permissions?.canEdit ? () => startEdit(e.id, "title", e.title) : undefined}
>
  {e.title}
</span>
```

### 4C. Admin Permissions Page — Verify Matrix UI Works End-to-End

**File:** `src/app/m/admin/permissions/page.tsx`

The permissions page was rebuilt with 3 tabs: "access" (module on/off), "permissions" (matrix table), "users" (user overrides). Needs manual verification:

1. **Permissions tab:** Toggle `can_read/can_create/can_edit/can_approve/can_export` per role per module → verify it persists to `role_module_permissions` table
2. **Users tab:** Add per-user override (grant/revoke specific action) → verify it persists to `user_permission_overrides` table
3. **Scope levels:** Admin can assign a scope level to a role via the roles page → verify it writes `scope_level_id` on `roles` table
4. **Cache invalidation:** After changing permissions, call `invalidatePermissionsCache()` (already imported) → verify other pages reflect changes without refresh

---

## Minor Issues

### MINOR-1: `supabase-server.ts` Created But Not Used in Middleware

The SSR Supabase client (`src/lib/supabase-server.ts`) was created in Phase 1 specifically for middleware use, but the middleware doesn't import or use it. When fixing ISSUE-1, the middleware should use `createSupabaseServerClient` from this file (or a middleware-specific version using `NextRequest`/`NextResponse` cookies instead of `cookies()` from `next/headers`).

**Note:** `supabase-server.ts` currently uses `cookies()` from `next/headers`, which works in Server Components and Route Handlers but NOT in middleware. Middleware receives cookies via `req.cookies` / sets them on `NextResponse`. The middleware fix should either:
- Create a separate `createSupabaseMiddlewareClient(req)` function
- Or use `createServerClient` inline with `req.cookies.getAll()` / `res.cookies.set()`

### MINOR-2: Login Route Signs In Via Service Role

**File:** `src/app/api/auth/login/route.ts`

Line 28: `supabaseAdmin.auth.signInWithPassword(...)` — This uses the service role key to authenticate. It works, but `signInWithPassword` on a service role client returns a valid session. The session tokens are then passed to the client. This is acceptable for the rate limiting pattern, but worth noting:
- The service role key MUST stay secret (only used server-side) — already the case
- The returned tokens are standard Supabase JWT tokens, so client-side `setSession()` works fine

No action needed — just a note for awareness.

### MINOR-3: `requestPasswordReset` Function is Empty

**File:** `src/lib/auth.ts`, line 35-38

```typescript
export async function requestPasswordReset(email: string) {
  // Password reset is handled server-side; this is a placeholder
}
```

If this function is called anywhere, it does nothing. Either implement it (call `/api/auth/request-password-setup`) or remove it and update callers.

### MINOR-4: Expenses Page Status Dropdown Missing Non-Approve Fallback

**File:** `src/app/m/finance/expenses/page.tsx`, line 457-469

The status dropdown is entirely wrapped in `<PermissionGate action="canApprove">`. Users without approve permission see NO status at all — the cell is completely empty. It should show the status as read-only text when `canApprove` is false.

**Fix:**
```tsx
<td className="px-4 py-2 border-r border-border">
  <PermissionGate module="finance" subModule="finance-expenses" action="canApprove"
    fallback={<span className={`text-[11px] ...`}>{e.status}</span>}>
    <select ...>
      {STATUS_OPTIONS.map(...)}
    </select>
  </PermissionGate>
</td>
```

`PermissionGate` already supports a `fallback` prop — use it.

---

## Implementation Priority

### Tier 1 — Security Critical (do first)
1. **ISSUE-1** — Middleware page protection (unauthenticated users can load `/m/*` pages)
2. **ISSUE-2** — PUT/DELETE scope check on target row (users can modify others' records by ID)
3. **ISSUE-3** — 5 sales routes + notifications + SEO routes missing scope entirely (full data leak)
4. **ISSUE-5** — POST handlers not auto-setting `created_by` (client can impersonate)
5. **ISSUE-7** — `canDo()` returns true while loading (permissive default — 1-line fix)

### Tier 2 — Compliance & Audit Trail
6. **ISSUE-4** — Auth event logging (login/logout/password change not in audit_logs)
7. **ISSUE-6** — Tasks DELETE missing audit logging
8. **ISSUE-8** — Reference data routes missing audit logging

### Tier 3 — Frontend Completion (Phase 4)
9. **4A** — PermissionGate on remaining 35+ pages
10. **4B** — Inline edit permission awareness (read `_permissions` from API response)
11. **MINOR-4** — Expenses status dropdown missing fallback text

### Tier 4 — Cleanup
12. **ISSUE-9** — Leaves page redundant `canApprove` logic
13. **MINOR-1** — `supabase-server.ts` not used in middleware (will be fixed with ISSUE-1)
14. **MINOR-3** — Empty `requestPasswordReset` function

---

## What Was Done Correctly (Audit Passing)

For completeness — these items from the PRODUCTION-UPGRADE.md were implemented correctly:

| Item | Status | Notes |
|------|--------|-------|
| Phase 0: `scope_levels` table | PASS | 4 rows seeded (admin/manager/employee/client) |
| Phase 0: `role_module_permissions` table | PASS | Action matrix with migration from `role_modules` |
| Phase 0: `user_permission_overrides` table | PASS | Per-user action-level overrides |
| Phase 0: `roles.scope_level_id` column | PASS | FK to scope_levels, nullable |
| Phase 1A: Middleware (API protection) | PASS | Bearer token check on all `/api/*` except public/auth |
| Phase 1B: SSR Supabase client | PASS | `supabase-server.ts` uses `@supabase/ssr` correctly |
| Phase 1C: Extended `api-auth.ts` | PASS | `AuthWithScope`, `requireSubModuleAccess` returns scope+permissions |
| Phase 1D: Security headers | PASS | 6 headers in `next.config.ts` (HSTS, CSP, X-Frame-Options, etc.) |
| Phase 1E: Rate limiting | PASS | Sliding window, in-memory, configurable limits |
| Phase 1F: Token expiry handling | PASS | 60s proactive refresh in `api-fetch.ts` |
| Phase 1H: AuthGuard timeout | PASS | Reduced from 12s to 5s |
| Phase 2A: `data-scope.ts` | PASS | `resolveDataScope()` + `scopeQuery()` working correctly |
| Phase 2B: `permissions.ts` | PASS | Action matrix resolver with user overrides |
| Phase 2C: `/api/user/permissions` | PASS | Returns scope + actions per sub-module |
| Phase 2D: Types | PASS | `ScopeLevel`, `DataScope`, `PermissionMatrix` in `types/index.ts` |
| Phase 3: HR employees | PASS | Full scope + permission + write-scope-validation |
| Phase 3: HR leaves | PASS | Scope + approve checks manager via `reporting_to` |
| Phase 3: HR salaries | PASS | Scope + admin-only writes |
| Phase 3: Finance expenses | PASS | Scope by `created_by` (but PUT missing row check — ISSUE-2) |
| Phase 3: 37 routes total scoped | PARTIAL | 37/109 routes have scope imports |
| Phase 4: `usePermissions` hook | PASS | Caching, admin shortcut, cache invalidation |
| Phase 4: `PermissionGate` component | PASS | Hides while loading, supports fallback prop |
| Phase 4: 14 pages gated | PARTIAL | 14/50+ pages have PermissionGate |

---

## Verification Checklist

After all fixes:

**Auth & Middleware:**
- [ ] Open `/m/hr/employees` in incognito (no session) → server-side redirect to `/login` (no flash of content)
- [ ] Open `/m/hr/employees` with expired token → redirect to `/login?redirect=/m/hr/employees`
- [ ] Hit `GET /api/hr/employees` without Bearer token → 401
- [ ] Attempt 6 logins in 1 minute → rate limit triggers

**Data Scoping:**
- [ ] Login as employee → `GET /api/finance/expenses` returns only own expenses
- [ ] Login as employee → `GET /api/sales/jobin-meet-tracking` returns only own records (currently returns ALL)
- [ ] Login as employee → `GET /api/notifications` returns only own notifications
- [ ] Login as manager → sees team data on HR pages (leaves, KPIs, etc.)
- [ ] Login as admin → sees all data

**Write Protection:**
- [ ] Login as employee → `PUT /api/finance/expenses` with another user's expense ID → 403
- [ ] Login as employee → `DELETE /api/hr/employees/{id}` → 403 (not admin)
- [ ] Login as employee → `POST /api/marketing/content/ads` with `created_by: <other-user-id>` → server ignores it and uses actual userId

**Frontend Permissions:**
- [ ] Login as employee → delete button not visible on any page
- [ ] Login as employee → approve/reject buttons hidden on leaves page
- [ ] Login as manager → sees approve buttons for team leaves only
- [ ] Login as admin → all buttons visible everywhere
- [ ] Change a role's permissions in admin panel → pages reflect changes after cache invalidation

**Audit Trail:**
- [ ] Login attempt appears in `audit_logs` table
- [ ] Failed login attempt appears in `audit_logs` table
- [ ] Password change appears in `audit_logs` table
- [ ] Deleting a task appears in `audit_logs` table
- [ ] Creating/deleting a designation appears in `audit_logs` table

**Security Headers:**
- [ ] `X-Frame-Options: DENY` visible in browser DevTools
- [ ] `Content-Security-Policy` present
- [ ] `Strict-Transport-Security` present
