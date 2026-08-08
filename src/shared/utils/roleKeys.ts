const canonicalRoleAliases: Record<string, string> = {
  admin: 'admin',
  administrator: 'admin',
  administrador: 'admin',
  employee: 'employee',
  empleado: 'employee',
  vendedor: 'employee',
  supervisor: 'supervisor',
  collaborator: 'collaborator',
  colaborador: 'collaborator',
  seller: 'collaborator',
  messenger: 'messenger',
  mensajero: 'messenger'
};

export function canonicalRoleKey(roleKey: string | null | undefined) {
  if (!roleKey) return '';
  return canonicalRoleAliases[roleKey.trim().toLowerCase()] ?? roleKey.trim().toLowerCase();
}

export function roleQueryKeys(roleKey: string | null | undefined) {
  const canonical = canonicalRoleKey(roleKey);
  if (canonical === 'collaborator') return ['collaborator', 'seller'];
  return [canonical].filter(Boolean);
}

export function hasRoleKey(currentRoleKey: string | null | undefined, expectedRoleKeys: string[]) {
  const current = canonicalRoleKey(currentRoleKey);
  return expectedRoleKeys.some((role) => canonicalRoleKey(role) === current);
}
