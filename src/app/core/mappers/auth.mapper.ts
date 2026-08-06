import { UserRole, isUserRole } from '../../shared/enums';
import {
  AuthSession,
  AuthUser,
  BackendLoginResponse,
  SocioCategoriaAsociacion,
} from '../interfaces/user.interface';
import { asDisplayableBusinessCode } from '../utils/display-identity.util';

function mapNumeroSocio(
  role: UserRole,
  value: string | null | undefined,
): string | null {
  if (role !== UserRole.Socio) {
    return null;
  }
  return asDisplayableBusinessCode(value);
}

function mapMemberCategory(
  role: UserRole,
  value: string | null | undefined,
): SocioCategoriaAsociacion | null {
  if (role !== UserRole.Socio) {
    return null;
  }
  const normalized = value?.trim().toUpperCase();
  if (normalized === 'ACTIVO' || normalized === 'ADHERENTE') {
    return normalized;
  }
  return null;
}

/**
 * Maps Swagger LoginResponse (login + refresh) to AuthSession.
 * Pass `previous` on refresh so SOCIO identity is not wiped if a field is omitted.
 */
export function mapBackendLoginToSession(
  response: BackendLoginResponse,
  email: string,
  previous?: AuthSession | null,
): AuthSession {
  const role = normalizeRole(response.rol);
  const expiresInSeconds = response.expiraEnSegundos ?? 0;

  const numeroFromResponse = mapNumeroSocio(role, response.numeroSocio);
  const categoryFromResponse = mapMemberCategory(role, response.categoria);

  const preserveSocioIdentity =
    role === UserRole.Socio && previous?.role === UserRole.Socio;

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
    numeroSocio:
      numeroFromResponse ??
      (preserveSocioIdentity ? (previous?.numeroSocio ?? null) : null),
    memberCategory:
      categoryFromResponse ??
      (preserveSocioIdentity ? (previous?.memberCategory ?? null) : null),
  };
}

export function mapSessionToAuthUser(session: AuthSession): AuthUser {
  const refId = session.refId?.trim() || undefined;
  const numeroSocio = asDisplayableBusinessCode(session.numeroSocio) || undefined;

  return {
    id: refId || session.email,
    email: session.email,
    fullName: session.displayName,
    role: session.role,
    // Visible Socio number from LoginResponse — never refId.
    memberCode: session.role === UserRole.Socio ? numeroSocio : undefined,
    memberCategory:
      session.role === UserRole.Socio
        ? (session.memberCategory ?? undefined)
        : undefined,
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

/** Friendly labels for Mi Panel / chrome (not membership status). */
export function socioCategoriaLabel(
  categoria: SocioCategoriaAsociacion | null | undefined,
): string {
  switch (categoria) {
    case 'ACTIVO':
      return 'Activo';
    case 'ADHERENTE':
      return 'Adherente';
    default:
      return '';
  }
}
