import path from 'node:path';
import { env, uploadPublicBasePath } from '../../config/env.js';
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
    return new LocalStorageService(resolveUploadRoot(), uploadPublicBasePath);
  }

  throw new ValidationAppError(
    `El almacenamiento ${env.STORAGE_DRIVER} aun no esta implementado. Configura STORAGE_DRIVER=local o agrega el proveedor de objetos.`
  );
}
