import type { AppContainer } from '../../application/Container.js';
import type { AuthenticatedUser, RbacAction, RbacResource } from '../../types/rbac.js';
import type { preHandlerHookHandler } from 'fastify';
import type { PlatformPermissionKey, TenantModuleKey } from '../../types/platform.js';

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
    authenticate: preHandlerHookHandler;
    authorize: (resource: RbacResource, action: RbacAction) => preHandlerHookHandler;
    authorizePlatform: (permission: PlatformPermissionKey) => preHandlerHookHandler;
    requireTenantModule: (moduleKey: TenantModuleKey) => preHandlerHookHandler;
  }

  interface FastifyRequest {
    tenantId?: string;
    authUser?: AuthenticatedUser;
    branchId: string;
  }
}
