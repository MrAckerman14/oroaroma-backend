import type { FastifyInstance } from 'fastify';
import { InventoryUseCases } from '../../../application/inventory/InventoryUseCases.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import type { AuthenticatedUser } from '../../../types/rbac.js';
import { dateRangePaginationQuerySchema, dateRangeQuerySchema, idParamsSchema, paginationQuerySchema } from '../schemas/commonSchemas.js';
import { createInventoryReportSchema, updateInventoryReportSchema } from '../schemas/inventorySchemas.js';

export async function inventoryRoutes(app: FastifyInstance) {
  const inventory = new InventoryUseCases(app.container.prisma);

  app.get(
    '/inventory/review',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'read')] },
    async (request) => {
      requireGlobalInventoryReportAccess(request.authUser!);
      const query = paginationQuerySchema.parse(request.query);
      return { data: await inventory.review(query) };
    }
  );

  app.get(
    '/inventory/reports/preview',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'read')] },
    async (request) => {
      requireGlobalInventoryReportAccess(request.authUser!);
      const query = paginationQuerySchema.parse(request.query);
      return { data: await inventory.review(query) };
    }
  );

  app.post(
    '/inventory/reports',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'create')] },
    async (request, reply) => {
      const query = dateRangeQuerySchema.parse(request.query);
      const body = createInventoryReportSchema.parse(request.body ?? {});
      const report = await inventory.save(request.authUser!, { ...query, ...body });
      return reply.status(201).send({ data: report });
    }
  );

  app.get(
    '/inventory/reports',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'read')] },
    async (request) => {
      requireGlobalInventoryReportAccess(request.authUser!);
      const query = dateRangePaginationQuerySchema.parse(request.query);
      return { data: await inventory.list(request.authUser!, query) };
    }
  );

  app.get(
    '/inventory/reports/:id',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'read')] },
    async (request) => {
      requireGlobalInventoryReportAccess(request.authUser!);
      const params = idParamsSchema.parse(request.params);
      const query = paginationQuerySchema.parse(request.query);
      return { data: await inventory.detail(params.id, request.authUser!, query) };
    }
  );

  app.delete(
    '/inventory/reports/:id',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await inventory.softDelete(params.id);
      return reply.status(204).send();
    }
  );

  app.put(
    '/inventory/reports/:id',
    { preHandler: [app.authenticate, app.authorize('inventory-reports', 'create')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateInventoryReportSchema.parse(request.body);
      return { data: await inventory.update(params.id, input) };
    }
  );
}

function requireGlobalInventoryReportAccess(actor: AuthenticatedUser) {
  const canGlobal = actor.permissions.some((permission) => {
    return permission.key === 'inventory-reports:read:global';
  });

  if (!canGlobal) {
    throw new ForbiddenError('Permiso requerido para leer reportes de inventario');
  }
}
