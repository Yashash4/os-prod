import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { resolveDataScope } from '@/lib/data-scope';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile with role and scope info.
 * Lightweight endpoint for AuthContext to populate app user state.
 */
export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req);
  if ('error' in result) return result.error;

  const { auth } = result;

  // Fetch user profile with role join
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, avatar_url, role_id, roles(id, name, is_admin)')
    .eq('id', auth.userId)
    .single();

  if (!userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Resolve scope to get scopeSlug
  const scope = await resolveDataScope(auth.userId, auth.roleId, auth.isAdmin);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = userData.roles as any;

  return NextResponse.json({
    user: {
      id: userData.id,
      email: userData.email,
      fullName: userData.full_name,
      avatarUrl: userData.avatar_url,
      role: role
        ? {
            id: role.id,
            name: role.name,
            isAdmin: role.is_admin,
          }
        : null,
      scopeSlug: scope.scopeLevel.slug,
    },
  });
}
