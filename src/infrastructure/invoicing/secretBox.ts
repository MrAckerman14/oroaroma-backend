import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifra credenciales del proveedor por empresa (AES-256-GCM). La clave vive solo
// en la variable de entorno FISCAL_SECRET_KEY; la base de datos guarda texto cifrado.
const VERSION = 'v1';

export function parseSecretKey(raw: string | undefined) {
  if (!raw) return null;
  const value = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('FISCAL_SECRET_KEY debe tener 32 bytes (64 caracteres hex o base64)');
  return key;
}

export function sealSecret(plain: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join('.');
}

export function openSecret(sealed: string, key: Buffer) {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Credencial cifrada con formato desconocido');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
