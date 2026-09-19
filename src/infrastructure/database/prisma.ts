import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';

export const prisma = new PrismaClient({
  ...(env.DATABASE_RUNTIME_URL ? { datasourceUrl: env.DATABASE_RUNTIME_URL } : {}),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

export async function assertRuntimeDatabaseRole() {
  if (!env.REQUIRE_DATABASE_RLS_ROLE) return;
  const [role] = await prisma.$queryRaw<Array<{ bypassRls: boolean; ownsProtectedTables: boolean; missingRls: boolean }>>`
    SELECT
      r.rolbypassrls AS "bypassRls",
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND pg_get_userbyid(c.relowner) = current_user
      ) AS "ownsProtectedTables",
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
          AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.oid AND a.attname = 'tenantId' AND NOT a.attisdropped
          )
      ) AS "missingRls"
    FROM pg_roles r WHERE r.rolname = current_user
  `;
  if (!role || role.bypassRls || role.ownsProtectedTables || role.missingRls) {
    throw new Error('DATABASE_RUNTIME_URL debe usar un rol no propietario, sin BYPASSRLS y con RLS habilitada');
  }
}
