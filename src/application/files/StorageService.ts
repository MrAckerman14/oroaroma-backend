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

export interface StoredFileContent {
  data: Buffer;
  mimeType: string;
  size: number;
  modifiedAt?: Date | undefined;
}

export interface StorageService {
  saveProductImage(file: UploadFileInput): Promise<StoredFile>;
  readByPublicPath(publicPath: string): Promise<StoredFileContent>;
  deleteByPublicPath(publicPath: string): Promise<void>;
}
