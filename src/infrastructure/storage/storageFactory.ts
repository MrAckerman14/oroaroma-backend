import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { env, normalizedUploadPublicBasePath } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService } from '../../application/files/StorageService.js';
import { LocalStorageService } from './LocalStorageService.js';

export function resolveUploadRoot() {
  return path.isAbsolute(env.UPLOAD_ROOT)
    ? env.UPLOAD_ROOT
    : path.resolve(process.cwd(), env.UPLOAD_ROOT);
}

export function buildStorageService(): StorageService {
  if (env.STORAGE_DRIVER === 'local') {
    return new LocalStorageService(resolveUploadRoot(), normalizedUploadPublicBasePath);
  }

  throw new ValidationAppError(
    `El almacenamiento ${env.STORAGE_DRIVER} aun no esta implementado. Configura STORAGE_DRIVER=local o agrega el proveedor de objetos.`
  );
}

export async function ensureLocalUploadRoot() {
  if (env.STORAGE_DRIVER !== 'local') return;
  await mkdir(resolveUploadRoot(), { recursive: true });
}
