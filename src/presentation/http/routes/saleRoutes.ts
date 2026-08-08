import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CreateSaleUseCase } from '../../../application/sales/CreateSaleUseCase.js';
import { SaleUseCases } from '../../../application/sales/SaleUseCases.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { hasRoleKey } from '../../../shared/utils/roleKeys.js';
import { dateRangePaginationQuerySchema, idParamsSchema } from '../schemas/commonSchemas.js';
import { createSaleSchema, updateSaleSchema } from '../schemas/saleSchemas.js';

export async function saleRoutes(app: FastifyInstance) {
  const createSale = new CreateSaleUseCase(app.container.prisma);
  const sales = new SaleUseCases(app.container.prisma);

  app.get(
    '/sales',
    { preHandler: [app.authenticate, app.authorize('sales', 'read')] },
    async (request) => {
      const query = dateRangePaginationQuerySchema.extend({
        status: updateSaleSchema.shape.status
      }).parse(request.query);
      return { data: await sales.list(request.authUser!, query) };
    }
  );

  app.post(
    '/sales',
    { preHandler: [app.authenticate, canCreateSales] },
    async (request, reply) => {
      const input = createSaleSchema.parse(request.body);
      const canCreateForOthers = request.authUser!.permissions.some((permission) => {
        return permission.key === 'sales:create:global';
      });

      if (input.employeeId && input.employeeId !== request.authUser!.id && !canCreateForOthers) {
        throw new ForbiddenError('No puedes crear ventas para otro colaborador');
      }

      const sale = await createSale.execute(input.employeeId ?? request.authUser!.id, input);
      return reply.status(201).send({ data: sale });
    }
  );

  app.put(
    '/sales/:id',
    { preHandler: [app.authenticate, app.authorize('sales', 'update')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateSaleSchema.parse(request.body);
      return { data: await sales.update(params.id, request.authUser!, input) };
    }
  );

  app.delete(
    '/sales/:id',
    { preHandler: [app.authenticate, app.authorize('sales', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await sales.softDelete(params.id, request.authUser!);
      return reply.status(204).send();
    }
  );
}

async function canCreateSales(request: FastifyRequest) {
  const actor = request.authUser;
  const hasPermission = actor?.permissions.some((permission) => {
    return permission.resource === 'sales' && permission.action === 'create';
  }) ?? false;
  const hasRole = actor?.roles.some((role) => hasRoleKey(role.roleKey, ['admin', 'employee', 'supervisor'])) ?? false;

  if (!hasPermission || !hasRole) {
    throw new ForbiddenError('Permiso requerido para crear ventas');
  }
}
