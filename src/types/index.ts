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
