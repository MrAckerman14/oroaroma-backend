import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { allowedImageMimeTypes, env } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService, StoredFile, StoredFileContent, UploadFileInput } from '../../application/files/StorageService.js';

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
    const absolutePath = this.publicPathToAbsolutePath(publicPath);
    if (!absolutePath) return;

    await rm(absolutePath, { force: true });
  }

  async readByPublicPath(publicPath: string): Promise<StoredFileContent> {
    const absolutePath = this.publicPathToAbsolutePath(publicPath);
    if (!absolutePath) {
      throw new ValidationAppError('La ruta de la imagen no pertenece al almacenamiento local');
    }

    try {
      const [data, metadata] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath)
      ]);

      return {
        data,
        mimeType: contentTypeFromPath(publicPath),
        size: metadata.size,
        modifiedAt: metadata.mtime
      };
    } catch {
      throw new ValidationAppError('La imagen no esta disponible en el almacenamiento');
    }
  }

  private publicPathToAbsolutePath(publicPath: string) {
    if (!publicPath.startsWith(`${this.publicBasePath}/`)) return undefined;

    const relativeKey = publicPath.slice(`${this.publicBasePath}/`.length);
    const absolutePath = path.resolve(this.uploadRoot, relativeKey);
    const root = path.resolve(this.uploadRoot);

    if (!absolutePath.startsWith(`${root}${path.sep}`) && absolutePath !== root) return undefined;
    return absolutePath;
  }
}

function contentTypeFromPath(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.avif') return 'image/avif';
  return 'application/octet-stream';
}
