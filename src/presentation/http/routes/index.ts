import type { FastifyInstance } from 'fastify';
import { accessRoutes } from './accessRoutes.js';
import { authRoutes } from './authRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { inventoryRoutes } from './inventoryRoutes.js';
import { reportRoutes } from './reportRoutes.js';
import { saleRoutes } from './saleRoutes.js';
import { storeRoutes } from './storeRoutes.js';
import { userRoutes } from './userRoutes.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(accessRoutes);
  await app.register(userRoutes);
  await app.register(storeRoutes);
  await app.register(saleRoutes);
  await app.register(reportRoutes);
  await app.register(inventoryRoutes);
}
