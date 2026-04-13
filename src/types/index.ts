// ============================================================================
// APEX OS — TypeScript Type Definitions
// Owner: FOUNDATION agent
// Every database table has a corresponding interface.
// ============================================================================

// ─── Core Auth & User ───────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends User {
  roles: Role | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_admin: boolean;
  scope_level_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  userId: string;
  email: string;
  roleId: string | null;
  isAdmin: boolean;
}

export interface AuthWithScope {
  auth: AuthResult;
  scope: DataScope;
  permissions: PermissionMatrix;
}

// ─── Scope & Permissions ────────────────────────────────────────────────────

export interface ScopeLevel {
  id: string;
  name: string;
  slug: 'admin' | 'manager' | 'employee' | 'client';
  rank: number;
  data_visibility: 'all' | 'team' | 'self';
  can_delete: boolean;
  is_system: boolean;
  description?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ScopeLevelInfo {
  id?: string;
  name: string;
  slug: string;
  rank: number;
  dataVisibility?: 'all' | 'team' | 'self';
  canDelete?: boolean;
  data_visibility?: 'all' | 'team' | 'self';
  can_delete?: boolean;
  is_system?: boolean;
  created_at?: string;
}

export interface DataScope {
  scopeLevel: ScopeLevelInfo;
  userId: string;
  employeeId?: string;
  departmentId?: string;
  teamEmployeeIds: string[];
  teamUserIds: string[];
}

export interface PermissionMatrix {
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
  canDelete: boolean;
}

// ─── Modules ────────────────────────────────────────────────────────────────

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
  updated_at?: string;
}

export interface RoleModule {
  role_id: string;
  module_id: string;
}

export interface UserModuleOverride {
  id: string;
  user_id: string;
  module_id: string;
  access_type: 'grant' | 'revoke';
  granted_by: string | null;
  created_at: string;
}

export interface RoleModulePermission {
  id: string;
  role_id: string;
  module_id: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_export: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  module_id: string;
  action: 'read' | 'create' | 'edit' | 'approve' | 'export';
  granted: boolean;
  granted_by: string | null;
  created_at: string;
}

// ─── Audit & Notifications ──────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name?: string | null;
  tier: 1 | 2;
  action: string;
  module: string;
  breadcrumb_path: string;
  /** @deprecated Use breadcrumb_path */
  breadcrumb?: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  /** @deprecated Use details */
  metadata?: Record<string, unknown>;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  module_slug: string | null;
  entity_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── HR Module ──────────────────────────────────────────────────────────────

export interface HRDepartment {
  id: string;
  name: string;
  description: string;
  head_employee_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRDesignation {
  id: string;
  title: string;
  level: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'head' | 'director';
  department_id: string | null;
  role_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HREmployee {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  designation_id: string | null;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  join_date: string;
  exit_date: string | null;
  status: 'active' | 'on_leave' | 'notice_period' | 'exited';
  reporting_to: string | null;
  is_sales_rep: boolean;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Nested relations (populated by select joins)
  department?: HRDepartment;
  designation?: HRDesignation;
  manager?: { id: string; full_name: string } | null;
}

export interface HRLeaveType {
  id: string;
  name: string;
  days_per_year: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRLeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total: number;
  used: number;
  created_at: string;
  updated_at: string;
}

export interface HRHoliday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRSalary {
  id: string;
  employee_id: string;
  base_salary: number; // paise
  effective_from: string;
  effective_to: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRSalaryCycle {
  id: string;
  employee_id: string;
  cycle_month: string; // YYYY-MM
  base_amount: number; // paise
  commission_amount: number; // paise
  deductions: number; // paise
  net_amount: number; // paise
  status: 'pending' | 'calculated' | 'approved' | 'paid';
  paid_date: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employee?: { id: string; full_name: string };
}

export interface HRKPI {
  id: string;
  name: string;
  description: string;
  department_id: string | null;
  designation_id: string | null;
  unit: 'count' | 'currency_paise' | 'percentage' | 'hours';
  target_value: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRKPIEntry {
  id: string;
  kpi_id: string;
  employee_id: string;
  period: string; // YYYY-MM
  actual_value: number;
  target_value: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  kpi?: HRKPI;
  employee?: { id: string; full_name: string };
}

export interface HRKRA {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  weightage: number; // percentage
  review_period: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'FY';
  self_rating: number | null;
  manager_rating: number | null;
  status: 'active' | 'review_pending' | 'reviewed' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRCommissionRule {
  id: string;
  employee_id: string | null;
  designation_id: string | null;
  rule_name: string;
  type: 'percentage' | 'flat_per_unit' | 'slab';
  value: number | null;
  slab_config: { min: number; max: number; rate: number }[] | null;
  metric: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRAttendance {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'half_day' | 'work_from_home' | 'on_leave';
  hours_worked: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRDocument {
  id: string;
  employee_id: string;
  name: string;
  document_type: 'offer_letter' | 'id_proof' | 'address_proof' | 'education' | 'experience' | 'salary_slip' | 'tax_form' | 'contract' | 'other';
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Finance Module ─────────────────────────────────────────────────────────

export interface FinanceExpenseCategory {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpense {
  id: string;
  category_id: string | null;
  title: string;
  amount: number; // paise
  date: string;
  paid_by: string;
  receipt_url: string | null;
  notes: string;
  is_recurring: boolean;
  recurring_interval: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceBudget {
  id: string;
  name: string;
  department_id: string | null;
  month: string;
  planned_amount: number; // paise
  actual_amount: number; // paise
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Tasks Module ───────────────────────────────────────────────────────────

export interface TaskProject {
  id: string;
  name: string;
  description: string;
  status: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  due_date: string | null;
  order: number;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

// ─── Sales Module ───────────────────────────────────────────────────────────

export interface SalesOpportunity {
  id: string; // GHL opportunity_id
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_id: string;
  pipeline_name: string;
  stage_name: string;
  source: string;
  status: 'pending_review' | 'reviewed' | 'won' | 'lost';
  rating: number | null;
  comments: string;
  notes: string;
  contact_id: string;
  assigned_to: string | null;
  ghl_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesDeal {
  id: string;
  opportunity_id: string;
  sales_rep_id: string | null;
  closed_date: string | null;
  fees_quoted: number; // paise
  fees_collected: number; // paise
  pending_amount: number; // paise
  payment_mode: string;
  invoice_number: string | null;
  collection_status: 'pending' | 'partial' | 'full';
  onboarding_status: 'not_started' | 'scheduled' | 'in_progress' | 'completed';
  notes: string;
  contact_email: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesMeeting {
  id: string;
  opportunity_id: string;
  sales_rep_id: string | null;
  meet_status: 'pending' | 'completed' | 'cancelled' | 'no_show';
  meet_notes: string;
  meet_date: string | null;
  follow_up_date: string | null;
  outcome: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesMeetingAnalysis {
  id: string;
  sales_rep_id: string | null;
  opportunity_id: string | null;
  contact_id: string;
  calendar_event_id: string | null;
  meet_date: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  meeting_link: string | null;
  outcome: 'converted' | 'no_conversion' | 'pending' | 'follow_up';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOnboarding {
  id: string;
  opportunity_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  source_rep_id: string | null;
  fees_quoted: number; // paise
  fees_collected: number; // paise
  onboarding_status: 'not_started' | 'scheduled' | 'in_progress' | 'completed';
  checklist: { id: string; label: string; done: boolean }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOptin {
  id: string;
  opportunity_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  stage_name: string;
  source: string;
  monetary_value: number; // paise
  status: 'new' | 'contacted' | 'converted' | 'lost';
  notes: string;
  last_contacted_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesPaymentDone {
  id: string;
  opportunity_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pipeline_name: string;
  stage_name: string;
  source: string;
  status: 'new' | 'contacted' | 'call_scheduled' | 'completed';
  notes: string;
  last_contacted_at: string | null;
  call_scheduled_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Payments Module ────────────────────────────────────────────────────────

export interface PaymentsDailyCollection {
  id: string;
  log_date: string;
  customer_name: string;
  amount: number; // paise
  payment_mode: string;
  reference_id: string | null;
  bank_confirmed: boolean;
  reconciled: boolean;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsFailedTracking {
  id: string;
  razorpay_payment_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  amount: number; // paise
  original_status: string;
  follow_up_status: 'pending' | 'contacted' | 'resolved' | 'written_off' | 'retry_sent';
  contacted_at: string | null;
  resolved_at: string | null;
  retry_payment_link_id: string | null;
  retry_payment_link_url: string | null;
  notes: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsInvoiceFollowUp {
  id: string;
  razorpay_invoice_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount_due: number; // paise
  due_date: string | null;
  follow_up_status: 'pending' | 'contacted' | 'partial_paid' | 'paid' | 'written_off' | 'disputed';
  follow_up_count: number;
  last_contacted_at: string | null;
  next_follow_up_date: string | null;
  notes: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsRevenueTarget {
  id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  target_amount: number; // paise
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsAmountGroup {
  id: string;
  name: string;
  min_amount: number | null; // paise
  max_amount: number | null; // paise
  created_at: string;
}

// ─── Chat Module ────────────────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  type: 'channel' | 'dm' | 'group';
  is_private: boolean;
  is_announcement: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  parent_id: string | null;
  reply_count: number;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatPin {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
}

export interface ChatDraft {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ChatPresence {
  user_id: string;
  status: 'online' | 'away' | 'offline';
  last_seen_at: string;
}

// ─── Marketing / Content Module ─────────────────────────────────────────────

export interface ContentAd {
  id: string;
  title: string;
  platform: string;
  ad_type: string;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'published' | 'archived';
  media_url: string | null;
  copy_text: string;
  target_audience: string;
  budget: number; // paise
  start_date: string | null;
  end_date: string | null;
  assigned_to: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentSocialPost {
  id: string;
  platform: 'instagram' | 'linkedin' | 'youtube' | 'twitter' | 'facebook';
  title: string;
  description: string;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'published' | 'archived';
  scheduled_at: string | null;
  published_at: string | null;
  media_url: string | null;
  post_url: string | null;
  assigned_to: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentSOPEntry {
  id: string;
  title: string;
  platform: 'instagram' | 'linkedin' | 'youtube' | 'twitter' | 'facebook';
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'published' | 'archived';
  due_date: string | null;
  assigned_to: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVideoProject {
  id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'published' | 'archived';
  platform: string;
  due_date: string | null;
  editor_id: string | null;
  footage_url: string | null;
  final_url: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── SEO Module ─────────────────────────────────────────────────────────────

export interface SEOKeywordTracker {
  id: string;
  keyword: string;
  url: string | null;
  current_position: number | null;
  target_position: number | null;
  search_volume: number | null;
  status: 'tracking' | 'improving' | 'achieved' | 'declined' | 'paused';
  priority: 'high' | 'medium' | 'low';
  notes: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOTaskLog {
  id: string;
  title: string;
  task_type: 'on_page' | 'technical' | 'content' | 'backlink' | 'local_seo' | 'other';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  page_url: string | null;
  keyword: string | null;
  due_date: string | null;
  assigned_to: string | null;
  notes: string;
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
  gap: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOContentBrief {
  id: string;
  title: string;
  target_keyword: string;
  target_url: string | null;
  status: 'draft' | 'writing' | 'review' | 'published' | 'archived';
  word_count_target: number | null;
  word_count_actual: number | null;
  assigned_to: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SEOPageHealth {
  id: string;
  url: string;
  status_code: number | null;
  load_time_ms: number | null;
  mobile_score: number | null;
  desktop_score: number | null;
  issues: unknown[];
  last_checked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Meta / Ads Module ──────────────────────────────────────────────────────

export interface MetaCampaignTracker {
  id: string;
  campaign_id: string;
  campaign_name: string;
  log_date: string;
  action: 'scale_up' | 'scale_down' | 'pause' | 'restart' | 'adjust_audience' | 'adjust_creative' | 'no_change' | 'kill';
  notes: string;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaCreativeTracker {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  status: 'active' | 'watch' | 'fatigued' | 'retired' | 'top_performer';
  fatigue_score: number | null;
  notes: string;
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
  planned_budget: number; // paise
  actual_spend: number; // paise
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaConversionLog {
  id: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  lead_name: string;
  lead_phone: string;
  lead_email: string;
  lead_quality: 'hot' | 'warm' | 'cold' | 'junk';
  conversion_status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  revenue_amount: number; // paise
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaSpendForecast {
  id: string;
  month: string;
  campaign_id: string;
  campaign_name: string;
  projected_spend: number; // paise
  projected_roas: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaAnomalyAlert {
  id: string;
  campaign_id: string;
  campaign_name: string;
  metric: string;
  expected_value: number | null;
  actual_value: number | null;
  deviation_pct: number | null;
  detected_at: string;
  status: 'new' | 'acknowledged' | 'resolved' | 'false_positive';
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Analytics Module ───────────────────────────────────────────────────────

export interface AnalyticsDailySheet {
  id: string;
  sheet_date: string;
  meta_spend: number; // paise
  meta_leads: number;
  meta_cpl: number; // paise
  ghl_appointments: number;
  ghl_shows: number;
  revenue_collected: number; // paise
  notes: string;
  extra_data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsCohortMetric {
  id: string;
  cohort_month: string; // YYYY-MM
  metric_name: string;
  metric_value: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Automations Module ─────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SentEmail {
  id: string;
  template_id: string | null;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  variables: Record<string, unknown>;
  status: 'queued' | 'sent' | 'failed' | 'bounced';
  sent_at: string | null;
  error: string | null;
  resend_id: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ApiListResponse<T> {
  records: T[];
  _permissions: PermissionMatrix;
}

export interface ApiErrorResponse {
  error: string;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}
