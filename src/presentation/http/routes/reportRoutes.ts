import type { FastifyInstance } from 'fastify';
import { ReportUseCases } from '../../../application/reports/ReportUseCases.js';
import {
  dateRangePaginationQuerySchema,
  dateRangeQuerySchema,
  idParamsSchema,
  paginationQuerySchema
} from '../schemas/commonSchemas.js';
import { closureStatusSchema, createCashClosureSchema, updateCashClosureSchema } from '../schemas/reportSchemas.js';

export async function reportRoutes(app: FastifyInstance) {
  const reports = new ReportUseCases(app.container.prisma);

  app.get(
    '/reports/cash-reconciliation',
    { preHandler: [app.authenticate, app.authorize('reports', 'cash')] },
    async (request) => {
      const query = dateRangeQuerySchema.parse(request.query);
      return { data: await reports.cashReconciliation(request.authUser!, query) };
    }
  );

  app.post(
    '/cash-closures/preview',
    { preHandler: [app.authenticate, app.authorize('reports', 'cash')] },
    async (request) => {
      const query = dateRangeQuerySchema.parse(request.query);
      const body = createCashClosureSchema.parse(request.body ?? {});
      return { data: await reports.cashReconciliation(request.authUser!, { ...query, ...body }) };
    }
  );

  app.post(
    '/cash-closures',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'create')] },
    async (request, reply) => {
      const query = dateRangeQuerySchema.parse(request.query);
      const body = createCashClosureSchema.parse(request.body ?? {});
      const closure = await reports.createCashClosure(request.authUser!, { ...query, ...body });
      return reply.status(201).send({ data: closure });
    }
  );

  app.get(
    '/cash-closures',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'read')] },
    async (request) => {
      const query = dateRangePaginationQuerySchema.parse(request.query);
      return { data: await reports.listClosures(request.authUser!, query) };
    }
  );

  app.get(
    '/cash-closures/:id',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'read')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const query = paginationQuerySchema.parse(request.query);
      return { data: await reports.closureDetails(request.authUser!, params.id, query) };
    }
  );

  app.put(
    '/cash-closures/:id',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'verify')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateCashClosureSchema.parse(request.body);
      return { data: await reports.updateClosure(params.id, input) };
    }
  );

  app.put(
    '/cash-closures/:id/status',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'verify')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = closureStatusSchema.parse(request.body);
      return { data: await reports.updateClosureStatus(params.id, input.status) };
    }
  );

  app.delete(
    '/cash-closures/:id',
    { preHandler: [app.authenticate, app.authorize('cash-closures', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await reports.softDeleteClosure(params.id);
      return reply.status(204).send();
    }
  );
}
