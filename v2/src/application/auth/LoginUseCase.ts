import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import type { AuthSession, LoginInput } from '../../types/auth.js';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import type { PrismaUserRepository } from '../../infrastructure/repositories/PrismaUserRepository.js';

export class LoginUseCase {
  constructor(
    private readonly app: FastifyInstance,
    private readonly prisma: PrismaClient,
    private readonly users: PrismaUserRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(input: LoginInput, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthSession> {
    const rawUser = await this.users.findRawUserByEmail(input.email);
    if (!rawUser || rawUser.status !== 'ACTIVE') {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const passwordOk = await this.passwordHasher.compare(input.password, rawUser.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const user = this.users.toAuthenticatedUser(rawUser);
    const accessToken = this.createAccessToken(user);

    const refreshToken = await this.createRefreshSession(user.id, metadata);

    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<AuthSession> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roleAssignments: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedError('Token de refresco invalido o expirado');
    }

    if (session.user.deletedAt || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Usuario no activo');
    }

    const user = this.users.toAuthenticatedUser(session.user);
    const nextRefreshToken = await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() }
      });

      return this.createRefreshSession(user.id, metadata, tx);
    });

    return {
      accessToken: this.createAccessToken(user),
      refreshToken: nextRefreshToken,
      user
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  private createAccessToken(user: { id: string; email: string; name: string }) {
    return this.app.jwt.sign(
      { email: user.email, name: user.name, type: 'access' },
      { sub: user.id, expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  private async createRefreshSession(
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string },
    client: Pick<PrismaClient, 'refreshSession'> = this.prisma
  ) {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await client.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: metadata?.userAgent ?? null,
        ipAddress: metadata?.ipAddress ?? null
      }
    });

    return refreshToken;
  }

  private hashRefreshToken(refreshToken: string) {
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
  }
}
