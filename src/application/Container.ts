import type { FastifyInstance } from 'fastify';
import { RbacPolicy } from '../domain/access/RbacPolicy.js';
import { prisma } from '../infrastructure/database/prisma.js';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository.js';
import { PasswordHasher } from '../infrastructure/security/PasswordHasher.js';
import { buildStorageService } from '../infrastructure/storage/storageFactory.js';
import { LoginUseCase } from './auth/LoginUseCase.js';
import { env } from '../config/env.js';
import { AlanubeProvider } from '../infrastructure/invoicing/AlanubeProvider.js';
import { SimulatedProvider } from '../infrastructure/invoicing/SimulatedProvider.js';
import { parseSecretKey } from '../infrastructure/invoicing/secretBox.js';
import { ElectronicInvoicingUseCases } from './invoicing/ElectronicInvoicingUseCases.js';

export function buildContainer(app: FastifyInstance) {
  const users = new PrismaUserRepository(prisma);
  const passwordHasher = new PasswordHasher();
  const rbacPolicy = new RbacPolicy();
  const storage = buildStorageService();
  const invoicing = new ElectronicInvoicingUseCases(prisma, {
    providers: {
      SIMULATED: new SimulatedProvider(),
      ALANUBE: new AlanubeProvider(env.ALANUBE_API_TOKEN, env.ALANUBE_TIMEOUT_MS)
    },
    secretKey: parseSecretKey(env.FISCAL_SECRET_KEY),
    platformCredentials: { SIMULATED: true, ALANUBE: Boolean(env.ALANUBE_API_TOKEN) }
  });

  return {
    prisma,
    users,
    passwordHasher,
    rbacPolicy,
    storage,
    invoicing,
    auth: {
      login: new LoginUseCase(app, prisma, users, passwordHasher)
    }
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
