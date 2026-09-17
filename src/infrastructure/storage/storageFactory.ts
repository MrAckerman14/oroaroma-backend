import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { env, normalizedUploadPublicBasePath } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService } from '../../application/files/StorageService.js';
import { LocalStorageService } from './LocalStorageService.js';
import { ObjectStorageService } from './ObjectStorageService.js';

export function resolveUploadRoot() {
  return path.isAbsolute(env.UPLOAD_ROOT)
    ? env.UPLOAD_ROOT
    : path.resolve(process.cwd(), env.UPLOAD_ROOT);
}

export function buildStorageService(): StorageService {
  if (env.STORAGE_DRIVER === 'local') {
    return new LocalStorageService(resolveUploadRoot(), normalizedUploadPublicBasePath);
  }

  return new ObjectStorageService({
    endpoint: requiredStorageEnv('OBJECT_STORAGE_ENDPOINT'),
    region: env.OBJECT_STORAGE_REGION || (env.STORAGE_DRIVER === 'r2' ? 'auto' : requiredStorageEnv('OBJECT_STORAGE_REGION')),
    bucket: requiredStorageEnv('OBJECT_STORAGE_BUCKET'),
    accessKeyId: requiredStorageEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: requiredStorageEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    publicBaseUrl: env.OBJECT_STORAGE_PUBLIC_BASE_URL
  });
}

export async function ensureLocalUploadRoot() {
  if (env.STORAGE_DRIVER !== 'local') return;
  await mkdir(resolveUploadRoot(), { recursive: true });
}

function requiredStorageEnv(key: keyof typeof env) {
  const value = env[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  throw new ValidationAppError(`Falta configurar ${key} para STORAGE_DRIVER=${env.STORAGE_DRIVER}`);
}
