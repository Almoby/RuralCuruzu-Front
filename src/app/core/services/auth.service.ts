import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/storage-keys.constant';
import { AuthUser, LoginRequest, LoginResponse, User } from '../interfaces/user.interface';
import { UserRole } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import usersMock from '../../../assets/mock-data/users.json';

interface MockUserRecord extends User {
  password: string;
}

/**
 * Demo credentials (mock):
 * - admin@srcc.local / admin123 → Admin
 * - socio@srcc.local / socio123 → Socio (S-0001)
 * - comercio@srcc.local / comercio123 → Comercio
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUserSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly currentRole = computed(() => this.currentUserSignal()?.role ?? null);

  login(credentials: LoginRequest): Observable<LoginResponse> {
    if (environment.useMocks) {
      const users = usersMock as MockUserRecord[];
      const match = users.find(
        (user) =>
          user.email.toLowerCase() === credentials.email.toLowerCase() &&
          user.password === credentials.password &&
          user.isActive,
      );

      if (!match) {
        return throwError(() => ({
          status: 401,
          message: 'Credenciales inválidas',
          code: 'INVALID_CREDENTIALS',
        }));
      }

      const token = `mock-token-${match.id}`;
      const authUser: AuthUser = {
        id: match.id,
        email: match.email,
        fullName: match.fullName,
        role: match.role,
        memberCode: match.memberCode,
        merchantId: match.merchantId,
        token,
      };

      return mockResponse<LoginResponse>({ user: authUser, token }).pipe(
        map((response) => {
          this.persistSession(response);
          return response;
        }),
      );
    }

    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(map((response) => {
        this.persistSession(response);
        return response;
      }));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.authToken);
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserSignal()?.role === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const current = this.currentUserSignal()?.role;
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

  private persistSession(response: LoginResponse): void {
    localStorage.setItem(STORAGE_KEYS.authToken, response.token);
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.currentUser);
      localStorage.removeItem(STORAGE_KEYS.authToken);
      return null;
    }
  }
}
