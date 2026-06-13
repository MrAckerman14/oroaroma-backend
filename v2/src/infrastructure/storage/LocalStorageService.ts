import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { allowedImageMimeTypes, env } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService, StoredFile, UploadFileInput } from '../../application/files/StorageService.js';

export class LocalStorageService implements StorageService {
  constructor(
    private readonly uploadRoot: string,
    private readonly publicBasePath = '/uploads'
  ) {}

  async saveProductImage(file: UploadFileInput): Promise<StoredFile> {
    const extension = allowedImageMimeTypes.get(file.mimeType);
    if (!extension) {
      throw new ValidationAppError('Formato de imagen no permitido');
    }

    if (file.size > env.UPLOAD_MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new ValidationAppError(`La imagen supera el limite de ${env.UPLOAD_MAX_IMAGE_SIZE_MB}MB`);
    }

    const folder = path.join(this.uploadRoot, 'products');
    await mkdir(folder, { recursive: true });

    const key = `products/${randomUUID()}${extension}`;
    const absolutePath = path.join(this.uploadRoot, key);
    await writeFile(absolutePath, file.buffer);

    return {
      key,
      publicPath: `${this.publicBasePath}/${key.replace(/\\/g, '/')}`,
      mimeType: file.mimeType,
      size: file.size
    };
  }

  async deleteByPublicPath(publicPath: string): Promise<void> {
    if (!publicPath.startsWith(`${this.publicBasePath}/`)) return;

    const relativeKey = publicPath.slice(`${this.publicBasePath}/`.length);
    const absolutePath = path.resolve(this.uploadRoot, relativeKey);
    const root = path.resolve(this.uploadRoot);

    if (!absolutePath.startsWith(root)) return;
    await rm(absolutePath, { force: true });
  }
}
