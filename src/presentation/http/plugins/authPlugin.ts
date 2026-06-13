import fp from 'fastify-plugin';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/AppError.js';
import { labelFromMap, permissionActionLabels, permissionResourceLabels } from '../../../shared/utils/spanishLabels.js';
import type { AccessTokenPayload } from '../../../types/auth.js';
import type { RbacAction, RbacResource } from '../../../types/rbac.js';

export const authPlugin = fp(async (app) => {
  app.decorate('authenticate', async (request) => {
    let payload: AccessTokenPayload;

    try {
      payload = await request.jwtVerify<AccessTokenPayload>();
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Token invalido o expirado');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedError('Token invalido');
    }

    const user = await app.container.users.findAuthenticatedById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    request.authUser = user;
  });

  app.decorate('authorize', (resource: RbacResource, action: RbacAction) => {
    return async (request) => {
      if (!request.authUser) {
        throw new UnauthorizedError();
      }

      const decision = app.container.rbacPolicy.can({
        actor: request.authUser,
        resource,
        action,
        ownerId: request.authUser.id
      });

      if (!decision.allowed) {
        const resourceLabel = labelFromMap(permissionResourceLabels, resource) ?? resource;
        const actionLabel = labelFromMap(permissionActionLabels, action) ?? action;
        throw new ForbiddenError(`Permiso requerido para ${actionLabel} ${resourceLabel}`);
      }
    };
  });
});
