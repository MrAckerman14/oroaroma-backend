import { type PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PasswordHasher } from '../../infrastructure/security/PasswordHasher.js';
import { UserUseCases } from './UserUseCases.js';

describe('UserUseCases role labels', () => {
  it('presenta los nombres nuevos usando la llave interna del rol', () => {
    const users = new UserUseCases({} as PrismaClient, {} as PasswordHasher);
    const presentRole = (users as unknown as {
      presentRole: (role: { key: string; name: string }) => { name: string; label: string; displayName: string };
    }).presentRole.bind(users);

    expect(presentRole({ key: 'employee', name: 'Colaborador' })).toMatchObject({
      name: 'Vendedor',
      label: 'Vendedor',
      displayName: 'Vendedor'
    });
    expect(presentRole({ key: 'supervisor', name: 'Supervisor' })).toMatchObject({
      name: 'Supervisor'
    });
    expect(presentRole({ key: 'seller', name: 'Vendedor' })).toMatchObject({
      name: 'Colaborador',
      label: 'Colaborador',
      displayName: 'Colaborador'
    });
  });
});
