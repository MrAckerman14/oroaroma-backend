import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

export class PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
