export const userStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado'
};

export const saleStatusLabels: Record<string, string> = {
  DELIVERY_PENDING: 'Pendiente',
  FINALIZED: 'Finalizada',
  CANCELLED: 'Cancelada'
};

export const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto'
};

export const cashClosureStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  VOIDED: 'Anulado'
};

export const permissionResourceLabels: Record<string, string> = {
  users: 'usuarios',
  roles: 'roles',
  permissions: 'permisos',
  stores: 'productos',
  sales: 'ventas',
  'cash-closures': 'cierres de caja',
  'inventory-reports': 'reportes de inventario',
  reports: 'reportes',
  'audit-logs': 'auditoria'
};

export const permissionActionLabels: Record<string, string> = {
  create: 'crear',
  read: 'leer',
  update: 'editar',
  delete: 'eliminar',
  restore: 'restaurar',
  assign: 'asignar',
  finalize: 'finalizar',
  cancel: 'cancelar',
  verify: 'verificar',
  void: 'anular',
  export: 'exportar',
  cash: 'cuadrar caja',
  'cash-detail-messengers': 'ver detalle de mensajeros',
  'cash-detail-sellers': 'ver detalle de vendedores',
  'cash-detail-employees': 'ver detalle de colaboradores',
  inventory: 'inventario'
};

export const permissionScopeLabels: Record<string, string> = {
  global: 'global',
  store: 'tienda',
  own: 'propio',
  assigned: 'asignado'
};

export function labelFromMap(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return null;
  return map[value] ?? value;
}
