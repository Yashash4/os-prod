# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file updated.** When you make architectural changes, add new patterns, or modify how auth/permissions/scoping works — ask the user if CLAUDE.md should be updated to reflect it. This file is the prompt for every future agent session, so stale context = broken agents.

## Project Overview

APEX OS is an internal company operating system for Apex Fashion Lab — a single role-based platform consolidating 15-20+ SaaS tools. 10 primary modules, 124 sub-modules. Users only see what their role permits.

## Architecture

### Routing & Module System

All authenticated pages live under `src/app/m/` via a single catch-all route (`src/app/m/[...slug]/page.tsx`). The breadcrumb bar is the PRIMARY navigation — fixed on every page, infinite depth, every level clickable.

Modules form a hierarchical tree via `parent_slug` in `src/lib/modules.ts` (`MODULE_REGISTRY` array). The catch-all page resolves the current slug, fetches children, filters by the user's role permissions, and renders `ModuleCard` grid or the module's own page component.

### Auth Flow — How Client and API Connect

1. **Client-side:** `AuthContext` (`src/contexts/AuthContext.tsx`) uses `supabase.auth.onAuthStateChange` as single source of truth — deliberately avoids `getSession()` to prevent auth lock. `AuthGuard` wraps protected pages and redirects to `/login`.
2. **Client fetch:** `src/lib/api-fetch.ts` caches the access token from `onAuthStateChange` and auto-attaches it as a Bearer token on every `/api/*` call.
3. **API-side:** `src/lib/api-auth.ts` is the server auth layer. Every API route calls one of:
   - `requireSubModuleAccess(req, parentSlug, subModuleSlug)` — most common (checks auth + parent module + sub-module access)
   - `requireModuleAccess(req, moduleSlug)` — module-level only
   - `requireAdmin(req)` — admin-only routes
   - All return `{ auth: { userId, email, roleId, isAdmin } }` or `{ error: NextResponse }`

**Two Supabase clients:**
- `src/lib/supabase.ts` — browser client (anon key, client-side only)
- `src/lib/supabase-admin.ts` — service role client (API routes only, bypasses RLS)

**Important:** `@supabase/ssr` is installed but unused. Cookie-based auth in `api-auth.ts:37-51` creates an ad-hoc `createClient` instead — this is being replaced in the production upgrade.

### RBAC — How Permissions Work

- `roles` table has `is_admin` flag. Admins bypass all access checks.
- `role_modules` maps role → module access (ON/OFF per module).
- `user_module_overrides` allows per-user grant/revoke exceptions on top of role.
- `src/lib/rbac.ts` provides client-side helpers (`getEffectiveModules`, `canAccessModule`).
- Home page fetches permitted modules via `/api/modules/effective`.
- **Current limitation being fixed:** Access control is module-level ON/OFF only — no action-level permissions (read/create/edit/approve), no data scoping by role. See Production Upgrade below.

### API Route Pattern — Every Route Follows This

```typescript
import { requireSubModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "parent-slug", "sub-module-slug");
  if ("error" in result) return result.error;
  // result.auth = { userId, email, roleId, isAdmin }
  // All DB queries use supabaseAdmin (service role)
}
```

109 route files across `src/app/api/`. All use `supabaseAdmin` for DB access. Currently NO data scoping — every query returns ALL rows regardless of who's asking. This is the core problem being fixed.

### 3-Tier Audit Logging

`src/lib/logger.ts` — Tier 1 (`logCritical`): auth, payments, deletion, admin actions. Tier 2 (`logImportant`): business CRUD. Tier 3: never logged. Each entry: WHO, WHAT, WHERE (breadcrumb), WHEN, BEFORE/AFTER values. Stored in `audit_logs` table.

### Manager Hierarchy

`hr_employees.reporting_to` links employees to their manager (another `hr_employees.id`). This is the basis for manager-level data scoping — managers should see their direct reports' data. `HRDesignation` has `role_id` for automatic role assignment when creating employees.

### UI Shell

`Shell.tsx` wraps all authenticated pages with header (breadcrumb, logo, user avatar, notifications, sign out). `AuthGuard` → `Shell` → module content. Dark-mode-first design with brand gold accent (`#B8860B`), CSS variables in `globals.css`.

## Critical Context for Coding Agents

### What's Broken (Being Fixed)

1. **No Next.js middleware** — auth is client-side only (`AuthGuard`). No server-side route protection.
2. **Every API route returns ALL data** — `supabaseAdmin` queries have zero user/role filtering. A user sees everyone's expenses, leaves, salaries, etc.
3. **Anyone can perform any action** — DELETE, approve, edit — no action-level permission checks beyond module access.
4. **`user_module_overrides` table doesn't exist in DB** — code references it but the table was never created.
5. **No rate limiting, no security headers** — `next.config.ts` is empty.

### Production Upgrade Plan

`PRODUCTION-UPGRADE.md` contains the full plan. Key new concepts being introduced:

- **4 scope levels:** Admin (sees all) → Manager (sees team via `reporting_to`) → Employee (sees own) → Client (limited read)
- **Permission matrix:** `role_module_permissions` table with `can_read`, `can_create`, `can_edit`, `can_approve`, `can_export` per role per sub-module. Delete is admin-only (not in matrix).
- **`data-scope.ts`:** Centralized scope resolver — determines user's level from `hr_employees` + `reporting_to`, returns `DataScope` with filtered employee/user ID lists.
- **`scopeQuery()`:** Helper that applies `.eq()`/`.in()` WHERE clauses to any Supabase query based on scope.
- **Frontend:** `<PermissionGate>` component and `usePermissions` hook — buttons only render if user has that action permission.

### Patterns to Follow

- Server-side data filtering (client components are "dumb" — they render what the API gives them)
- `requireSubModuleAccess()` at the top of every API route
- Audit log all Tier 1 and Tier 2 actions with before/after values
- Use `supabaseAdmin` in API routes, `supabase` (anon) on client
- `apiFetch()` for all client → API calls (auto-attaches auth token)
