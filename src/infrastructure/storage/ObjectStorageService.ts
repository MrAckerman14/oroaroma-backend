import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput
} from '@aws-sdk/client-s3';
import { allowedImageMimeTypes, env, normalizedUploadPublicBasePath } from '../../config/env.js';
import { ValidationAppError } from '../../shared/errors/AppError.js';
import type { StorageService, StoredFile, StoredFileContent, UploadFileInput } from '../../application/files/StorageService.js';

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string | undefined;
}

export class ObjectStorageService implements StorageService {
  private readonly client: S3Client;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly config: ObjectStorageConfig) {
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async saveProductImage(file: UploadFileInput): Promise<StoredFile> {
    const extension = allowedImageMimeTypes.get(file.mimeType);
    if (!extension) {
      throw new ValidationAppError('Formato de imagen no permitido');
    }

    if (file.size > env.UPLOAD_MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new ValidationAppError(`La imagen supera el limite de ${env.UPLOAD_MAX_IMAGE_SIZE_MB}MB`);
    }

    const key = `products/${randomUUID()}${extension}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimeType,
      ContentLength: file.size
    }));

    return {
      key,
      publicPath: this.publicPathForKey(key),
      mimeType: file.mimeType,
      size: file.size
    };
  }

  async readByPublicPath(publicPath: string): Promise<StoredFileContent> {
    const key = this.keyFromPublicPath(publicPath);
    if (!key) {
      throw new ValidationAppError('La ruta de la imagen no pertenece al almacenamiento configurado');
    }

    try {
      const object = await this.client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      }));
      const data = await bodyToBuffer(object.Body);

      return {
        data,
        mimeType: object.ContentType ?? contentTypeFromPath(key),
        size: Number(object.ContentLength ?? data.byteLength),
        modifiedAt: object.LastModified
      };
    } catch {
      throw new ValidationAppError('La imagen no esta disponible en el almacenamiento');
    }
  }

  async deleteByPublicPath(publicPath: string): Promise<void> {
    const key = this.keyFromPublicPath(publicPath);
    if (!key) return;

    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    }));
  }

  private publicPathForKey(key: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }

    return `${normalizedUploadPublicBasePath}/${key}`;
  }

  private keyFromPublicPath(publicPath: string) {
    if (this.publicBaseUrl && publicPath.startsWith(`${this.publicBaseUrl}/`)) {
      return sanitizeObjectKey(publicPath.slice(this.publicBaseUrl.length + 1));
    }

    if (publicPath.startsWith(`${normalizedUploadPublicBasePath}/`)) {
      return sanitizeObjectKey(publicPath.slice(`${normalizedUploadPublicBasePath}/`.length));
    }

    return undefined;
  }
}

async function bodyToBuffer(body: GetObjectCommandOutput['Body']) {
  if (!body) return Buffer.alloc(0);

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function sanitizeObjectKey(key: string) {
  const normalized = path.posix.normalize(key.replace(/\\/g, '/'));
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
    return undefined;
  }

  return normalized;
}

function contentTypeFromPath(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.avif') return 'image/avif';
  return 'application/octet-stream';
}
