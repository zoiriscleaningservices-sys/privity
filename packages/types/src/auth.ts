import { UserProfile, UserRole } from './user';

export interface SignupDto {
  email: string;
  password: string;
  username: string;
  displayName: string;
  phone?: string;
}

export interface LoginDto {
  login: string; // email or username
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: UserProfile;
}

export interface JwtPayload {
  sub: string; // userId
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
