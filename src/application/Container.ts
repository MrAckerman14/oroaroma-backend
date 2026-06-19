import type { FastifyInstance } from 'fastify';
import { RbacPolicy } from '../domain/access/RbacPolicy.js';
import { prisma } from '../infrastructure/database/prisma.js';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository.js';
import { PasswordHasher } from '../infrastructure/security/PasswordHasher.js';
import { buildStorageService } from '../infrastructure/storage/storageFactory.js';
import { LoginUseCase } from './auth/LoginUseCase.js';

export function buildContainer(app: FastifyInstance) {
  const users = new PrismaUserRepository(prisma);
  const passwordHasher = new PasswordHasher();
  const rbacPolicy = new RbacPolicy();
  const storage = buildStorageService();

  return {
    prisma,
    users,
    passwordHasher,
    rbacPolicy,
    storage,
    auth: {
      login: new LoginUseCase(app, prisma, users, passwordHasher)
    }
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
