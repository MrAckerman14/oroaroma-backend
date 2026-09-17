export const platformPermissionKeys = [
  'platform:tenants:read',
  'platform:tenants:create',
  'platform:tenants:update',
  'platform:modules:manage',
  'platform:security:read'
] as const;

export const tenantModuleKeys = [
  'sales',
  'users',
  'messengers',
  'inventory',
  'cash-closures',
  'inventory-reports',
  'expenses'
] as const;

export type PlatformPermissionKey = (typeof platformPermissionKeys)[number];
export type TenantModuleKey = (typeof tenantModuleKeys)[number];
