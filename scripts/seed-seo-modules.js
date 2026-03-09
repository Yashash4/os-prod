const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const NEW_MODULES = [
  { name: "Keyword Tracker", slug: "seo-keyword-tracker", description: "Track target keywords with position goals", icon: "Crosshair", parent_slug: "seo", path: "/m/marketing/seo/keyword-tracker", order: 7, is_active: true },
  { name: "Task Log", slug: "seo-task-log", description: "SEO and content task management", icon: "CheckSquare", parent_slug: "seo", path: "/m/marketing/seo/task-log", order: 8, is_active: true },
  { name: "Competitor Tracker", slug: "seo-competitor-tracker", description: "Monitor competitor keyword rankings", icon: "Swords", parent_slug: "seo", path: "/m/marketing/seo/competitor-tracker", order: 9, is_active: true },
  { name: "Content Briefs", slug: "seo-content-briefs", description: "Content brief creation and tracking", icon: "FileEdit", parent_slug: "seo", path: "/m/marketing/seo/content-briefs", order: 10, is_active: true },
  { name: "Rank Analysis", slug: "seo-rank-analysis", description: "Ranking performance analysis and quick wins", icon: "LineChart", parent_slug: "seo", path: "/m/marketing/seo/rank-analysis", order: 11, is_active: true },
  { name: "Page Health", slug: "seo-page-health", description: "Page-level health monitoring and scores", icon: "HeartPulse", parent_slug: "seo", path: "/m/marketing/seo/page-health", order: 12, is_active: true },
];

async function main() {
  const { data, error } = await sb
    .from("modules")
    .upsert(NEW_MODULES, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    console.log("ERROR inserting modules:", error.message);
    return;
  }
  console.log("Upserted", data.length, "modules:", data.map(m => m.slug).join(", "));

  const { data: roles, error: roleErr } = await sb
    .from("roles")
    .select("id, name")
    .in("name", ["CTO", "CMTO"]);

  if (roleErr) {
    console.log("ERROR fetching roles:", roleErr.message);
    return;
  }
  console.log("Found roles:", roles.map(r => `${r.name} (${r.id})`).join(", "));

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
