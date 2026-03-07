# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APEX OS is an internal company operating system for Apex Fashion Lab. It consolidates 15-20+ SaaS tools into a single role-based platform. Users only see modules their role permits.

## Architecture

### Navigation: Fixed Breadcrumb Bar
- The top breadcrumb bar is the PRIMARY navigation system, fixed on every page.
- Supports infinite depth: `APEX OS > Module > Section > Item > Detail > ...`
- Every level is clickable to jump back. Built with Next.js catch-all routes (`/m/[...slug]`).

### Module System
- Each module (CRM, LMS, Finance, etc.) lives under `src/app/m/` as a self-contained folder.
- APEX OS shell provides only: breadcrumb bar + auth + role gating.
- Each module controls its own internal layout (sidebar, dashboard, cards, etc.).
- New modules are registered in the module config (`src/lib/modules.ts`).

### Role-Based Access Control (RBAC)
- Roles defined in Supabase `roles` table (CTO, Manager, Sales, Intern, etc.).
- `role_modules` table maps which roles can access which modules.
- Home screen displays only modules permitted for the logged-in user's role.
- Supabase RLS enforces data-level access. `src/lib/rbac.ts` handles client-side checks.
- Admin panel (CTO-only) manages role-module assignments.

### 3-Tier Logging System (`src/lib/logger.ts`)
- **Tier 1 (Critical)**: Always logged with full detail — auth events, payments, data deletion, role/permission changes, admin actions.
- **Tier 2 (Important)**: Logged lightweight — CRUD on business data (leads, tasks, files, courses).
- **Tier 3 (Noise)**: Never logged — page views, clicks, scrolls, searches.
- Log entry format: WHO, WHAT, WHERE (breadcrumb path), WHEN, BEFORE/AFTER values.
- Stored in `audit_logs` Supabase table.

### Key Supabase Tables
- `users` — extends Supabase auth with profile data
- `roles` — role definitions
- `modules` — registered modules (name, icon, path, description)
- `role_modules` — role-to-module access mapping
- `user_roles` — user-to-role assignment
- `audit_logs` — tier 1 & 2 log entries

### Key Files
- `src/app/layout.tsx` — Root layout with breadcrumb bar
- `src/app/page.tsx` — Home screen (module launcher grid)
- `src/app/m/[...slug]/page.tsx` — Catch-all module router
- `src/components/Breadcrumb.tsx` — Fixed top breadcrumb component
- `src/lib/supabase.ts` — Supabase client
- `src/lib/rbac.ts` — Role & permission logic
- `src/lib/logger.ts` — 3-tier audit logging
- `src/lib/modules.ts` — Module registry & config

## Adding a New Module

1. Create folder under `src/app/m/[module-name]/`
2. Register in `src/lib/modules.ts` with name, icon, path, description
3. Assign to roles via admin panel or `role_modules` table
4. Module handles its own internal routing and layout below the breadcrumb bar
