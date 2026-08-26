import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status: 'ok',
    statusLabel: 'Correcto',
    service: 'zoko-hola-api-v2',
    timestamp: new Date().toISOString()
  }));
}
