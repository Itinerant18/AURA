export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: 'owner' | 'reviewer' | 'viewer';
  passwordHash?: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface CreateUserInput {
  tenantId: string;
  email: string;
  password: string;
  role?: 'owner' | 'reviewer' | 'viewer';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
