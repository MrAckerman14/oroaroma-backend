import type { FastifyInstance } from 'fastify';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function registerAuditHook(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    if (!mutatingMethods.has(request.method) || reply.statusCode >= 400) return;

    const url = request.url.split('?')[0] ?? request.url;
    if (url.startsWith('/docs')) return;

    const segments = url.split('/').filter(Boolean);
    const resource = segments[0] ?? 'unknown';
    const resourceId = segments.find((segment) => /^[0-9a-f-]{36}$/i.test(segment));

    try {
      await app.container.prisma.auditLog.create({
        data: {
          actorId: request.authUser?.id ?? null,
          action: request.method,
          resource,
          resourceId: resourceId ?? null,
          metadata: {
            url,
            statusCode: reply.statusCode
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      });
    } catch (error) {
      app.log.error({ err: error, requestId: request.id }, 'Audit log write failed');
    }
  });
}
