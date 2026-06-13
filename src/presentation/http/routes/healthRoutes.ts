import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status: 'ok',
    statusLabel: 'Correcto',
    service: 'oroaroma-api-v2',
    timestamp: new Date().toISOString()
  }));
}
