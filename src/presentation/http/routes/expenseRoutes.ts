import type { FastifyInstance } from 'fastify';
import { ExpenseUseCases } from '../../../application/expenses/ExpenseUseCases.js';
import { dateRangePaginationQuerySchema, dateRangeQuerySchema, idParamsSchema } from '../schemas/commonSchemas.js';
import {
  createExpenseCategorySchema,
  createExpenseControlSchema,
  createExpenseReportSchema,
  updateExpenseControlSchema,
  updateExpenseReportSchema
} from '../schemas/expenseSchemas.js';

export async function expenseRoutes(app: FastifyInstance) {
  const expenses = new ExpenseUseCases(app.container.prisma);

  app.get('/expense-categories', { preHandler: [app.authenticate, app.authorize('expense-controls', 'read')] }, async (request) => ({
    data: await expenses.listCategories(request.authUser!)
  }));

  app.post('/expense-categories', { preHandler: [app.authenticate, app.authorize('expense-controls', 'create')] }, async (request, reply) => {
    const input = createExpenseCategorySchema.parse(request.body);
    return reply.status(201).send({ data: await expenses.createCategory(request.authUser!, input.name) });
  });

  app.delete('/expense-categories/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'delete')] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await expenses.removeCategory(request.authUser!, id);
    return reply.status(204).send();
  });

  app.get('/expense-controls', { preHandler: [app.authenticate, app.authorize('expense-controls', 'read')] }, async (request) => ({
    data: await expenses.list(request.authUser!, request.branchId, dateRangePaginationQuerySchema.parse(request.query))
  }));

  app.post('/expense-controls', { preHandler: [app.authenticate, app.authorize('expense-controls', 'create')] }, async (request, reply) => {
    const input = createExpenseControlSchema.parse(request.body);
    return reply.status(201).send({ data: await expenses.create(request.authUser!, request.branchId, input) });
  });

  app.patch('/expense-controls/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'update')] }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await expenses.update(request.authUser!, id, updateExpenseControlSchema.parse(request.body), request.branchId) };
  });

  app.delete('/expense-controls/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'delete')] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await expenses.remove(request.authUser!, id, request.branchId);
    return reply.status(204).send();
  });

  app.get('/expense-controls/reports/preview', { preHandler: [app.authenticate, app.authorize('expense-controls', 'read')] }, async (request) => ({
    data: await expenses.preview(request.authUser!, request.branchId, dateRangeQuerySchema.parse(request.query))
  }));

  app.post('/expense-controls/reports', { preHandler: [app.authenticate, app.authorize('expense-controls', 'export')] }, async (request, reply) => {
    const report = await expenses.createReport(request.authUser!, request.branchId, createExpenseReportSchema.parse(request.body));
    return reply.status(201).send({ data: report });
  });

  app.get('/expense-controls/reports', { preHandler: [app.authenticate, app.authorize('expense-controls', 'read')] }, async (request) => ({
    data: await expenses.listReports(request.authUser!, request.branchId, dateRangePaginationQuerySchema.parse(request.query))
  }));

  app.get('/expense-controls/reports/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'read')] }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await expenses.reportDetail(request.authUser!, id, request.branchId) };
  });

  app.put('/expense-controls/reports/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'update')] }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await expenses.updateReport(request.authUser!, id, updateExpenseReportSchema.parse(request.body), request.branchId) };
  });

  app.delete('/expense-controls/reports/:id', { preHandler: [app.authenticate, app.authorize('expense-controls', 'delete')] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await expenses.removeReport(request.authUser!, id, request.branchId);
    return reply.status(204).send();
  });
}
