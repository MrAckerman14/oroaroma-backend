import type { AuthenticatedUser } from './rbac.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  type: 'access';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
