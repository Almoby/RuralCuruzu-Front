export const STORAGE_KEYS = {
  /** @deprecated Prefer `accessToken` — kept for one-time migration cleanup. */
  authToken: 'srcc_auth_token',
  /** @deprecated Prefer `session` — kept for one-time migration cleanup. */
  currentUser: 'srcc_current_user',
  accessToken: 'srcc_access_token',
  refreshToken: 'srcc_refresh_token',
  session: 'srcc_auth_session',
} as const;
