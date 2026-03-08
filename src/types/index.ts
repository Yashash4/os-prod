export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string;
  created_at: string;
}

export interface UserWithRole extends User {
  role: Role | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_admin?: boolean;
  created_at: string;
}

export interface Module {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  parent_slug: string | null;
  path: string;
  order: number;
  is_active: boolean;
  created_at: string;
}

export interface RoleModule {
  role_id: string;
  module_id: string;
  access_level?: string;
}

export interface UserModuleOverride {
  id: string;
  user_id: string;
  module_id: string;
  access_type: "grant" | "revoke";
  granted_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  tier: 1 | 2;
  action: string;
  module: string;
  breadcrumb?: string;
  entity_type?: string;
  entity_id?: string;
  before_value?: Record<string, unknown>;
  after_value?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}

/* ── Payments Module ──────────────────────────────── */

export interface RevenueTarget {
  id: string;
  period_type: "daily" | "weekly" | "monthly";
  period_start: string;
  target_amount: number; // paise
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FailedPaymentTracking {
  id: string;
  razorpay_payment_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  amount: number; // paise
  original_status: string;
  follow_up_status: "pending" | "contacted" | "resolved" | "written_off" | "retry_sent";
  contacted_at: string | null;
  resolved_at: string | null;
  retry_payment_link_id: string | null;
  retry_payment_link_url: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCollectionEntry {
  id: string;
  log_date: string;
  customer_name: string;
  amount: number; // paise
  payment_mode: string | null;
  reference_id: string | null;
  bank_confirmed: boolean;
  reconciled: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFollowUp {
  id: string;
  razorpay_invoice_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount_due: number; // paise
  due_date: string | null;
  follow_up_status: "pending" | "contacted" | "partial_paid" | "paid" | "written_off" | "disputed";
  last_contacted_at: string | null;
  follow_up_count: number;
  next_follow_up_date: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
