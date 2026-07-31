import { UserRole, isUserRole } from '../../shared/enums';
import { AuthSession, AuthUser, BackendLoginResponse } from '../interfaces/user.interface';

export function mapBackendLoginToSession(
  response: BackendLoginResponse,
  email: string,
): AuthSession {
  const role = normalizeRole(response.rol);
  const expiresInSeconds = response.expiraEnSegundos ?? 0;

  return {
    accessToken: response.token,
    refreshToken: response.refreshToken,
    tokenType: response.tipoToken || 'Bearer',
    role,
    displayName: response.nombre?.trim() || email,
    email: email.trim(),
    refId: response.refId ?? null,
    expiresInSeconds,
    accessTokenExpiresAt:
      expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : undefined,
    requiresPasswordChange: !!response.requiereCambioPassword,
  };
}

export function mapSessionToAuthUser(session: AuthSession): AuthUser {
  const refId = session.refId?.trim() || undefined;

  return {
    id: refId || session.email,
    email: session.email,
    fullName: session.displayName,
    role: session.role,
    memberCode: session.role === UserRole.Socio ? refId : undefined,
    merchantId: session.role === UserRole.Comercio ? refId : undefined,
    merchantName: session.role === UserRole.Comercio ? session.displayName : undefined,
    token: session.accessToken,
    requiresPasswordChange: session.requiresPasswordChange,
  };
}

export function normalizeRole(rol: string): UserRole {
  const normalized = rol.trim().toUpperCase();
  if (isUserRole(normalized)) {
    return normalized;
  }

  if (normalized === 'ADMINISTRADOR') {
    return UserRole.Admin;
  }

  throw new Error(`Rol de autenticación no soportado: ${rol}`);
}
