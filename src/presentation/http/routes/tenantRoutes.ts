import type { FastifyInstance } from 'fastify';
import { TenantUseCases } from '../../../application/tenancy/TenantUseCases.js';
import { createTenantSchema, tenantIdSchema, tenantModulesSchema, tenantStatusSchema } from '../schemas/tenantSchemas.js';

export async function tenantRoutes(app: FastifyInstance) {
  const tenants = new TenantUseCases(app.container.prisma, app.container.passwordHasher);
  app.get('/tenants', { preHandler: [app.authenticate, app.authorizePlatform('platform:tenants:read')] }, async () => ({ data: await tenants.list() }));
  app.post('/tenants', { preHandler: [app.authenticate, app.authorizePlatform('platform:tenants:create')] }, async (request, reply) => {
    const created = await tenants.create(createTenantSchema.parse(request.body));
    return reply.status(201).send({ data: created, message: 'Empresa creada correctamente' });
  });
  app.patch('/tenants/:id/status', { preHandler: [app.authenticate, app.authorizePlatform('platform:tenants:update')] }, async (request) => {
    const { id } = tenantIdSchema.parse(request.params);
    const { status } = tenantStatusSchema.parse(request.body);
    return { data: await tenants.updateStatus(id, status) };
  });

  app.get('/platform/modules', { preHandler: [app.authenticate, app.authorizePlatform('platform:tenants:read')] }, async () => ({
    data: await tenants.listModuleCatalog()
  }));

  app.put('/tenants/:id/modules', { preHandler: [app.authenticate, app.authorizePlatform('platform:modules:manage')] }, async (request) => {
    const { id } = tenantIdSchema.parse(request.params);
    const { modules } = tenantModulesSchema.parse(request.body);
    return { data: await tenants.updateModules(id, modules) };
  });

  app.get('/platform/security', { preHandler: [app.authenticate, app.authorizePlatform('platform:security:read')] }, async () => ({
    data: await tenants.platformSecurityOverview()
  }));
}
