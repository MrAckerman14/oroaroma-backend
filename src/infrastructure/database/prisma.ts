import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../../config/env.js';

interface TenantDatabaseContext {
  tenantId: string;
  platformAdmin: boolean;
}

const tenantContext = new AsyncLocalStorage<TenantDatabaseContext>();
const basePrisma = new PrismaClient({
  ...(env.DATABASE_RUNTIME_URL ? { datasourceUrl: env.DATABASE_RUNTIME_URL } : {}),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

export const prisma = env.REQUIRE_DATABASE_RLS_ROLE
  ? tenantAwareClient(basePrisma)
  : basePrisma;

export function enterTenantDatabaseContext(tenantId: string, platformAdmin = false) {
  tenantContext.enterWith({ tenantId, platformAdmin });
}

export function runTenantDatabaseContext<T>(
  tenantId: string,
  platformAdmin: boolean,
  callback: () => T
) {
  return tenantContext.run({ tenantId, platformAdmin }, callback);
}

export async function assertRuntimeDatabaseRole() {
  if (!env.REQUIRE_DATABASE_RLS_ROLE) return;
  const [role] = await basePrisma.$queryRaw<Array<{ bypassRls: boolean; ownsProtectedTables: boolean; missingRls: boolean; missingTablePrivileges: boolean; missingSequencePrivileges: boolean; missingFunctionPrivileges: boolean }>>`
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
      ) AS "missingRls",
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
          AND NOT CASE
            WHEN c.relname = 'AuditLog' THEN has_table_privilege(current_user, c.oid, 'SELECT,INSERT')
            WHEN c.relname IN ('Permission', 'PlatformPermission') THEN has_table_privilege(current_user, c.oid, 'SELECT')
            ELSE has_table_privilege(current_user, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          END
      ) AS "missingTablePrivileges",
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
          AND NOT has_sequence_privilege(current_user, c.oid, 'USAGE,SELECT')
      ) AS "missingSequencePrivileges",
      NOT (
        has_function_privilege(current_user, 'public.resolve_login_tenant(text)', 'EXECUTE')
        AND has_function_privilege(current_user, 'public.resolve_refresh_tenant(text)', 'EXECUTE')
        AND has_function_privilege(current_user, 'public.can_access_tenant(text)', 'EXECUTE')
      ) AS "missingFunctionPrivileges"
    FROM pg_roles r WHERE r.rolname = current_user
  `;
  if (!role || role.bypassRls || role.ownsProtectedTables || role.missingRls
    || role.missingTablePrivileges || role.missingSequencePrivileges || role.missingFunctionPrivileges) {
    throw new Error('DATABASE_RUNTIME_URL no cumple los requisitos de aislamiento y privilegios de ejecución');
  }
}

export function tenantAwareClient(client: PrismaClient): PrismaClient {
  const delegateCache = new Map<PropertyKey, object>();

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async (callback: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<unknown>, options?: object) => {
          const context = tenantContext.getStore();
          if (!context || typeof callback !== 'function') {
            const transaction = Reflect.get(target, property, receiver) as (...args: unknown[]) => Promise<unknown>;
            return transaction.call(target, callback, options);
          }
          return target.$transaction(async (tx) => {
            await setDatabaseContext(tx, context);
            return callback(tx);
          }, options);
        };
      }

      const value = Reflect.get(target, property, receiver) as unknown;
      if (!isPrismaDelegate(value)) {
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          const result: unknown = Reflect.apply(value, target, args);
          return result;
        };
      }
      const cached = delegateCache.get(property);
      if (cached) return cached;

      const delegate = new Proxy(value, {
        get(delegateTarget, operation) {
          const method = Reflect.get(delegateTarget, operation) as unknown;
          if (typeof method !== 'function') return method;
          return async (...args: unknown[]) => {
            const context = tenantContext.getStore();
            if (!context) {
              const result: unknown = Reflect.apply(method, delegateTarget, args);
              return result;
            }
            return client.$transaction(async (tx) => {
              await setDatabaseContext(tx, context);
              const transactionDelegate = Reflect.get(tx, property) as object;
              const transactionMethod = Reflect.get(transactionDelegate, operation) as (...values: unknown[]) => unknown;
              return Reflect.apply(transactionMethod, transactionDelegate, args);
            });
          };
        }
      });
      delegateCache.set(property, delegate);
      return delegate;
    }
  });
}

async function setDatabaseContext(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  context: TenantDatabaseContext
) {
  await tx.$queryRaw`
    SELECT
      set_config('app.tenant_id', ${context.tenantId}, true),
      set_config('app.platform_admin', ${context.platformAdmin ? 'true' : 'false'}, true)
  `;
}

function isPrismaDelegate(value: unknown): value is object {
  return typeof value === 'object'
    && value !== null
    && typeof Reflect.get(value, 'findMany') === 'function';
}
