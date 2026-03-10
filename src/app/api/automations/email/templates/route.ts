import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authenticateRequest, requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin(req);
  if ("error" in result) return result.error;

  try {
    const body = await req.json();
    const { slug, name, subject, html_body, variables } = body;

    if (!slug || !name || !subject || !html_body) {
      return NextResponse.json({ error: "slug, name, subject, and html_body are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .insert({
        slug,
        name,
        subject,
        html_body,
        variables: variables || [],
        updated_by: result.auth.userId,
      })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      user_id: result.auth.userId,
      tier: 1,
      action: "email_template_created",
      module: "automations",
      breadcrumb: "APEX OS > Automations > Email > Templates",
      entity_type: "email_template",
      entity_id: data.id,
      after_value: { slug, name, subject },
    });

    return NextResponse.json({ template: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireAdmin(req);
  if ("error" in result) return result.error;

  try {
    const body = await req.json();
    const { id, name, subject, html_body, variables } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Fetch before state for audit
    const { data: before } = await supabaseAdmin
      .from("email_templates")
      .select("name, subject")
      .eq("id", id)
      .single();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: result.auth.userId };
    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (html_body !== undefined) updates.html_body = html_body;
    if (variables !== undefined) updates.variables = variables;

    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Tier 1 audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: result.auth.userId,
      tier: 1,
      action: "email_template_updated",
      module: "automations",
      breadcrumb: "APEX OS > Automations > Email > Templates",
      entity_type: "email_template",
      entity_id: id,
      before_value: before,
      after_value: { name: data.name, subject: data.subject },
    });

    return NextResponse.json({ template: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireAdmin(req);
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data: before } = await supabaseAdmin
      .from("email_templates")
      .select("slug, name")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      user_id: result.auth.userId,
      tier: 1,
      action: "email_template_deleted",
      module: "automations",
      breadcrumb: "APEX OS > Automations > Email > Templates",
      entity_type: "email_template",
      entity_id: id,
      before_value: before,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
