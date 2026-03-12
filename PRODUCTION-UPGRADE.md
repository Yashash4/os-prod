# APEX OS — Production Upgrade Plan

## Overview

APEX OS is an internal operating system for Apex Fashion Lab that consolidates 15-20+ SaaS tools into a single role-based platform. The current version is functional but lacks production-grade security, data isolation, and role-based flows. This document outlines the current gaps, the upgrade plan, and the target architecture.

---

## Table of Contents

1. [Current State (Before)](#1-current-state-before)
2. [Target State (After)](#2-target-state-after)
3. [Phase 0 — Database Foundation](#3-phase-0--database-foundation)
4. [Phase 1 — Authentication Hardening](#4-phase-1--authentication-hardening)
5. [Phase 2 — Data Scope Layer](#5-phase-2--data-scope-layer)
6. [Phase 3 — API Route Scoping](#6-phase-3--api-route-scoping)
7. [Phase 4 — Frontend Permission-Aware UI](#7-phase-4--frontend-permission-aware-ui)
8. [Verification & Testing](#8-verification--testing)
9. [File Inventory](#9-file-inventory)

---

## 1. Current State (Before)

### 1.1 What Works

- **Module visibility** — The admin panel assigns modules/sub-modules to roles. The home screen, sidebar, and catch-all router only display modules the user's role permits. This is enforced at UI level and API level via `requireModuleAccess()` / `requireSubModuleAccess()`.
- **Authentication** — Supabase Auth handles login, sessions, and password resets. API routes validate tokens via `authenticateRequest()`.
- **Audit logging** — A 3-tier logging system exists. Tier 1 (critical) and Tier 2 (important) events are logged to `audit_logs` with WHO, WHAT, WHERE, WHEN, BEFORE/AFTER.
- **Role-module mapping** — `roles`, `modules`, `role_modules` tables with admin UI to toggle access.
- **Manager hierarchy** — `hr_employees.reporting_to` field establishes who reports to whom. Leave approval already uses this to notify managers.

### 1.2 What's Broken

#### Authentication Gaps

| Gap | Risk | Detail |
|-----|------|--------|
| No Next.js middleware | HIGH | Route protection is client-side only. Pages download fully before checking auth. A 12-second timeout in `AuthGuard` is the only fallback. |
| No SSR Supabase client | MEDIUM | The app uses a plain browser `createClient` instead of `@supabase/ssr`. The API auth handler creates a new Supabase client on every cookie-based request (inefficient and fragile). |
| No security headers | HIGH | `next.config.ts` is empty. No clickjacking protection (`X-Frame-Options`), no MIME sniffing protection, no HTTPS enforcement (`Strict-Transport-Security`), no Content Security Policy. |
| No rate limiting | HIGH | Zero brute-force protection on login or password reset endpoints. An attacker could attempt unlimited passwords. |
| No token expiry handling | MEDIUM | The client caches the auth token in memory (`api-fetch.ts`) but never checks if it has expired. Expired tokens cause silent 401 failures. |
| No auth event logging | MEDIUM | Login attempts, failed logins, and password resets are not recorded in audit logs. No forensic trail for security incidents. |

#### Data Isolation Gaps

| Gap | Risk | Detail |
|-----|------|--------|
| Every API returns ALL data | CRITICAL | All routes use `supabaseAdmin` (service role key, bypasses RLS) and query without any user/role filter. A user with HR module access sees every employee's data in the company. |
| No data scoping by role | CRITICAL | There's no concept of "my data" vs "my team's data" vs "all data." Admin, Manager, and regular User all see the same dataset inside a module. |
| No action-level permissions | HIGH | Anyone with module access can create, edit, delete, and approve anything. A regular employee can delete another employee's expense or approve their own leave. |
| Missing `user_module_overrides` table | HIGH | The codebase references this table for per-user permission grants/revokes, but the table doesn't exist in the database. The feature silently fails. |
| Permissions are ON/OFF only | HIGH | The admin panel only toggles module visibility (can see / can't see). There's no granular control over WHAT a user can DO inside a module (read, create, edit, approve). |

#### Frontend Gaps

| Gap | Risk | Detail |
|-----|------|--------|
| All action buttons visible | MEDIUM | Delete, edit, approve buttons render for every user regardless of their role or permissions. Clicking them returns a 403 from the API, but the UX is broken. |
| Client-side permission hacks | LOW | Some pages (e.g., HR Leaves) have ad-hoc permission logic on the client side. These are inconsistent, unreliable, and not derived from the actual permission system. |

### 1.3 Current Architecture Diagram

```
┌────────────────────────────────────────────────┐
│                   BROWSER                       │
│                                                 │
│   AuthGuard (client-side, 12s timeout)         │
│       ↓                                         │
│   Page renders → fetches data from API          │
│       ↓                                         │
│   ALL buttons visible (delete, approve, etc.)   │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│              API ROUTES (109)                   │
│                                                 │
│   1. authenticateRequest() → verify JWT    ✅   │
│   2. requireModuleAccess() → check role    ✅   │
│   3. supabaseAdmin.from("table").select("*")   │
│      ↑ NO user/role filter               ❌   │
│   4. Return ALL data                      ❌   │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│               SUPABASE                          │
│   supabaseAdmin bypasses RLS entirely      ❌   │
└────────────────────────────────────────────────┘
```

---

## 2. Target State (After)

### 2.1 Four Scope Levels

Every user in APEX OS operates at one of four scope levels. These levels control WHAT DATA they see and WHAT ACTIONS they can perform.

**Level 1 — Admin**
- CTO, CXO, or any user whose role has `is_admin = true`
- Sees all modules, all data, across the entire organization
- Can perform all actions: read, create, edit, delete, approve, export
- Delete is EXCLUSIVELY an admin action — no other level can delete anything
- Manages roles, permissions, people, and system settings
- Creates accounts for all other users (email + password)

**Level 2 — Manager**
- Any user who has direct reports (detected via `reporting_to` in `hr_employees`)
- Sees only modules/sub-modules assigned to their role
- Sees their own data + their direct reports' data
- Actions controlled by the permission matrix (read/create/edit/approve/export per sub-module)
- Typical: can approve team requests, create records, edit team data
- Cannot delete anything. Cannot manage roles or system settings.

**Level 3 — Employee**
- Internal staff with no direct reports (Sales reps, Interns, Designers, etc.)
- Sees only modules/sub-modules assigned to their role
- Sees ONLY their own data
- Actions controlled by the permission matrix — typically: read + create + edit on permitted modules
- Cannot approve, cannot delete, cannot export (unless explicitly granted)
- Can submit requests (apply for leave, submit expenses, log tasks)

**Level 4 — User (External / Client)**
- External users (clients, vendors, partners) who need limited access
- Admin creates their account and assigns a role with minimal permissions
- Sees only what their role permits — typically a few specific sub-modules
- Primarily read-only, but can contribute data in designated areas (e.g., fill a feedback form, add comments in a specific column, upload documents)
- Writable areas are built as dedicated "user-input" sections within modules, separate from internal data
- Cannot approve, delete, or export anything

### 2.2 Scope Level Detection

Scope is automatically determined when a user authenticates:

```
User logs in
    ↓
Is their role is_admin = true?
    → Yes: Level 1 (Admin)
    ↓
Do they have an hr_employees record?
    → No: Level 4 (User/Client) — external, no employee record
    ↓
Does anyone's reporting_to point to them?
    → Yes: Level 2 (Manager)
    → No:  Level 3 (Employee)
```

This is automatic — no manual "scope assignment" needed. The scope is derived from existing data (admin flag, employee record, reporting hierarchy).

### 2.3 Permission Matrix

The core of the new permission system. Replaces the simple ON/OFF module toggles with granular action-level control.

**How it works:** Admin selects a role in the admin panel and sees a table:

```
Role: [Sales ▼]

                      Read   Create   Edit   Approve   Export
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HR > Employees         ☑      ☐        ☐       ☐         ☐
HR > Leaves            ☑      ☑        ☑       ☐         ☐
HR > Salaries          ☐      ☐        ☐       ☐         ☐
Finance > Expenses     ☑      ☑        ☑       ☐         ☐
Tasks > My Tasks       ☑      ☑        ☑       ☐         ☐
Tasks > Board          ☐      ☐        ☐       ☐         ☐
```

**Key rules:**
- **Delete is not in the matrix.** Delete is always admin-only. No role can be granted delete permission.
- **Per-role defaults.** When admin enables a sub-module, they configure exactly what actions that role can perform.
- **Per-user overrides.** Admin can override individual users: "This specific user gets approve on hr-leaves even though their role doesn't." Works like the existing module override system, but for actions.
- **Dynamic scope levels.** Admin can create custom scope levels (e.g., "Team Lead", "Department Head") with custom data visibility rules. The system is not limited to 4 hardcoded levels — it's extensible.

### 2.4 Access Control — Full Example

```
Admin creates role "Sales Rep" with these permissions:
  HR > Leaves:         read ✓, create ✓, edit ✓
  Tasks > My Tasks:    read ✓, create ✓, edit ✓
  Finance > Expenses:  read ✓, create ✓

A Sales Rep employee logs in:
  → Home screen: shows only HR, Tasks, Finance (parent modules of permitted sub-modules)
  → Sidebar: shows only Leaves, My Tasks, Expenses
  → Direct URL to /m/hr/employees: blocked — not in their permissions
  → HR Leaves page:
      - Sees ONLY their own leave requests
      - "Apply for Leave" button visible (create ✓)
      - Can edit their pending requests (edit ✓)
      - NO approve/reject buttons (approve ✗)
      - NO delete button (admin-only)
  → Tasks page:
      - Sees ONLY tasks assigned to them
      - Can create new tasks, edit their tasks
  → Expenses page:
      - Sees ONLY expenses they created
      - Can submit new expenses (create ✓)
      - NO edit button (edit ✗ for this module)
      - NO delete button (admin-only)
  → Everything else: invisible, inaccessible, doesn't exist for them
```

### 2.5 Target Architecture Diagram

```
┌────────────────────────────────────────────────┐
│                   BROWSER                       │
│                                                 │
│   Middleware (server-side, before page loads)   │
│       ↓                                         │
│   Page renders → fetches scoped data from API   │
│       ↓                                         │
│   PermissionGate hides unauthorized buttons     │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│              API ROUTES (109)                   │
│                                                 │
│   1. authenticateRequest() → verify JWT    ✅   │
│   2. requireModuleAccess() → check role    ✅   │
│   3. resolveDataScope() → scope level      ✅   │
│   4. checkPermission() → read/create/etc   ✅   │
│   5. scopeQuery() → filter by ownership    ✅   │
│   6. Return scoped data + _permissions     ✅   │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│               SUPABASE                          │
│   Queries filtered before execution        ✅   │
│   RLS as secondary safety net              ✅   │
└────────────────────────────────────────────────┘
```

---

## 3. Phase 0 — Database Foundation

### Why

The permission system needs three database changes: a missing table that's already referenced in code, a new permission matrix table, and a scope levels table for dynamic scope management.

### 3.1 Create `user_module_overrides` Table

The application code already queries this table in multiple files (`rbac.ts`, `api-auth.ts`, admin permissions page) to support per-user permission grants and revokes. Without this table, the feature silently fails and all override logic is dead code.

**What it does:** Allows an admin to give a specific user access to a module their role doesn't normally include, or revoke access to a module their role normally has. This is the "exception" layer on top of role-based access.

**Structure:**
- `user_id` — The user getting the override
- `module_id` — The module being granted or revoked
- `access_type` — Either `grant` (add access) or `revoke` (remove access)
- `granted_by` — Which admin made this override
- Unique constraint on `(user_id, module_id)` — one override per user per module

**RLS Policies:**
- Admins can read/write all overrides
- Users can read their own overrides (needed for the client to fetch effective modules)

### 3.2 Create `scope_levels` Table

This table defines the available scope levels in the system. Instead of hardcoding "admin/manager/employee/user", scope levels are dynamic and admin-configurable.

**What it does:** Stores all scope levels with their hierarchy rank and data visibility rules. Admin can create new levels like "Team Lead", "Department Head", "Intern" with custom data visibility.

**Structure:**
- `id` — UUID primary key
- `name` — Display name (e.g., "Admin", "Manager", "Employee", "Client")
- `slug` — URL-safe identifier (e.g., `admin`, `manager`, `employee`, `client`)
- `rank` — Numeric hierarchy (1 = highest/admin, higher numbers = less access). Used to compare "does this user's level outrank the required level?"
- `data_visibility` — What data this level can see: `all`, `team`, `self`
  - `all` — Sees all records (admin level)
  - `team` — Sees own + direct reports' records (manager level)
  - `self` — Sees only own records (employee/client level)
- `can_delete` — Boolean. Only `true` for admin-level scopes. Delete is reserved for admins.
- `is_system` — Boolean. System-level scopes (admin, manager, employee, client) can't be deleted, only custom ones can.
- `description` — Optional description for the admin panel
- `created_at` — Timestamp

**Default seed data (4 system levels):**

| Name | Slug | Rank | Data Visibility | Can Delete |
|------|------|------|----------------|------------|
| Admin | admin | 1 | all | true |
| Manager | manager | 2 | team | false |
| Employee | employee | 3 | self | false |
| Client | client | 4 | self | false |

Admin can later add custom levels like:

| Name | Slug | Rank | Data Visibility | Can Delete |
|------|------|------|----------------|------------|
| Team Lead | team-lead | 2 | team | false |
| Department Head | dept-head | 2 | team | false |
| Intern | intern | 4 | self | false |

The `rank` field determines the hierarchy. Two levels can share the same rank (e.g., Team Lead and Manager both rank 2). The `data_visibility` field determines what records they see.

### 3.3 Create `role_module_permissions` Table (The Permission Matrix)

This is the core of the new permission system. It replaces the simple ON/OFF `role_modules` toggle with granular, per-action permissions.

**What it does:** For each combination of role + sub-module, defines exactly which actions are allowed. This is what the admin configures in the permission matrix UI.

**Structure:**
- `id` — UUID primary key
- `role_id` — FK to `roles` table
- `module_id` — FK to `modules` table (the sub-module)
- `can_read` — Boolean (can view data in this sub-module)
- `can_create` — Boolean (can create new records)
- `can_edit` — Boolean (can modify existing records)
- `can_approve` — Boolean (can approve/reject requests)
- `can_export` — Boolean (can export/download data)
- `created_at` — Timestamp
- `updated_at` — Timestamp
- Unique constraint on `(role_id, module_id)` — one permission set per role per module

**Key rule: No `can_delete` column.** Delete is always admin-only, enforced in code. It's not configurable.

**How it replaces `role_modules`:** The existing `role_modules` table is a simple mapping (role has access to module: yes/no). The new `role_module_permissions` table replaces this entirely — if a row exists with `can_read = true`, the role can see the module. If no row exists, the role has no access. The `role_modules` table becomes obsolete.

**Example data:**

| Role | Module | Read | Create | Edit | Approve | Export |
|------|--------|------|--------|------|---------|--------|
| Sales | hr-leaves | ✓ | ✓ | ✓ | ✗ | ✗ |
| Sales | tasks-my | ✓ | ✓ | ✓ | ✗ | ✗ |
| Sales | finance-expenses | ✓ | ✓ | ✗ | ✗ | ✗ |
| HR Manager | hr-leaves | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR Manager | hr-employees | ✓ | ✓ | ✓ | ✗ | ✓ |
| HR Manager | hr-salaries | ✓ | ✗ | ✗ | ✗ | ✗ |

### 3.4 Create `user_permission_overrides` Table

Per-user action-level overrides, same concept as `user_module_overrides` but for the permission matrix.

**What it does:** Admin can override a specific user's permissions beyond what their role grants. Example: "Give John approve access on hr-leaves even though the Sales role doesn't have it."

**Structure:**
- `user_id` — The user getting the override
- `module_id` — The sub-module
- `action` — Which action: `read`, `create`, `edit`, `approve`, `export`
- `granted` — Boolean (true = grant this action, false = revoke it)
- `granted_by` — Which admin made this override
- `created_at` — Timestamp
- Unique constraint on `(user_id, module_id, action)` — one override per user per module per action

### 3.5 Update Schema File

Add all table definitions to `supabase-schema.sql` so the schema file remains the single source of truth for the database structure. Migrate data from the existing `role_modules` table to `role_module_permissions` (with `can_read = true` for all existing mappings, other actions default to `false`).

---

## 4. Phase 1 — Authentication Hardening

### Why

The current auth system relies on client-side JavaScript to protect routes. This means every page downloads completely before checking if the user is logged in. There's no brute-force protection, no security headers, and expired tokens cause silent failures. This phase makes auth production-grade.

### 4.1 Next.js Middleware

**What it does:** A server-side gate that runs BEFORE any page renders or API responds. This is the single most important auth change.

**How it works:**

```
Request comes in
    ↓
Middleware intercepts (runs on server, at the edge)
    ↓
Is this a public route? (/login, /auth/*, /api/public/*, static assets)
    → Yes: let it through
    → No: check for valid Supabase session cookie
        → Valid session: let it through, refresh cookie if needed
        → No session + page request: redirect to /login
        → No session + API request: return 401 JSON
```

**What changes for the user:**
- Before: Page loads → spinner for up to 12 seconds → redirect to login
- After: Instant redirect to login. The page never even starts loading.

**Technical approach:** Uses `@supabase/ssr` package (already installed, currently unused) to create a server client that properly reads and writes session cookies. The middleware also handles token refresh — if the access token is expired but the refresh token is valid, it refreshes the session transparently.

### 4.2 SSR-Aware Supabase Client

**What it does:** Replaces the ad-hoc Supabase client creation in the API auth layer.

**The problem:** Currently, `api-auth.ts` (line 38) dynamically imports `@supabase/supabase-js` and creates a new client on every single request that uses cookie-based auth. This is:
- Wasteful (new client = new connection overhead per request)
- Fragile (doesn't use the `@supabase/ssr` package designed for this exact use case)
- Inconsistent with how the middleware handles sessions

**The fix:** A dedicated server-side Supabase client utility that:
- Uses `@supabase/ssr`'s `createServerClient` for proper cookie handling
- Is imported by both the middleware and the API auth layer
- Handles token refresh consistently

### 4.3 Security Headers

**What it does:** Tells browsers how to behave securely when loading APEX OS.

**Headers being added:**

| Header | Purpose |
|--------|---------|
| `X-Frame-Options: DENY` | Prevents APEX OS from being embedded in an iframe (blocks clickjacking attacks) |
| `X-Content-Type-Options: nosniff` | Prevents browsers from guessing file types (blocks MIME-based attacks) |
| `Strict-Transport-Security` | Forces HTTPS for all connections (prevents man-in-the-middle attacks) |
| `Content-Security-Policy` | Restricts what scripts, styles, and connections are allowed (blocks XSS attacks) |
| `Referrer-Policy` | Controls what URL info is shared when navigating away (prevents data leakage) |
| `Permissions-Policy` | Disables unnecessary browser features like camera/microphone access |

### 4.4 Rate Limiting

**What it does:** Prevents brute-force attacks on authentication endpoints.

**How it works:** An in-memory sliding window counter tracks requests per IP address. Each endpoint has configurable limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 1 minute |
| Password reset request | 3 requests | 1 minute |
| Password change | 3 attempts | 1 minute |

When the limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header.

**Scope:** In-memory rate limiting is sufficient for a single-instance deployment (Vercel serverless functions reset memory between invocations, but rapid successive calls from the same IP within a function's lifecycle are still caught). For higher traffic, this can be upgraded to Redis-based rate limiting later.

### 4.5 Token Expiry Handling

**What it does:** Prevents silent auth failures when a user's session token expires.

**The problem:** `api-fetch.ts` caches the Supabase access token in a module-level variable. It relies on `onAuthStateChange` to update this token when Supabase refreshes it. But if the refresh event doesn't fire (network issue, background tab throttling), the cached token becomes stale. Every subsequent API call fails with 401, and the user has no idea why.

**The fix:**
- Store the token's `expires_at` timestamp alongside the token
- Before each API call, check: is this token within 60 seconds of expiry?
- If yes, proactively call `supabase.auth.getSession()` to force a refresh
- If refresh fails, redirect to login

### 4.6 Auth Event Logging

**What it does:** Records all authentication events in the existing audit log system.

**Events logged (Tier 1 — Critical):**

| Event | What's Recorded |
|-------|----------------|
| Login success | User ID, email, IP, timestamp |
| Login failure | Email attempted, IP, timestamp, error reason |
| Password reset request | Email requested, IP, timestamp |
| Password changed | User ID, timestamp |
| Session expired | User ID, timestamp |

These logs feed into the existing `audit_logs` table using the Tier 1 (Critical) classification, consistent with other security-relevant events like role changes and data deletion.

### 4.7 AuthGuard Adjustment

**What it does:** Reduces the client-side auth guard timeout from 12 seconds to 5 seconds.

**Why:** With middleware now handling the primary redirect (server-side, instant), the `AuthGuard` component becomes a secondary safety net. The 12-second timeout was a workaround for slow client-side auth checks. With middleware in place, if the AuthGuard is still loading after 5 seconds, something is genuinely wrong, and the user should be redirected to login rather than left staring at a spinner.

---

## 5. Phase 2 — Data Scope Layer

### Why

This is the core abstraction that makes the entire system work. Every API route needs to answer two questions: "What data should this user see?" and "What actions can this user perform?" Instead of repeating this logic in 80+ routes, centralized helpers resolve it once.

### 5.1 The Scope Resolver

**What it does:** Takes an authenticated user and returns their scope level, team information, and data visibility.

**Resolution flow:**

```
Authenticated user comes in
    ↓
Is their role marked is_admin = true?
    → Yes: scope level = admin (data_visibility = all, can_delete = true)
    ↓
Do they have an hr_employees record?
    → No: scope level = client (external user, data_visibility = self)
    ↓
Does anyone's reporting_to point to them?
    → Yes: scope level = manager (data_visibility = team)
       Collect all direct report employee IDs + their auth user IDs
    → No: scope level = employee (data_visibility = self)
```

**Output:**

| Field | Description |
|-------|-------------|
| `scopeLevel` | The resolved scope level object from `scope_levels` table (includes slug, rank, data_visibility, can_delete) |
| `userId` | The authenticated user's Supabase auth ID |
| `employeeId` | Their `hr_employees` record ID (null if external user/client) |
| `teamEmployeeIds` | Array of employee IDs that report to them (empty if not manager/admin) |
| `teamUserIds` | Array of auth user IDs for those direct reports |
| `departmentId` | Their department ID from `hr_employees` (null if not set) |

### 5.2 The Query Filter

**What it does:** Takes any Supabase query and applies the appropriate WHERE clause based on the scope level's `data_visibility` setting.

**How it filters:**

| data_visibility | Filter Applied |
|----------------|---------------|
| `all` | No filter — full access to all records (admin) |
| `team` | `WHERE column IN (own_id, ...team_ids)` — own data + direct reports' data |
| `self` | `WHERE column = own_id` — only own data |

The "column" depends on the table being queried:
- For expenses: filter on `created_by` (who created this expense)
- For leave requests: filter on `employee_id` (whose leave is this)
- For tasks: filter on `assigned_to` (who is this task assigned to)
- For employees: filter on `id` itself (which employee records can they see)

Each API route specifies which column to filter on. The filter helper handles the rest.

### 5.3 Action Permission Checker

**What it does:** Determines if a user can perform a specific action on a specific sub-module.

**How it works:**

```
User wants to CREATE an expense
    ↓
Look up role_module_permissions where role_id = user's role AND module_id = finance-expenses
    → can_create = true → ALLOWED
    ↓
Check user_permission_overrides for any per-user exceptions
    → Override found with granted = false → DENIED (override wins)
    → No override → use role permission

User wants to DELETE an expense
    ↓
Check scope level's can_delete flag
    → can_delete = false → DENIED (403)
    → Delete is admin-only, always.
```

**The flow for every action check:**

1. **Delete?** Check `scope_level.can_delete`. If false, instant 403. Delete is never in the permission matrix.
2. **Other actions?** Look up `role_module_permissions` for the user's role + sub-module. Get the `can_read`, `can_create`, `can_edit`, `can_approve`, `can_export` booleans.
3. **User overrides?** Check `user_permission_overrides` for this specific user. Overrides win over role permissions (both grant and revoke).
4. **Final answer:** Allowed or denied.

### 5.4 Permissions API Endpoint

**What it does:** A single API endpoint that the frontend calls to know what the current user can see and do.

**Request:** `GET /api/user/permissions?module=hr`

**Response:**
```json
{
  "scopeLevel": "manager",
  "dataVisibility": "team",
  "canDelete": false,
  "actions": {
    "hr-employees": {
      "read": true,
      "create": true,
      "edit": true,
      "approve": false,
      "export": true
    },
    "hr-leaves": {
      "read": true,
      "create": true,
      "edit": true,
      "approve": true,
      "export": false
    },
    "hr-salaries": {
      "read": true,
      "create": false,
      "edit": false,
      "approve": false,
      "export": false
    }
  }
}
```

This tells the frontend exactly which buttons to show. The frontend doesn't guess or compute permissions — it receives them from the server.

### 5.5 Scope Level Detection — How It Works

The scope level is automatically derived from existing data. No manual assignment needed.

**Detection rules:**

| Condition | Detected Level | Data Visibility |
|-----------|---------------|-----------------|
| Role has `is_admin = true` | Admin | all |
| No `hr_employees` record linked to this user | Client | self |
| Has employee record, someone's `reporting_to` points to them | Manager | team |
| Has employee record, no one reports to them | Employee | self |

**For custom scope levels** (e.g., "Team Lead", "Department Head"): Admin can assign a custom scope level to a role via the `roles` table (add a `scope_level_id` FK). If a role has a custom scope level assigned, that takes priority over the auto-detection. This allows:
- A "Team Lead" role that sees team data even before anyone formally reports to them
- A "Department Head" that has `data_visibility = team` with a broader team definition
- An "Intern" role that has `data_visibility = self` regardless of hierarchy

**Example hierarchy:**

```
Employee A (Sales Rep)     → reporting_to: Employee C
Employee B (Sales Rep)     → reporting_to: Employee C
Employee C (Sales Lead)    → reporting_to: Employee D
Employee D (Sales Head)    → reporting_to: null (reports to CTO)
```

| Person | Auto-Detected Level | What They See |
|--------|-------------------|---------------|
| Employee A | Employee | Only their own data |
| Employee B | Employee | Only their own data |
| Employee C | Manager | Own + A's + B's data |
| Employee D | Manager | Own + C's data (direct reports only) |
| CTO | Admin | Everything |

Employee C can see data for A, B, and themselves.
Employee D can see data for C and themselves (direct reports only, not the full chain down to A and B).

---

## 6. Phase 3 — API Route Scoping

### Why

This is where the actual data isolation happens. Every API route that returns data needs to filter it based on the caller's scope. Every route that modifies data needs to verify the caller has permission for that action.

### 6.1 The Universal Pattern

Every API route follows the same transformation:

**Before (current):**
```
1. Check auth (token valid?)                          ✅ exists
2. Check module access (role permits this?)           ✅ exists
3. Query database (SELECT * — no filter)              ❌ no scoping
4. Return all data                                    ❌ leaks data
```

**After (target):**
```
1. Check auth (token valid?)                          ✅ exists
2. Check permissions (can_read for this sub-module?)  ✅ NEW (replaces module toggle)
3. Resolve data scope (what's their data_visibility?) ✅ NEW
4. Apply scope filter to query                        ✅ NEW
5. For writes: check can_create/can_edit/can_approve  ✅ NEW
6. For delete: check scope_level.can_delete           ✅ NEW (admin-only)
7. Return scoped data + _permissions metadata         ✅ NEW
```

### 6.2 Module-by-Module Breakdown

#### HR Module (Highest Complexity)

HR is the most complex because it has the manager hierarchy and sensitive data (salaries, KPIs).

**Employees**
- Data visibility `all`: sees all employees
- Data visibility `team`: sees own employee record + direct reports
- Data visibility `self`: sees only own employee record
- Create/Edit: controlled by permission matrix (`can_create`, `can_edit` per role)
- Delete: admin-only (always)

**Leaves**
- Data visibility `all`: sees all leave requests
- Data visibility `team`: sees own leaves + direct reports' leaves
- Data visibility `self`: sees only own leave requests
- Create (apply for leave): controlled by `can_create` in permission matrix
- Approve: controlled by `can_approve` in permission matrix. Additionally, the approver must be the `reporting_to` manager of the employee requesting leave, OR an admin. Having `can_approve` alone is not enough — the business rule of "only your manager approves your leave" is enforced on top of the permission check.
- Delete: admin-only (always)

**Salaries & Payroll**
- Data visibility `all`: sees all salary records
- Data visibility `team`: sees direct reports' salary info
- Data visibility `self`: sees only own salary
- Create/Edit: controlled by permission matrix (typically admin-only for salaries)
- Delete: admin-only (always)

**KPIs & KRAs**
- Data visibility follows standard rules
- `self_rating` field: editable by the employee themselves (if they have `can_edit`)
- `manager_rating` field: editable only by the employee's `reporting_to` manager (if they have `can_edit` + are the reporting manager)
- Delete: admin-only (always)

**Reference Data (Departments, Designations, Holidays, Leave Types, Settings)**
- Read: available to everyone with HR module access (shared reference data)
- Create/Edit: controlled by permission matrix (typically admin-only)
- Delete: admin-only (always)

#### Finance Module (Medium Complexity)

**Expenses**
- Data visibility `all`: sees all expenses
- Data visibility `team`: sees expenses created by themselves and their team members
- Data visibility `self`: sees only expenses they created
- Create: controlled by `can_create` (user submits their own expenses)
- Edit: controlled by `can_edit` — but also limited to records in their scope (a user can only edit their own, a manager can edit own + team's)
- Delete: admin-only (always)
- Scope column: `created_by`

**Budgets**
- Read: everyone with `can_read` (budgets are organizational, not personal)
- Create/Edit: controlled by permission matrix

**Categories & Summary**
- Read: everyone with `can_read`
- Create/Edit: controlled by permission matrix (typically admin-only)
- Delete: admin-only (always)

#### Tasks Module (Partially Done)

Tasks already has some scoping logic based on sub-module access (`tasks-my` vs `tasks-board` vs `tasks-team`). The upgrade integrates this with the data scope system:

- `tasks-my`: data_visibility `self` — sees only tasks assigned to them (already works)
- `tasks-team`: data_visibility `team` — sees tasks assigned to direct reports
- `tasks-board`: Full kanban view (scoped by data_visibility: all/team/self)
- All create/edit/approve actions controlled by permission matrix
- Delete: admin-only (always)

#### Sales Module

Sales routes track calls, optins, meetings, and opportunities. Most data has a `created_by` or `assigned_to` field.

- Data scoped by `data_visibility` using `created_by` or `assigned_to` column
- All create/edit actions controlled by permission matrix
- Delete: admin-only (always)

#### Payments Module

Tracks transactions, settlements, failed payments, and collection logs.

- `daily-collection`: scoped by `created_by`
- `failed-tracking`: scoped by `assigned_to`
- `invoice-follow-ups`: scoped by `assigned_to`
- `revenue-targets`: read controlled by `can_read`, write by `can_create`/`can_edit`
- Delete: admin-only (always)

#### Marketing & SEO Module

Content creation and SEO task tracking have `created_by` and `assigned_to` fields.

- Data scoped by `data_visibility` using `created_by` or `assigned_to`
- Reference data (keywords, competitors): readable by all with `can_read`
- Delete: admin-only (always)

#### Meta Ads Module

Most Meta routes proxy to the Facebook/Meta API — they fetch campaign data from Meta's servers, not from the local database. Module access (`can_read`) is the gate. Internal tracking tables (`campaign-tracker`, `creative-tracker`, `budget-plans`, `conversion-log`) are scoped by `created_by` or `decided_by`.

#### Analytics Module

Read-only dashboards aggregating data from other modules. `can_read` permission is sufficient — the data shown on analytics dashboards is already at an aggregate level, not individual records.

#### Chat Module

Already scoped by channel membership. Users only see channels they're members of, and messages within those channels. No additional scoping needed.

#### Admin Module

Already restricted to admin-only via `requireAdmin()`. No changes needed.

### 6.3 Response Format

Every API response that returns data also includes a `_permissions` object:

```json
{
  "records": [...],
  "_permissions": {
    "canRead": true,
    "canCreate": true,
    "canEdit": true,
    "canApprove": false,
    "canExport": false,
    "canDelete": false
  }
}
```

`canDelete` will always be `false` for non-admin users — it's included in the response for consistency but is never `true` unless the user is admin.

This tells the frontend exactly what the current user can do in this sub-module, eliminating the need for client-side permission guessing.

---

## 7. Phase 4 — Frontend Permission-Aware UI

### Why

After Phase 3 locks down the backend, the frontend still shows all buttons to everyone. Users would see delete and approve buttons, click them, and get 403 errors. This phase makes the UI match the user's actual permissions — if they can't do it, they can't see it.

### 7.1 Permission Hook

A React hook that any page can use to check the current user's permissions:

**Usage:**
```
const { scope, canDo, loading } = usePermissions("hr");

// Check specific action
if (canDo("hr-leaves", "approve")) { ... }
if (canDo("finance-expenses", "delete")) { ... }
```

**How it works:**
1. Calls `GET /api/user/permissions?module=hr` on mount
2. Caches the response (doesn't refetch on every render)
3. Returns scope (`admin`/`manager`/`user`) and a `canDo()` function
4. Components use `canDo()` to decide what to render

### 7.2 Permission Gate Component

A declarative wrapper component that shows or hides its children based on permissions:

```
<PermissionGate subModule="hr-leaves" action="approve">
  <ApproveButton />
</PermissionGate>
```

If the user doesn't have `approve` permission for `hr-leaves`, the `ApproveButton` simply doesn't render. No 403 errors, no broken UX.

**Fallback support:** Optionally render alternative content for unauthorized users:
```
<PermissionGate subModule="finance-expenses" action="delete" fallback={<span>Read only</span>}>
  <DeleteButton />
</PermissionGate>
```

### 7.3 Page-by-Page Changes

**HR Leaves Page**
- Current: Shows approve/reject buttons based on a client-side `canApprove` check that manually queries `reporting_to`
- After: Uses `<PermissionGate subModule="hr-leaves" action="approve">` around approve/reject buttons. The server already determined if this user is a manager — the client just renders accordingly.
- "Apply for Leave" button: gated on `canDo("hr-leaves", "create")`
- Data: API already returns only the user's relevant leaves (Phase 3)

**Finance Expenses Page**
- Current: Shows delete and edit buttons for every expense to every user
- After: Delete button wrapped in `<PermissionGate action="delete">`, only visible to managers and admins
- "Add Expense" button: visible if `canDo("finance-expenses", "create")`
- Data: API already returns only the user's own expenses (or team's for managers)

**HR Employees Page**
- Current: Shows add/edit/delete employee controls to everyone
- After: Add employee gated on `canDo("hr-employees", "create")` (managers+). Edit/delete similarly gated.
- Data: Users see only their own record. Managers see their team.

**Tasks Pages**
- Current: All task actions visible regardless of sub-module access
- After: Task creation gated on `canDo("tasks-*", "create")`. Delete gated on `canDo("tasks-*", "delete")`.

**All Other Module Pages**
- Same pattern: wrap action buttons in `<PermissionGate>`, let the server-provided `_permissions` object drive the UI.

### 7.4 The Principle

The frontend becomes a **renderer, not a decision-maker**:

1. Server sends pre-filtered data (only what this user should see)
2. Server sends permissions metadata (what actions this user can perform)
3. Frontend renders the data and shows only permitted action buttons
4. No client-side permission computation, no hacks, no guessing

---

## 8. Verification & Testing

### Phase 0 Verification
- Run migrations in Supabase dashboard or CLI
- Verify all 4 new tables exist: `user_module_overrides`, `scope_levels`, `role_module_permissions`, `user_permission_overrides`
- Verify 4 default scope levels seeded (admin, manager, employee, client)
- Verify data migrated from `role_modules` to `role_module_permissions` (with `can_read = true`)
- Test: existing admin permissions page loads without errors

### Phase 1 Verification
- **Middleware:** Open an incognito browser, navigate to `/m/hr/leaves` — should instantly redirect to `/login` (no page flash)
- **Middleware API:** Call any `/api/*` endpoint without auth header — should get 401 JSON response
- **Security headers:** Open browser DevTools → Network tab → check response headers on any page
- **Rate limiting:** Attempt 6 rapid login attempts — 6th should get 429 response
- **Token expiry:** Leave a tab open for > 1 hour, then click something — should auto-refresh, not fail silently

### Phase 2 Verification
- Call `GET /api/user/permissions?module=hr` as admin → `scopeLevel = admin`, `canDelete = true`, all actions `true`
- Call same endpoint as a manager → `scopeLevel = manager`, `canDelete = false`, actions per permission matrix
- Call same endpoint as an employee → `scopeLevel = employee`, `canDelete = false`, limited actions
- Call same endpoint as a client → `scopeLevel = client`, minimal permissions

### Phase 3 Verification (Per Module)
For each module, test with 4 accounts (admin, manager, employee, client):

| Test | Admin | Manager | Employee | Client |
|------|-------|---------|----------|--------|
| GET hr/employees | All employees | Own + direct reports | Own record only | Own record only |
| GET hr/leaves | All leaves | Own + team's | Own only | Own only (if granted) |
| GET finance/expenses | All expenses | Own + team's | Own only | Own only (if granted) |
| PUT hr/leaves (approve) | Allowed | Allowed (if can_approve + is reporting manager) | 403 | 403 |
| POST finance/expenses | Allowed | Allowed (if can_create) | Allowed (if can_create) | Depends on matrix |
| DELETE anything | Allowed | 403 always | 403 always | 403 always |

### Phase 4 Verification
- Login as employee → verify no delete buttons anywhere, no approve buttons, only permitted actions visible
- Login as manager → verify approve buttons visible where permission matrix grants it, NO delete buttons
- Login as admin → verify all buttons visible including delete
- Login as client → verify minimal UI, only read + designated input areas
- Inspect network tab → verify `_permissions` object in API responses matches UI behavior
- Test admin panel → verify permission matrix table UI works: select role, toggle actions per sub-module

---

## 9. File Inventory

### New Files (12)

| File | Phase | Description |
|------|-------|-------------|
| `supabase/migrations/001_user_module_overrides.sql` | 0 | Missing permission overrides table |
| `supabase/migrations/002_scope_levels.sql` | 0 | Dynamic scope levels table + seed data |
| `supabase/migrations/003_role_module_permissions.sql` | 0 | Permission matrix table (replaces role_modules) |
| `supabase/migrations/004_user_permission_overrides.sql` | 0 | Per-user action-level overrides |
| `src/middleware.ts` | 1 | Server-side route protection |
| `src/lib/supabase-server.ts` | 1 | SSR-aware Supabase client |
| `src/lib/rate-limit.ts` | 1 | In-memory rate limiting |
| `src/lib/data-scope.ts` | 2 | Scope resolution + query filtering |
| `src/lib/permissions.ts` | 2 | Permission matrix checker (replaces action-permissions) |
| `src/app/api/user/permissions/route.ts` | 2 | Frontend permissions API |
| `src/hooks/usePermissions.ts` | 4 | Client-side permission hook |
| `src/components/PermissionGate.tsx` | 4 | Declarative permission gate component |

### Modified Files (Key)

| File | Phase | Change |
|------|-------|--------|
| `supabase-schema.sql` | 0 | Add all new table definitions |
| `next.config.ts` | 1 | Add security headers |
| `src/lib/api-auth.ts` | 1+2 | SSR client, extended auth result, scope resolver integration |
| `src/lib/api-fetch.ts` | 1 | Token expiry detection |
| `src/lib/auth.ts` | 1 | Auth event audit logging |
| `src/components/AuthGuard.tsx` | 1 | Reduced timeout |
| `src/types/index.ts` | 2 | ScopeLevel, DataScope, PermissionMatrix types |
| `src/app/m/admin/permissions/page.tsx` | 4 | Replace ON/OFF toggles with permission matrix table UI |
| 80+ API route files | 3 | Scope filtering + permission matrix checks |
| 40+ frontend page files | 4 | PermissionGate wrappers on action buttons |

### Implementation Order

```
Phase 0 (DB)  →  Phase 1 (Auth)  →  Phase 2 (Scope Layer)
                                          ↓
                                    Phase 3 (API Routes)
                                     HR → Finance → Tasks → Sales → Rest
                                          ↓
                                    Phase 4 (Frontend)
                                     HR pages → Finance pages → Rest
```

Each phase depends on the previous one. Within Phase 3 and 4, HR is done first as the reference implementation (most complex), then the pattern is applied to remaining modules.
