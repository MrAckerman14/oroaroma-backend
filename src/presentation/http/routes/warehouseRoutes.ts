import type { FastifyInstance } from 'fastify';
import { WarehouseUseCases } from '../../../application/warehouses/WarehouseUseCases.js';
import { createInventoryTransferSchema, createWarehouseSchema, updateWarehouseSchema, warehouseIdSchema } from '../schemas/warehouseSchemas.js';

export async function warehouseRoutes(app: FastifyInstance) {
  const warehouses = new WarehouseUseCases(app.container.prisma);
  app.get('/warehouses', { preHandler: [app.authenticate, app.authorize('warehouses', 'read')] }, async (request) => ({ data: await warehouses.list(request.authUser!, request.branchId!) }));
  app.post('/warehouses', { preHandler: [app.authenticate, app.authorize('warehouses', 'create')] }, async (request, reply) => reply.status(201).send({ data: await warehouses.create(request.authUser!, request.branchId!, createWarehouseSchema.parse(request.body)) }));
  app.patch('/warehouses/:id', { preHandler: [app.authenticate, app.authorize('warehouses', 'update')] }, async (request) => {
    const { id } = warehouseIdSchema.parse(request.params);
    return { data: await warehouses.update(request.authUser!, request.branchId!, id, updateWarehouseSchema.parse(request.body)) };
  });
  app.get('/warehouses/transfers', { preHandler: [app.authenticate, app.authorize('warehouses', 'read')] }, async (request) => ({ data: await warehouses.listTransfers(request.authUser!, request.branchId!) }));
  app.post('/warehouses/transfers', { preHandler: [app.authenticate, app.authorize('warehouses', 'transfer')] }, async (request, reply) => reply.status(201).send({ data: await warehouses.transfer(request.authUser!, request.branchId!, createInventoryTransferSchema.parse(request.body)) }));
}
