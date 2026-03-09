const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Parse .env.local for credentials
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const NEW_MODULES = [
  { name: "Campaign Tracker", slug: "meta-campaign-tracker", description: "Daily campaign decision log", icon: "ClipboardList", parent_slug: "meta", path: "/m/marketing/meta/campaign-tracker", order: 5, is_active: true },
  { name: "Creative Tracker", slug: "meta-creative-tracker", description: "Creative fatigue monitoring", icon: "Palette", parent_slug: "meta", path: "/m/marketing/meta/creative-tracker", order: 6, is_active: true },
  { name: "Budget Planner", slug: "meta-budget-planner", description: "Planned vs actual budget tracking", icon: "Wallet", parent_slug: "meta", path: "/m/marketing/meta/budget-planner", order: 7, is_active: true },
  { name: "Conversion Log", slug: "meta-conversion-log", description: "Lead quality and conversion tracking", icon: "UserCheck", parent_slug: "meta", path: "/m/marketing/meta/conversion-log", order: 8, is_active: true },
  { name: "Creative Analysis", slug: "meta-creative-analysis", description: "Creative performance ranking and comparison", icon: "BarChart3", parent_slug: "meta", path: "/m/marketing/meta/creative-analysis", order: 9, is_active: true },
  { name: "Audience Insights", slug: "meta-audience-insights", description: "Cross-dimensional audience analysis", icon: "Users", parent_slug: "meta", path: "/m/marketing/meta/audience-insights", order: 10, is_active: true },
];

async function main() {
  // Upsert new modules
  const { data, error } = await sb
    .from("modules")
    .upsert(NEW_MODULES, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    console.log("ERROR inserting modules:", error.message);
    return;
  }
  console.log("Upserted", data.length, "modules:", data.map(m => m.slug).join(", "));

  // Get CTO and CMTO role IDs
  const { data: roles, error: roleErr } = await sb
    .from("roles")
    .select("id, name")
    .in("name", ["CTO", "CMTO"]);

  if (roleErr) {
    console.log("ERROR fetching roles:", roleErr.message);
    return;
  }

  console.log("Found roles:", roles.map(r => `${r.name} (${r.id})`).join(", "));

  // Assign modules to both roles
  const assignments = [];
  for (const role of roles) {
    for (const mod of data) {
      assignments.push({ role_id: role.id, module_id: mod.id });
    }
  }

  const { error: rmErr } = await sb
    .from("role_modules")
    .upsert(assignments, { onConflict: "role_id,module_id" });

  if (rmErr) {
    console.log("ERROR assigning role_modules:", rmErr.message);
  } else {
    console.log("Assigned", assignments.length, "role-module pairs to", roles.map(r => r.name).join(" + "));
  }
}

main();
