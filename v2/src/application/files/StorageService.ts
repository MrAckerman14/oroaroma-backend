export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredFile {
  key: string;
  publicPath: string;
  mimeType: string;
  size: number;
}

export interface StorageService {
  saveProductImage(file: UploadFileInput): Promise<StoredFile>;
  deleteByPublicPath(publicPath: string): Promise<void>;
}
