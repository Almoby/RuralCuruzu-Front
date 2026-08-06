import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { APP_ROUTES } from '../constants/routes.constant';
import { STORAGE_KEYS } from '../constants/storage-keys.constant';
import { SKIP_AUTH_REFRESH, SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  AuthSession,
  AuthUser,
  BackendLoginResponse,
  CambiarPasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  MensajeAuthResponse,
  RefreshTokenRequest,
  ResetPasswordRequest,
} from '../interfaces/user.interface';
import { mapBackendLoginToSession, mapSessionToAuthUser } from '../mappers/auth.mapper';
import { NotificationService } from './notification.service';
import { UserRole, isUserRole } from '../../shared/enums';

const silentAuthContext = new HttpContext()
  .set(SKIP_ERROR_TOAST, true)
  .set(SKIP_AUTH_REFRESH, true);

/** Refresh access token this many ms before absolute expiry. */
const PROACTIVE_REFRESH_SKEW_MS = 45_000;
const PROACTIVE_REFRESH_MIN_DELAY_MS = 5_000;

export const SESSION_EXPIRED_LOGIN_REASON = 'session-expired';

/**
 * Authentication against the real backend (Swagger Autenticación).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());
  private sessionExpiryInProgress = false;
  private proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly currentUser = computed<AuthUser | null>(() => {
    const session = this.sessionSignal();
    return session ? mapSessionToAuthUser(session) : null;
  });
  readonly isAuthenticated = computed(() => this.hasValidSession(this.sessionSignal()));
  readonly currentRole = computed(() => this.sessionSignal()?.role ?? null);
  readonly requiresPasswordChange = computed(
    () => this.sessionSignal()?.requiresPasswordChange === true,
  );

  constructor() {
    const session = this.sessionSignal();
    if (session) {
      this.scheduleProactiveRefresh(session);
    }
  }

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<BackendLoginResponse>(`${this.baseUrl}/login`, credentials, {
        context: silentAuthContext,
      })
      .pipe(
        map((response) => {
          const session = mapBackendLoginToSession(response, credentials.email);
          this.persistSession(session);
          return session;
        }),
      );
  }

  refreshSession(): Observable<AuthSession> {
    const current = this.sessionSignal();
    const refreshToken = current?.refreshToken || this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => ({
        status: 401,
        message: 'No hay refresh token disponible',
        code: 'MISSING_REFRESH_TOKEN',
      }));
    }

    const body: RefreshTokenRequest = { refreshToken };

    return this.http
      .post<BackendLoginResponse>(`${this.baseUrl}/refresh`, body, {
        context: silentAuthContext,
      })
      .pipe(
        map((response) => {
          const email = current?.email || '';
          const session = mapBackendLoginToSession(response, email, current);
          this.persistSession(session);
          return session;
        }),
      );
  }

  logout(): Observable<void> {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    const body: LogoutRequest = refreshToken ? { refreshToken } : {};

    if (!accessToken) {
      this.clearSession();
      return of(undefined);
    }

    return this.http
      .post<MensajeAuthResponse>(`${this.baseUrl}/logout`, body, {
        context: silentAuthContext,
      })
      .pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
        finalize(() => this.clearSession()),
      );
  }

  changePassword(payload: CambiarPasswordRequest): Observable<MensajeAuthResponse> {
    return this.http
      .post<MensajeAuthResponse>(`${this.baseUrl}/cambiar-password`, payload, {
        context: silentAuthContext,
      })
      .pipe(
        map((response) => {
          const session = this.sessionSignal();
          if (session) {
            this.persistSession({
              ...session,
              requiresPasswordChange: false,
            });
          }
          return response;
        }),
      );
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<MensajeAuthResponse> {
    return this.http.post<MensajeAuthResponse>(`${this.baseUrl}/forgot-password`, payload, {
      context: silentAuthContext,
    });
  }

  resetPassword(payload: ResetPasswordRequest): Observable<MensajeAuthResponse> {
    return this.http.post<MensajeAuthResponse>(`${this.baseUrl}/reset-password`, payload, {
      context: silentAuthContext,
    });
  }

  getAccessToken(): string | null {
    return this.sessionSignal()?.accessToken ?? localStorage.getItem(STORAGE_KEYS.accessToken);
  }

  getRefreshToken(): string | null {
    return this.sessionSignal()?.refreshToken ?? localStorage.getItem(STORAGE_KEYS.refreshToken);
  }

  getCurrentSession(): AuthSession | null {
    return this.sessionSignal();
  }

  hasRole(role: UserRole): boolean {
    return this.sessionSignal()?.role === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const current = this.sessionSignal()?.role;
    return current !== undefined && current !== null && roles.includes(current);
  }

  isAdmin(): boolean {
    return this.hasRole(UserRole.Admin);
  }

  isSocio(): boolean {
    return this.hasRole(UserRole.Socio);
  }

  isComercio(): boolean {
    return this.hasRole(UserRole.Comercio);
  }

  /**
   * Definitive session end: clear local auth and navigate to Login once.
   * Does not show a toast — Login shows the expiration message from navigation state.
   */
  expireSession(): void {
    if (this.sessionExpiryInProgress) {
      return;
    }
    this.sessionExpiryInProgress = true;

    this.clearProactiveRefreshTimer();
    this.clearSession();
    this.notifications.clear();

    const loginCommands = ['/', ...APP_ROUTES.auth.login.split('/')];
    const alreadyOnLogin = this.router.url.split('?')[0] === `/${APP_ROUTES.auth.login}`;

    if (alreadyOnLogin) {
      return;
    }

    void this.router.navigate(loginCommands, {
      replaceUrl: true,
      queryParams: { reason: SESSION_EXPIRED_LOGIN_REASON },
      state: { sessionExpired: true },
    });
  }

  /** True while expireSession already started (avoids local error UI racing navigation). */
  isSessionExpiring(): boolean {
    return this.sessionExpiryInProgress;
  }

  clearSession(): void {
    this.clearProactiveRefreshTimer();
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.session);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    this.sessionSignal.set(null);
  }

  private persistSession(session: AuthSession): void {
    this.sessionExpiryInProgress = false;
    localStorage.setItem(STORAGE_KEYS.accessToken, session.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    // Cleanup legacy keys so old mock sessions cannot resurrect.
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    this.sessionSignal.set(session);
    this.scheduleProactiveRefresh(session);
  }

  private scheduleProactiveRefresh(session: AuthSession): void {
    this.clearProactiveRefreshTimer();

    const expiresAt = session.accessTokenExpiresAt;
    if (!expiresAt || !session.refreshToken?.trim()) {
      return;
    }

    const delay = Math.max(
      expiresAt - Date.now() - PROACTIVE_REFRESH_SKEW_MS,
      PROACTIVE_REFRESH_MIN_DELAY_MS,
    );

    this.proactiveRefreshTimer = setTimeout(() => {
      this.proactiveRefreshTimer = null;
      if (!this.hasValidSession(this.sessionSignal()) || this.sessionExpiryInProgress) {
        return;
      }

      this.refreshSession().subscribe({
        error: () => {
          // Reactive 401 handling remains the source of truth if proactive refresh fails.
        },
      });
    }, delay);
  }

  private clearProactiveRefreshTimer(): void {
    if (this.proactiveRefreshTimer !== null) {
      clearTimeout(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }
  }

  private readStoredSession(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) {
      this.clearLegacyAuthKeys();
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!this.hasValidSession(parsed)) {
        this.clearSession();
        return null;
      }

      // Migrate accidental legacy role labels if present.
      const roleValue = String(parsed.role);
      if (!isUserRole(roleValue)) {
        this.clearSession();
        return null;
      }

      const session: AuthSession = { ...parsed, role: roleValue };
      if (
        !session.accessTokenExpiresAt &&
        typeof session.expiresInSeconds === 'number' &&
        session.expiresInSeconds > 0
      ) {
        // Best-effort for older stored sessions: treat remaining TTL from now.
        session.accessTokenExpiresAt = Date.now() + session.expiresInSeconds * 1000;
      }

      return session;
    } catch {
      this.clearSession();
      return null;
    }
  }

  private hasValidSession(session: AuthSession | null): session is AuthSession {
    return (
      !!session &&
      !!session.accessToken?.trim() &&
      !!session.refreshToken?.trim() &&
      !!session.role &&
      !!session.email?.trim()
    );
  }

  private clearLegacyAuthKeys(): void {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
  }
}
