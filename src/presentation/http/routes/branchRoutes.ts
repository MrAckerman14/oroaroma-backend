import type { FastifyInstance } from 'fastify';
import { BranchUseCases } from '../../../application/branches/BranchUseCases.js';
import { branchIdSchema, branchMembersSchema, branchStatusSchema, createBranchSchema, updateBranchSchema } from '../schemas/branchSchemas.js';

export async function branchRoutes(app: FastifyInstance) {
  const branches = new BranchUseCases(app.container.prisma);
  app.get('/branches', { preHandler: [app.authenticate, app.authorize('branches', 'read')] }, async (request) => ({ data: await branches.list(request.authUser!) }));
  app.get('/branches/users', { preHandler: [app.authenticate, app.authorize('branches', 'assign')] }, async (request) => ({ data: await branches.availableUsers(request.authUser!) }));
  app.post('/branches', { preHandler: [app.authenticate, app.authorize('branches', 'create')] }, async (request, reply) => reply.status(201).send({ data: await branches.create(request.authUser!, createBranchSchema.parse(request.body)) }));
  app.patch('/branches/:id', { preHandler: [app.authenticate, app.authorize('branches', 'update')] }, async (request) => { const { id } = branchIdSchema.parse(request.params); return { data: await branches.update(request.authUser!, id, updateBranchSchema.parse(request.body)) }; });
  app.patch('/branches/:id/status', { preHandler: [app.authenticate, app.authorize('branches', 'update')] }, async (request) => { const { id } = branchIdSchema.parse(request.params); const { status } = branchStatusSchema.parse(request.body); return { data: await branches.updateStatus(request.authUser!, id, status) }; });
  app.put('/branches/:id/members', { preHandler: [app.authenticate, app.authorize('branches', 'assign')] }, async (request) => { const { id } = branchIdSchema.parse(request.params); const input = branchMembersSchema.parse(request.body); return { data: await branches.replaceMembers(request.authUser!, id, input.userIds, input.primaryUserIds) }; });
}
