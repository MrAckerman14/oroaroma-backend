import 'dotenv/config';
import { z } from 'zod';

const booleanEnv = (defaultValue: 'true' | 'false') => z
  .enum(['true', 'false'])
  .default(defaultValue)
  .transform((value) => value === 'true');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:9000,http://localhost:9100'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  DEFAULT_SELLER_NAME: z.string().min(2).default('admin'),
  EMPLOYEE_BONUS_BASE_DAYS: z.coerce.number().int().positive().max(366).default(30),
  EMPLOYEE_BONUS_TIERS: z.string().default('1000:10000,2000:16666,4000:33333,7000:50000,10000:66666'),
  CASH_CLOSURE_MAX_SALES: z.coerce.number().int().positive().max(5000).default(500),
  BUSINESS_DAY_START_HOUR: z.coerce.number().int().min(0).max(23).default(7),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(100),
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  UPLOAD_ROOT: z.string().min(1).default('uploads'),
  UPLOAD_PUBLIC_BASE_PATH: z.string().min(1).default('/uploads'),
  UPLOAD_MAX_IMAGE_SIZE_MB: z.coerce.number().positive().max(50).default(5),
  UPLOAD_ALLOWED_IMAGE_MIME_TYPES: z.string().default('image/jpeg:.jpg,image/png:.png,image/webp:.webp,image/avif:.avif'),
  OBJECT_STORAGE_ENDPOINT: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_PUBLIC_BASE_URL: z.string().optional(),
  CURRENCY_CODE: z.string().min(3).max(3).default('DOP'),
  CURRENCY_COUNTRY: z.string().min(2).max(2).default('DO'),
  CURRENCY_SYMBOL: z.string().min(1).default('RD$'),
  CURRENCY_GROUP_SEPARATOR: z.string().min(1).max(1).default(','),
  CURRENCY_DECIMAL_SEPARATOR: z.string().min(1).max(1).default('.'),
  CURRENCY_MINOR_UNIT_DIGITS: z.coerce.number().int().min(0).max(4).default(2),
  CURRENCY_TRIM_ZERO_MINOR_UNITS: booleanEnv('true'),
  CURRENCY_SYMBOL_SPACING: booleanEnv('false')
});

export const env = envSchema.parse(process.env);

export const uploadPublicBasePath = env.UPLOAD_PUBLIC_BASE_PATH.startsWith('/')
  ? env.UPLOAD_PUBLIC_BASE_PATH
  : `/${env.UPLOAD_PUBLIC_BASE_PATH}`;

export const normalizedUploadPublicBasePath = uploadPublicBasePath.replace(/\/+$/, '') || '/uploads';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedImageMimeTypes = new Map(
  env.UPLOAD_ALLOWED_IMAGE_MIME_TYPES.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [mimeType, extension] = entry.split(':');
      return [mimeType, extension] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]))
);

export const currencyFormatConfig = {
  currency: env.CURRENCY_CODE,
  country: env.CURRENCY_COUNTRY,
  symbol: env.CURRENCY_SYMBOL,
  groupSeparator: env.CURRENCY_GROUP_SEPARATOR,
  decimalSeparator: env.CURRENCY_DECIMAL_SEPARATOR,
  minorUnitDigits: env.CURRENCY_MINOR_UNIT_DIGITS,
  trimZeroMinorUnits: env.CURRENCY_TRIM_ZERO_MINOR_UNITS,
  symbolSpacing: env.CURRENCY_SYMBOL_SPACING
};

export const employeeBonusConfig = {
  baseDays: env.EMPLOYEE_BONUS_BASE_DAYS,
  tiers: env.EMPLOYEE_BONUS_TIERS.split(',')
    .map((tier) => tier.trim())
    .filter(Boolean)
    .map((tier) => {
      const [bonus, target] = tier.split(':');
      return {
        bonus: Number(bonus),
        target: Number(target)
      };
    })
    .filter((tier) => Number.isFinite(tier.bonus) && Number.isFinite(tier.target))
    .sort((a, b) => a.target - b.target)
};
