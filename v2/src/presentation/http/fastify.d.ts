import type { AppContainer } from '../../application/Container.js';
import type { AuthenticatedUser, RbacAction, RbacResource } from '../../types/rbac.js';
import type { preHandlerHookHandler } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
    authenticate: preHandlerHookHandler;
    authorize: (resource: RbacResource, action: RbacAction) => preHandlerHookHandler;
  }

  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}
