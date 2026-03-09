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

/* ── Meta Module ─────────────────────────────────── */

export interface MetaCampaignTracker {
  id: string;
  campaign_id: string;
  campaign_name: string;
  log_date: string;
  action: "scale_up" | "scale_down" | "pause" | "restart" | "adjust_audience" | "adjust_creative" | "no_change" | "kill";
  notes: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaCreativeTracker {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string | null;
  status: "active" | "watch" | "fatigued" | "retired" | "top_performer";
  fatigue_score: number;
  notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaBudgetPlan {
  id: string;
  campaign_id: string;
  campaign_name: string;
  period_start: string;
  period_end: string;
  planned_budget: number;
  actual_spend: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaConversionLog {
  id: string;
  date: string;
  campaign_id: string | null;
  campaign_name: string | null;
  lead_name: string;
  lead_phone: string | null;
  lead_quality: "hot" | "warm" | "cold" | "junk";
  conversion_status: "new" | "contacted" | "qualified" | "converted" | "lost";
  revenue_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ── SEO Module ──────────────────────────────────── */

export interface SEOKeywordTracker {
  id: string;
  keyword: string;
  current_position: number | null;
  target_position: number;
  status: "tracking" | "improving" | "achieved" | "declined" | "paused";
  priority: "high" | "medium" | "low";
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOTaskLog {
  id: string;
  title: string;
  task_type: "on_page" | "technical" | "content" | "backlink" | "local_seo" | "other";
  status: "todo" | "in_progress" | "done" | "blocked";
  page_url: string | null;
  keyword: string | null;
  due_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOCompetitorTracker {
  id: string;
  competitor_domain: string;
  keyword: string;
  our_position: number | null;
  competitor_position: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOContentBrief {
  id: string;
  title: string;
  target_keyword: string | null;
  target_url: string | null;
  status: "draft" | "writing" | "review" | "published" | "archived";
  word_count_target: number | null;
  assigned_to: string | null;
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
