import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corsOrigins, env } from '../../config/env.js';
import { authPlugin } from './plugins/authPlugin.js';
import { registerAuditHook } from './plugins/auditPlugin.js';
import { containerPlugin } from './plugins/containerPlugin.js';
import { registerCurrencyFormatHook } from './plugins/currencyFormatPlugin.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const uploadRoot = path.resolve(dirname, '../../../uploads');

  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true
  });

  registerErrorHandler(app);

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  });
  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    credentials: true,
    exposedHeaders: ['Authorization']
  });
  await app.register(jwt, {
    secret: env.JWT_SECRET
  });
  await app.register(multipart, {
    limits: {
      fileSize: env.UPLOAD_MAX_IMAGE_SIZE_MB * 1024 * 1024,
      files: 1
    }
  });
  await app.register(fastifyStatic, {
    root: uploadRoot,
    prefix: '/uploads/'
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Oro Aroma API v2',
        version: '2.0.0'
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs'
  });
  await app.register(containerPlugin);
  await app.register(authPlugin);
  registerCurrencyFormatHook(app);
  registerAuditHook(app);
  await registerRoutes(app);

  return app;
}
