export const rbacResources = [
  'users',
  'roles',
  'permissions',
  'stores',
  'sales',
  'cash-closures',
  'inventory-reports',
  'reports',
  'audit-logs'
] as const;

export const rbacActions = [
  'create',
  'read',
  'update',
  'delete',
  'restore',
  'assign',
  'finalize',
  'cancel',
  'verify',
  'void',
  'export',
  'cash',
  'cash-detail-messengers',
  'cash-detail-sellers',
  'cash-detail-employees',
  'inventory'
] as const;

export const rbacScopes = ['global', 'store', 'own', 'assigned'] as const;

export type RbacResource = (typeof rbacResources)[number];
export type RbacAction = (typeof rbacActions)[number];
export type RbacScope = (typeof rbacScopes)[number];

export type PermissionKey = `${RbacResource}:${RbacAction}:${RbacScope}`;

export interface PermissionDescriptor {
  key: PermissionKey;
  resource: RbacResource;
  resourceLabel?: string | null;
  action: RbacAction;
  actionLabel?: string | null;
  scope: RbacScope;
  scopeLabel?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  statusLabel: string | null;
  roles: UserRoleContext[];
  permissions: PermissionDescriptor[];
}

export interface UserRoleContext {
  roleKey: string;
  scope: RbacScope;
  scopeLabel?: string | null;
  storeId?: string;
  expiresAt?: Date;
}

export interface AuthorizationRequest {
  actor: AuthenticatedUser;
  resource: RbacResource;
  action: RbacAction;
  ownerId?: string;
  storeId?: string;
  assignedUserIds?: string[];
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  matchedPermission?: PermissionKey;
}
