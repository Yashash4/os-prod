# APEX - OS

Internal operating system for **Apex Fashion Lab** — a unified, role-based platform that consolidates 15–20+ SaaS tools into a single dashboard. Each user sees only the modules their role permits.

**Live:** [os.apexfashionlab.com](https://os.apexfashionlab.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| UI | React 19, TailwindCSS v4 |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Email | Resend |
| Payments | Razorpay |
| Deployment | Vercel |

---

## Modules

APEX OS ships with **10 primary modules** and **124 total sub-modules**:

| Module | Description | Key Sub-Modules |
|--------|-------------|-----------------|
| **Sales** | Pipeline management, CRM, revenue tracking | GHL Integration, Calendar, Opportunities, Pipeline, Meetings, Onboarding |
| **Marketing** | Ad campaigns, SEO, content management | Meta Ads, SEO (Google Search Console, GBP), Content (Ads, Social Media, Video) |
| **Payments** | Payment tracking, settlements, invoicing | Dashboard, Transactions, Settlements, Invoices, Payment Pages, Failed Payments |
| **Analytics** | Centralized company-wide analytics | Overview, Meta Ads, SEO, Payments, Sales, GHL Dashboard, Cohort Tracker |
| **HR** | Employee management, payroll, attendance | Employees, Departments, Designations, KPIs & KRAs, Salary, Payroll, Leaves, Holidays |
| **Tasks** | Task management with Kanban board | Board (drag-and-drop), My Tasks, Team Tasks, Projects |
| **Finance** | Expense tracking and budgets | Expenses, Budgets, Categories, Summary |
| **Chat** | Internal team messaging | Channels, Direct Messages |
| **Automations** | Email workflows and invoice generation | Email Templates, Compose (live preview), Sent Invoices |
| **Admin** | System administration (CTO/Admin only) | Users, Roles & Permissions, Audit Logs, Module Management |

---

## Architecture

### Navigation — Fixed Breadcrumb Bar

The top breadcrumb bar is the primary navigation system, fixed on every page. It supports infinite depth:

```
APEX OS > Sales > Pipeline > Deal #1042 > Activity
```

Every level is clickable. Built with Next.js catch-all routes (`/m/[...slug]`).

### Role-Based Access Control (RBAC)

Access control is enforced at **three layers**:

1. **UI Layer** — Home screen and sidebar only show permitted modules
2. **API Layer** — Every route calls `requireSubModuleAccess(req, parentSlug, subModuleSlug)` which validates the user's role and per-user overrides before processing
3. **Database Layer** — Supabase Row-Level Security (RLS) policies with a `user_has_module_access()` function as defense-in-depth

Key concepts:
- **Roles** are defined in the `roles` table (CTO, Manager, Sales, Intern, etc.)
- **`role_modules`** maps which roles can access which modules
- **`user_module_overrides`** allows per-user grant/revoke exceptions
- Admin roles automatically receive access to all modules

### Sub-Module Data Scoping

Beyond module-level gating, data is scoped based on sub-module access. For example, a user with only "My Tasks" access will:
- Only see tasks assigned to them (even if they call the API directly)
- Be blocked from creating tasks assigned to others
- Be blocked from viewing/editing tasks not assigned to them

### 3-Tier Audit Logging

| Tier | Level | What Gets Logged | Examples |
|------|-------|------------------|----------|
| 1 | Critical | Always logged with full detail | Auth events, payments, data deletion, role changes, admin actions |
| 2 | Important | Logged lightweight | CRUD on business data (leads, tasks, expenses, invoices) |
| 3 | Noise | Never logged | Page views, clicks, scrolls, searches |

Each log entry captures: **WHO** (user), **WHAT** (action), **WHERE** (breadcrumb path), **WHEN** (timestamp), and **BEFORE/AFTER** values for mutations.

---

## Project Structure

```
src/
├── app/
│   ├── api/                        # 92+ API routes
│   │   ├── admin/                  # User management, roles, audit logs
│   │   ├── analytics/              # Analytics endpoints
│   │   ├── automations/            # Email templates, invoice sending
│   │   ├── chat/                   # Channels, messages
│   │   ├── finance/                # Expenses, budgets, categories
│   │   ├── ghl/                    # GoHighLevel CRM integration
│   │   ├── hr/                     # Employees, departments, payroll
│   │   ├── marketing/              # Content management
│   │   ├── meta/                   # Meta/Facebook Ads API
│   │   ├── notifications/          # User notifications
│   │   ├── payments/               # Payment processing
│   │   ├── razorpay/               # Razorpay webhooks & API
│   │   ├── sales/                  # Sales pipeline & CRM
│   │   ├── seo/                    # SEO & Google Business Profile
│   │   └── tasks/                  # Task management
│   ├── auth/                       # Auth callback pages
│   ├── login/                      # Login page
│   ├── m/                          # Module pages (catch-all router)
│   │   ├── admin/                  # Admin panel
│   │   ├── analytics/              # Analytics dashboards
│   │   ├── automations/            # Email compose & templates
│   │   ├── chat/                   # Chat interface
│   │   ├── finance/                # Finance dashboards
│   │   ├── hr/                     # HR management
│   │   ├── marketing/              # Marketing dashboards
│   │   ├── payments/               # Payment dashboards
│   │   ├── sales/                  # Sales dashboards
│   │   └── tasks/                  # Task board, my tasks, projects
│   ├── layout.tsx                  # Root layout (providers, font, metadata)
│   ├── page.tsx                    # Home — module launcher grid
│   └── globals.css                 # Theme variables & global styles
├── components/
│   ├── Shell.tsx                   # Main layout (header, sidebar, breadcrumb)
│   ├── AuthGuard.tsx               # Route protection wrapper
│   ├── ModuleGuard.tsx             # Module access wrapper
│   ├── Breadcrumb.tsx              # Breadcrumb navigation
│   ├── NavTree.tsx                 # Sidebar navigation tree
│   ├── ModuleCard.tsx              # Home screen module cards
│   ├── NotificationDropdown.tsx    # Notification bell dropdown
│   ├── QuickChat.tsx               # Floating chat widget
│   └── tasks/, sales/, seo/, ...   # Feature-specific components
├── lib/
│   ├── modules.ts                  # Module registry (124 modules)
│   ├── api-auth.ts                 # API auth helpers (requireSubModuleAccess, etc.)
│   ├── rbac.ts                     # Client-side role & permission checks
│   ├── supabase.ts                 # Supabase browser client
│   ├── supabase-admin.ts           # Supabase service-role client
│   ├── logger.ts                   # 3-tier audit logging
│   ├── auth.ts                     # Auth utilities (sign in/out)
│   ├── api-fetch.ts                # Authenticated fetch wrapper
│   ├── ghl.ts                      # GoHighLevel API client
│   ├── meta.ts                     # Meta Ads API client
│   ├── gsc.ts                      # Google Search Console client
│   ├── gmb.ts                      # Google My Business client
│   ├── razorpay.ts                 # Razorpay client
│   └── notify.ts                   # Notification helpers
├── types/                          # TypeScript type definitions
├── contexts/                       # React context providers
└── hooks/                          # Custom React hooks

supabase/
├── schema.sql                      # Base database schema
└── migrations/                     # 42 migration files
```

---

## External Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| **Supabase** | Database, auth, realtime, RLS | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **GoHighLevel** | Sales CRM, calendar, pipeline | `GHL_API_KEY`, `GHL_LOCATION_ID` |
| **Meta (Facebook)** | Ad campaigns, insights, audiences | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| **Google Search Console** | SEO rankings, indexing, sitemaps | `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` |
| **Google Business Profile** | Local SEO, reviews, GBP management | Same Google service account |
| **Razorpay** | Payment processing, settlements | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| **Resend** | Transactional & invoice emails | `RESEND_API_KEY` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- API keys for external services (as needed)

### Setup

```bash
# Clone the repository
git clone https://github.com/henal123/os-apex-fashion-lab.git
cd os-apex-fashion-lab

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Fill in your Supabase URL, keys, and API credentials

# Run database migrations
npx supabase db push

# Start the development server (runs on port 4444)
npm run dev
```

Open [http://localhost:4444](http://localhost:4444) in your browser.

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# GoHighLevel (Sales CRM)
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_ghl_location_id

# Meta Ads
META_ACCESS_TOKEN=your_meta_token
META_AD_ACCOUNT_ID=your_ad_account_id
META_PIXEL_ID=your_pixel_id

# Google APIs
GSC_CLIENT_EMAIL=your_service_account_email
GSC_PRIVATE_KEY=your_private_key
GSC_SITE_URL=your_site_url

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Resend (Email)
RESEND_API_KEY=your_resend_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:4444
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 4444 |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |

---

## Design System

APEX OS uses a dark-mode-first design with a custom color palette:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0D0D0D` | Page background |
| `--foreground` | `#F5F5F5` | Primary text |
| `--surface` | `#171717` | Cards, panels |
| `--surface-hover` | `#1F1F1F` | Hover states |
| `--border` | `#262626` | Borders, dividers |
| `--accent` | `#B8860B` | Brand gold — buttons, highlights |
| `--accent-hover` | `#D4A017` | Accent hover state |
| `--muted` | `#A3A3A3` | Secondary text, labels |

Font: **Inter** (Google Fonts)

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Extends Supabase Auth with profile data (full_name, avatar, department) |
| `roles` | Role definitions with `is_admin` flag |
| `modules` | Module registry (name, slug, icon, parent_slug, path) |
| `role_modules` | Role → module access mapping |
| `user_module_overrides` | Per-user grant/revoke exceptions |
| `audit_logs` | Tier 1 & 2 audit entries |

### Domain Tables

| Domain | Tables |
|--------|--------|
| Tasks | `tasks`, `projects`, `task_comments` |
| Finance | `expenses`, `expense_categories`, `budgets` |
| HR | `employees`, `departments`, `designations`, `kpis`, `kras`, `salary_records`, `payroll`, `leaves`, `holidays` |
| Chat | `chat_channels`, `chat_members`, `chat_messages` |
| Payments | `payment_transactions`, `payment_settlements`, `payment_pages` |
| Email | `email_templates`, `sent_invoices` |
| Notifications | `notifications` |

---

## Adding a New Module

1. Create a folder under `src/app/m/[module-name]/`
2. Register the module in `src/lib/modules.ts` with name, slug, icon, path, and description
3. Create API routes under `src/app/api/[module-name]/` using `requireSubModuleAccess()`
4. Assign to roles via the Admin panel or directly in the `role_modules` table
5. The module handles its own internal layout below the breadcrumb bar

---

## Key API Auth Patterns

```typescript
// Basic module access check
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "tasks");
  if ("error" in result) return result.error;
  // result.auth contains { userId, roleId, isAdmin }
}

// Sub-module level check
import { requireSubModuleAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const result = await requireSubModuleAccess(req, "finance", "finance-expenses");
  if ("error" in result) return result.error;
}

// Admin-only routes
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
}
```

---

## License

Private — Internal use only by Apex Fashion Lab.
