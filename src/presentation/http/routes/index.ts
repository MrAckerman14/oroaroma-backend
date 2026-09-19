import type { FastifyInstance } from 'fastify';
import { accessRoutes } from './accessRoutes.js';
import { authRoutes } from './authRoutes.js';
import { healthRoutes } from './healthRoutes.js';
import { inventoryRoutes } from './inventoryRoutes.js';
import { reportRoutes } from './reportRoutes.js';
import { saleRoutes } from './saleRoutes.js';
import { storeRoutes } from './storeRoutes.js';
import { userRoutes } from './userRoutes.js';
import { tenantRoutes } from './tenantRoutes.js';
import { expenseRoutes } from './expenseRoutes.js';
import { branchRoutes } from './branchRoutes.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(tenantRoutes);
  await app.register(accessRoutes);
  await app.register(userRoutes);
  await app.register(storeRoutes);
  await app.register(saleRoutes);
  await app.register(reportRoutes);
  await app.register(inventoryRoutes);
  await app.register(expenseRoutes);
  await app.register(branchRoutes);
}
