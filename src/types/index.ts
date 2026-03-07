export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role_id: string;
  role?: Role;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_admin: boolean;
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
}

export interface AuditLog {
  id: string;
  user_id: string;
  tier: 1 | 2;
  action: string;
  module: string;
  breadcrumb_path: string;
  details: Record<string, unknown>;
  before_value?: Record<string, unknown>;
  after_value?: Record<string, unknown>;
  created_at: string;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}
