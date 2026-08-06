import { UserRole } from '../../shared/enums';

/** Asociación category from LoginResponse (SOCIO only). Not membership status. */
export type SocioCategoriaAsociacion = 'ACTIVO' | 'ADHERENTE';

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
  /** Solo SOCIO; null para COMERCIO/ADMIN. */
  numeroSocio?: string | null;
  /** Solo SOCIO; null para COMERCIO/ADMIN. */
  categoria?: SocioCategoriaAsociacion | string | null;
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
  /**
   * Visible Socio business number from LoginResponse.numeroSocio.
   * Never populated from refId. Null/absent for ADMIN/COMERCIO or legacy sessions.
   */
  numeroSocio?: string | null;
  /**
   * Asociación category from LoginResponse.categoria (ACTIVO | ADHERENTE).
   * Distinct from Socio account status (ACTIVO | INACTIVO | DADO_DE_BAJA).
   */
  memberCategory?: SocioCategoriaAsociacion | null;
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
  /** Visible Socio number (`LoginResponse.numeroSocio`). Never refId. */
  memberCode?: string;
  /** Asociación category ACTIVO | ADHERENTE when role is SOCIO. */
  memberCategory?: SocioCategoriaAsociacion;
  /** Comercio reference (`refId`) when role is COMERCIO. */
  merchantId?: string;
  /** Display name for comercio until domain data loads. */
  merchantName?: string;
  token: string;
  requiresPasswordChange: boolean;
}

