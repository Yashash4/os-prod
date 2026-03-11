import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const result = await requireModuleAccess(req, "finance");
  if ("error" in result) return result.error;

  const url = req.nextUrl;
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");

  // Default to current month if no range provided
  if (!from || !to) {
    const now = new Date();
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  // Get expenses in range
  const { data: expenses, error } = await supabaseAdmin
    .from("expenses")
    .select("amount, category_id, category:expense_categories(name)")
    .gte("date", from)
    .lte("date", to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = expenses || [];
  const total_expenses = rows.reduce((sum: number, e: { amount: number }) => sum + (e.amount || 0), 0);

  // Group by category
  const catMap: Record<string, { name: string; amount: number }> = {};
  for (const e of rows) {
    const exp = e as unknown as { amount: number; category_id: string | null; category: { name: string }[] | { name: string } | null };
    const cat = Array.isArray(exp.category) ? exp.category[0] : exp.category;
    const catName = cat?.name || "Uncategorized";
    const catId = exp.category_id || "none";
    if (!catMap[catId]) catMap[catId] = { name: catName, amount: 0 };
    catMap[catId].amount += exp.amount || 0;
  }

  const by_category = Object.values(catMap).sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    total_expenses,
    by_category,
    period: { from, to },
  });
}
