import type { FastifyInstance, FastifyRequest } from 'fastify';
import { TenantUseCases } from '../../../application/tenancy/TenantUseCases.js';
import { platformAdminEmails } from '../../../config/env.js';
import { ForbiddenError } from '../../../shared/errors/AppError.js';
import { createTenantSchema, tenantIdSchema, tenantStatusSchema } from '../schemas/tenantSchemas.js';

export async function tenantRoutes(app: FastifyInstance) {
  const tenants = new TenantUseCases(app.container.prisma, app.container.passwordHasher);
  const platformOnly = async (request: FastifyRequest) => {
    if (!request.authUser || !platformAdminEmails.has(request.authUser.email.toLowerCase())) {
      throw new ForbiddenError('Solo el administrador de plataforma puede gestionar empresas');
    }
  };

  app.get('/tenants', { preHandler: [app.authenticate, platformOnly] }, async () => ({ data: await tenants.list() }));
  app.post('/tenants', { preHandler: [app.authenticate, platformOnly] }, async (request, reply) => {
    const created = await tenants.create(createTenantSchema.parse(request.body));
    return reply.status(201).send({ data: created, message: 'Empresa creada correctamente' });
  });
  app.patch('/tenants/:id/status', { preHandler: [app.authenticate, platformOnly] }, async (request) => {
    const { id } = tenantIdSchema.parse(request.params);
    const { status } = tenantStatusSchema.parse(request.body);
    return { data: await tenants.updateStatus(id, status) };
  });
}
