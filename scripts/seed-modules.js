const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  "https://cmscpwbnibimzhduawzs.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc2Nwd2JuaWJpbXpoZHVhd3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgxMTMyNCwiZXhwIjoyMDg4Mzg3MzI0fQ.TkyFmL6THAVXFbTQ_sikTTr32AsEuNpgfd4ZQuVGIGo"
);

const MODULE_REGISTRY = [
  { name: "Sales", slug: "sales", description: "Sales pipeline, CRM, and revenue tracking", icon: "TrendingUp", parent_slug: null, path: "/m/sales", order: 1, is_active: true },
  { name: "GHL", slug: "ghl", description: "GoHighLevel integration", icon: "Zap", parent_slug: "sales", path: "/m/sales/ghl", order: 1, is_active: true },
  { name: "Calendar", slug: "calendar", description: "Appointments and bookings", icon: "Calendar", parent_slug: "ghl", path: "/m/sales/ghl/calendar", order: 1, is_active: true },
  { name: "Opportunities", slug: "opportunities", description: "Pipeline and deals", icon: "Target", parent_slug: "ghl", path: "/m/sales/ghl/opportunities", order: 2, is_active: true },
  { name: "Sales Pipeline", slug: "pipeline", description: "Pipeline tracking and management", icon: "ClipboardList", parent_slug: "sales", path: "/m/sales/pipeline", order: 2, is_active: true },
  { name: "Meetings", slug: "meetings", description: "Meeting management and tracking", icon: "Calendar", parent_slug: "pipeline", path: "/m/sales/pipeline/meetings", order: 2, is_active: true },
  { name: "Maverick", slug: "maverick", description: "Maverick meeting workspace", icon: "Zap", parent_slug: "meetings", path: "/m/sales/pipeline/meetings/maverick", order: 1, is_active: true },
  { name: "Meet Management", slug: "meet-management", description: "Maverick lead and meeting tracking", icon: "ClipboardList", parent_slug: "maverick", path: "/m/sales/pipeline/meetings/maverick/meet-management", order: 1, is_active: true },
  { name: "Sales Management", slug: "maverick-sales", description: "Won deals tracking and cash collection", icon: "DollarSign", parent_slug: "maverick", path: "/m/sales/pipeline/meetings/maverick/sales-management", order: 2, is_active: true },
  { name: "Analytics", slug: "maverick-analytics", description: "Meeting and revenue performance analytics", icon: "BarChart3", parent_slug: "maverick", path: "/m/sales/pipeline/meetings/maverick/analytics", order: 3, is_active: true },
  { name: "Calendar", slug: "maverick-calendar", description: "Maverick appointment calendar", icon: "Calendar", parent_slug: "maverick", path: "/m/sales/pipeline/meetings/maverick/calendar", order: 4, is_active: true },
  { name: "Jobin", slug: "jobin", description: "Jobin meeting workspace", icon: "Zap", parent_slug: "meetings", path: "/m/sales/pipeline/meetings/jobin", order: 2, is_active: true },
  { name: "Meet Management", slug: "jobin-meet", description: "Jobin lead and meeting tracking", icon: "ClipboardList", parent_slug: "jobin", path: "/m/sales/pipeline/meetings/jobin/meet-management", order: 1, is_active: true },
  { name: "Sales Management", slug: "jobin-sales", description: "Won deals tracking and cash collection", icon: "DollarSign", parent_slug: "jobin", path: "/m/sales/pipeline/meetings/jobin/sales-management", order: 2, is_active: true },
  { name: "Analytics", slug: "jobin-analytics", description: "Meeting and revenue performance analytics", icon: "BarChart3", parent_slug: "jobin", path: "/m/sales/pipeline/meetings/jobin/analytics", order: 3, is_active: true },
  { name: "Calendar", slug: "jobin-calendar", description: "Jobin appointment calendar", icon: "Calendar", parent_slug: "jobin", path: "/m/sales/pipeline/meetings/jobin/calendar", order: 4, is_active: true },
  { name: "Sales Setting", slug: "sales-setting", description: "Sales tracking sheets and settings", icon: "Settings", parent_slug: "pipeline", path: "/m/sales/pipeline/settings", order: 1, is_active: true },
  { name: "Onboarding", slug: "onboarding", description: "Client onboarding and brand assessment", icon: "ClipboardList", parent_slug: "pipeline", path: "/m/sales/pipeline/onboarding", order: 3, is_active: true },
  { name: "Management", slug: "onboarding-management", description: "Onboarding management and checklist tracking", icon: "ClipboardList", parent_slug: "onboarding", path: "/m/sales/pipeline/onboarding/management", order: 1, is_active: true },
  { name: "Analytics", slug: "onboarding-analytics", description: "Onboarding performance analytics", icon: "BarChart3", parent_slug: "onboarding", path: "/m/sales/pipeline/onboarding/analytics", order: 2, is_active: true },
  { name: "Marketing", slug: "marketing", description: "Ad campaigns, analytics, and marketing tools", icon: "Megaphone", parent_slug: null, path: "/m/marketing", order: 2, is_active: true },
  { name: "Meta", slug: "meta", description: "Facebook & Instagram Ads", icon: "Share2", parent_slug: "marketing", path: "/m/marketing/meta", order: 1, is_active: true },
  { name: "Campaigns", slug: "meta-campaigns", description: "Ad campaigns overview", icon: "BarChart3", parent_slug: "meta", path: "/m/marketing/meta/campaigns", order: 1, is_active: true },
  { name: "Ad Sets", slug: "meta-adsets", description: "Ad set management", icon: "Layers", parent_slug: "meta", path: "/m/marketing/meta/adsets", order: 2, is_active: true },
  { name: "Ads", slug: "meta-ads", description: "Individual ads", icon: "Image", parent_slug: "meta", path: "/m/marketing/meta/ads", order: 3, is_active: true },
  { name: "Analytics", slug: "meta-analytics", description: "Demographic & breakdown analytics", icon: "PieChart", parent_slug: "meta", path: "/m/marketing/meta/analytics", order: 4, is_active: true },
  { name: "SEO", slug: "seo", description: "Search Console, keywords & Google Business Profile", icon: "Search", parent_slug: "marketing", path: "/m/marketing/seo", order: 2, is_active: true },
  { name: "Content", slug: "content", description: "Ad creatives, social media, and video editing", icon: "FileText", parent_slug: "marketing", path: "/m/marketing/content", order: 3, is_active: true },
  { name: "Payments", slug: "payments", description: "Payment tracking, settlements & revenue analytics", icon: "CreditCard", parent_slug: null, path: "/m/payments", order: 3, is_active: true },
  { name: "Admin", slug: "admin", description: "User management, roles & permissions", icon: "Shield", parent_slug: null, path: "/m/admin", order: 99, is_active: true },
  { name: "People", slug: "admin-people", description: "Manage users and invitations", icon: "Users", parent_slug: "admin", path: "/m/admin/people", order: 1, is_active: true },
  { name: "Roles", slug: "admin-roles", description: "Role definitions and management", icon: "Key", parent_slug: "admin", path: "/m/admin/roles", order: 2, is_active: true },
  { name: "Permissions", slug: "admin-permissions", description: "Role-module access and user overrides", icon: "Shield", parent_slug: "admin", path: "/m/admin/permissions", order: 3, is_active: true },
  { name: "Audit Log", slug: "admin-audit", description: "Activity logs and audit trail", icon: "ScrollText", parent_slug: "admin", path: "/m/admin/audit-log", order: 4, is_active: true },
];

async function main() {
  // Upsert all modules
  const { data, error } = await sb
    .from("modules")
    .upsert(MODULE_REGISTRY, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    console.log("ERROR inserting modules:", error.message);
    return;
  }
  console.log("Upserted", data.length, "modules");

  // Assign ALL modules to CTO role
  const ctoRoleId = "f50e694d-40d2-4db6-8b8d-3762a0f4a666";
  const assignments = data.map((m) => ({ role_id: ctoRoleId, module_id: m.id }));

  const { error: rmErr } = await sb
    .from("role_modules")
    .upsert(assignments, { onConflict: "role_id,module_id" });

  if (rmErr) {
    console.log("ERROR assigning role_modules:", rmErr.message);
  } else {
    console.log("Assigned all", assignments.length, "modules to CTO");
  }
}

main();
