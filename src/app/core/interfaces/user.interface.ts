import { UserRole } from '../../shared/enums';

/** Backend login credentials (Swagger LoginRequest). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Backend login/refresh response (Swagger LoginResponse). */
export interface BackendLoginResponse {
  token: string;
  tipoToken: string;
  refreshToken: string;
  rol: string;
  nombre: string;
  refId: string | null;
  expiraEnSegundos: number;
  requiereCambioPassword: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  nuevaPassword: string;
}

export interface CambiarPasswordRequest {
  passwordActual: string;
  passwordNueva: string;
}

export interface MensajeAuthResponse {
  mensaje: string;
}

/** Internal session model used across the app. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  role: UserRole;
  displayName: string;
  email: string;
  refId: string | null;
  expiresInSeconds: number;
  /** Absolute epoch ms when the access token should be considered expired. */
  accessTokenExpiresAt?: number;
  requiresPasswordChange: boolean;
}

/**
 * Compatibility view of the authenticated user for layout/pages
 * that still expect AuthUser while domain modules remain on mocks.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Socio reference (`refId`) when role is SOCIO. */
  memberCode?: string;
  /** Comercio reference (`refId`) when role is COMERCIO. */
  merchantId?: string;
  /** Display name for comercio until domain data loads. */
  merchantName?: string;
  token: string;
  requiresPasswordChange: boolean;
}

/** @deprecated Prefer BackendLoginResponse — kept for transitional imports. */
export type LoginResponse = BackendLoginResponse;

/** Legacy user shape used by mock datasets (not auth session). */
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  memberCode?: string;
  merchantId?: string;
  merchantName?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}
