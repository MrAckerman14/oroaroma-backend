import type { FastifyInstance } from 'fastify';

export async function accessRoutes(app: FastifyInstance) {
  app.get(
    '/access/my-permissions',
    { preHandler: [app.authenticate] },
    async (request) => ({
      roles: request.authUser?.roles ?? [],
      permissions: request.authUser?.permissions ?? []
    })
  );
}
