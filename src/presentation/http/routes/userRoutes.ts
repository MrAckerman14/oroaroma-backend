import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserUseCases } from '../../../application/users/UserUseCases.js';
import { dateRangePaginationQuerySchema, idParamsSchema } from '../schemas/commonSchemas.js';
import { assignRoleSchema, createUserSchema, updateUserSchema } from '../schemas/userSchemas.js';

const userOptionQuerySchema = dateRangePaginationQuerySchema.extend({
  includeStats: z.preprocess((value) => value === true || value === 'true', z.boolean()).optional()
});

export async function userRoutes(app: FastifyInstance) {
  const users = new UserUseCases(app.container.prisma, app.container.passwordHasher);

  app.get(
    '/users',
    { preHandler: [app.authenticate, app.authorize('users', 'read')] },
    async (request) => {
      const query = dateRangePaginationQuerySchema.parse(request.query);
      return { data: await users.dashboard(query) };
    }
  );

  app.get(
    '/users/plain',
    { preHandler: [app.authenticate] },
    async (request) => {
      const query = userOptionQuerySchema.parse(request.query);
      return { data: await users.listOptions(query, request.authUser) };
    }
  );

  app.post(
    '/users',
    { preHandler: [app.authenticate, app.authorize('users', 'create')] },
    async (request, reply) => {
      const input = createUserSchema.parse(request.body);
      const user = await users.create(input);
      return reply.status(201).send({ data: user });
    }
  );

  app.put(
    '/users/:id',
    { preHandler: [app.authenticate, app.authorize('users', 'update')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = updateUserSchema.parse(request.body);
      return { data: await users.update(params.id, input) };
    }
  );

  app.delete(
    '/users/:id',
    { preHandler: [app.authenticate, app.authorize('users', 'delete')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      await users.softDelete(params.id);
      return reply.status(204).send();
    }
  );

  app.post(
    '/users/:id/roles',
    { preHandler: [app.authenticate, app.authorize('roles', 'assign')] },
    async (request, reply) => {
      const params = idParamsSchema.parse(request.params);
      const input = assignRoleSchema.parse(request.body);
      const assignment = await users.assignRole(params.id, input);
      return reply.status(201).send({ data: assignment });
    }
  );

  app.put(
    '/users/:id/roles',
    { preHandler: [app.authenticate, app.authorize('roles', 'assign')] },
    async (request) => {
      const params = idParamsSchema.parse(request.params);
      const input = assignRoleSchema.parse(request.body);
      return { data: await users.replaceRole(params.id, input) };
    }
  );

  app.get(
    '/roles',
    { preHandler: [app.authenticate, app.authorize('roles', 'assign')] },
    async () => ({ data: await users.listRoles() })
  );
}
