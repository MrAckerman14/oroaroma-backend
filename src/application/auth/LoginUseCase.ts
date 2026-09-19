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

  async execute(
    input: LoginInput,
    options: { tenantId: string; userAgent?: string; ipAddress?: string }
  ): Promise<AuthSession> {
    const rawUser = await this.users.findRawUserByEmail(input.email, options.tenantId);
    if (!rawUser || rawUser.status !== 'ACTIVE') {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const passwordOk = await this.passwordHasher.compare(input.password, rawUser.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Credenciales invalidas');
    }

    const user = this.users.toAuthenticatedUser(rawUser);
    const accessToken = this.createAccessToken(user);

    const refreshToken = await this.createRefreshSession(user.id, user.tenantId, options);

    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            tenant: { include: { moduleSettings: true } },
            platformRoles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } }
                  }
                }
              }
            },
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
            },
            branchMemberships: { include: { branch: true } }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedError('Token de refresco invalido o expirado');
    }

    if (session.user.deletedAt || session.user.status !== 'ACTIVE' || session.user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedError('Usuario no activo');
    }

    const user = this.users.toAuthenticatedUser(session.user);
    const nextRefreshToken = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      if (revoked.count !== 1) throw new UnauthorizedError('Token de refresco ya utilizado');
      return this.createRefreshSession(user.id, user.tenantId, {
        ...(session.userAgent ? { userAgent: session.userAgent } : {}),
        ...(session.ipAddress ? { ipAddress: session.ipAddress } : {})
      }, tx);
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

  private createAccessToken(user: { id: string; tenantId: string; email: string; name: string }) {
    return this.app.jwt.sign(
      { email: user.email, name: user.name, type: 'access', tenantId: user.tenantId },
      { sub: user.id, expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  private async createRefreshSession(
    userId: string,
    tenantId: string,
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
        tenantId,
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
