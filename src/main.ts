import { env } from './config/env.js';
import { assertRuntimeDatabaseRole, prisma } from './infrastructure/database/prisma.js';
import { buildApp } from './presentation/http/buildApp.js';

const app = await buildApp();

try {
  await assertRuntimeDatabaseRole();
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}

const shutdown = async () => {
  app.log.info('Shutting down');
  await app.close();
  await prisma.$disconnect();
};

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});
