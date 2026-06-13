import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RbacPolicy } from '../domain/access/RbacPolicy.js';
import { prisma } from '../infrastructure/database/prisma.js';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository.js';
import { PasswordHasher } from '../infrastructure/security/PasswordHasher.js';
import { LocalStorageService } from '../infrastructure/storage/LocalStorageService.js';
import { LoginUseCase } from './auth/LoginUseCase.js';

export function buildContainer(app: FastifyInstance) {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const users = new PrismaUserRepository(prisma);
  const passwordHasher = new PasswordHasher();
  const rbacPolicy = new RbacPolicy();
  const storage = new LocalStorageService(path.resolve(dirname, '../../uploads'));

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
