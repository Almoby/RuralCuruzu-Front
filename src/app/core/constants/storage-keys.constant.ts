export const STORAGE_KEYS = {
  /** @deprecated Prefer `accessToken` — kept for one-time migration cleanup. */
  authToken: 'srcc_auth_token',
  /** @deprecated Prefer `session` — kept for one-time migration cleanup. */
  currentUser: 'srcc_current_user',
  accessToken: 'srcc_access_token',
  refreshToken: 'srcc_refresh_token',
  session: 'srcc_auth_session',
  /** Cached Socio business number (`numeroSocio`), scoped by email in JSON payload. */
  socioNumero: 'srcc_socio_numero',
} as const;
