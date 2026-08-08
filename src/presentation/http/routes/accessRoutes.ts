import type { FastifyInstance } from 'fastify';
import { canonicalRoleKey } from '../../../shared/utils/roleKeys.js';
import { roleLabels } from '../../../shared/utils/spanishLabels.js';

export async function accessRoutes(app: FastifyInstance) {
  app.get(
    '/access/my-permissions',
    { preHandler: [app.authenticate] },
    async (request) => ({
      roles: request.authUser?.roles.map((role) => {
        const roleName = roleLabels[canonicalRoleKey(role.roleKey)] ?? null;
        return {
          role: roleName,
          roleName,
          roleLabel: roleName,
          roleDisplayName: roleName,
          scope: role.scope,
          scopeLabel: role.scopeLabel
        };
      }) ?? [],
      permissions: request.authUser?.permissions ?? []
    })
  );
}
