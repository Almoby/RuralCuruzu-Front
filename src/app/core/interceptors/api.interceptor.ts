import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, shareReplay, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_RETRY_DONE, SKIP_AUTH_REFRESH } from '../http/auth-http.tokens';
import { ApiError } from '../interfaces/api-response.interface';
import { AuthService } from '../services/auth.service';

/**
 * Public API routes: exact method + path relative to `apiBaseUrl`.
 * Do NOT match by substring — `/admin/solicitudes-socio` must stay private.
 */
type PublicApiRoute = {
  method: 'GET' | 'POST';
  path: string;
};

const PUBLIC_API_ROUTES: readonly PublicApiRoute[] = [
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'POST', path: '/auth/forgot-password' },
  { method: 'POST', path: '/auth/reset-password' },
  { method: 'POST', path: '/solicitudes-socio' },
  { method: 'GET', path: '/respuesta-solicitud' },
  { method: 'POST', path: '/respuesta-solicitud' },
  { method: 'GET', path: '/reglas-cuota' },
] as const;

let refreshRequest$: Observable<string> | null = null;

/**
 * Auth/API interceptor.
 * Must run *after* the request leaves other interceptors and *before* errors
 * are normalized for UI — register this interceptor last in `withInterceptors`
 * so it sees raw `HttpErrorResponse` 401s first on the response path.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const apiUrl = resolveApiUrl(req.url);
  const isPublic = isPublicApiRequest(req.method, apiUrl);
  const accessToken = authService.getAccessToken();

  let authReq = req.clone({ url: apiUrl });

  if (accessToken && !isPublic) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        throw error;
      }

      // Public routes and explicit skip: let the caller handle the 401.
      if (authReq.context.get(SKIP_AUTH_REFRESH) || isPublic) {
        throw error;
      }

      // Already retried once after refresh — session is definitively expired.
      if (authReq.context.get(AUTH_RETRY_DONE)) {
        authService.expireSession();
        return EMPTY;
      }

      return refreshAndRetry(authReq, next, authService);
    }),
  );
};

function refreshAndRetry(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
): Observable<HttpEvent<unknown>> {
  if (!refreshRequest$) {
    refreshRequest$ = authService.refreshSession().pipe(
      map((session) => session.accessToken),
      catchError(() => {
        authService.expireSession();
        return EMPTY;
      }),
      finalize(() => {
        refreshRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  return refreshRequest$.pipe(
    switchMap((token) => {
      if (!token) {
        return EMPTY;
      }

      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
          context: req.context.set(AUTH_RETRY_DONE, true),
        }),
      );
    }),
  );
}

function isUnauthorized(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    return error.status === 401;
  }

  return isApiErrorLike(error) && error.status === 401;
}

function isApiErrorLike(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl) || url.startsWith('/api');
}

function resolveApiUrl(url: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  return `${environment.apiBaseUrl}${url.replace(/^\/api/, '')}`;
}

function isPublicApiRequest(method: string, url: string): boolean {
  return matchesPublicRoute(method, url, PUBLIC_API_ROUTES);
}

function matchesPublicRoute(
  method: string,
  url: string,
  routes: readonly PublicApiRoute[],
): boolean {
  const relativePath = getApiRelativePath(url);
  const normalizedMethod = method.toUpperCase();

  return routes.some(
    (route) => route.method === normalizedMethod && route.path === relativePath,
  );
}

/**
 * Path relative to `environment.apiBaseUrl` (e.g. `/admin/solicitudes-socio`).
 * Exact equality — never substring matching.
 */
function getApiRelativePath(url: string): string {
  const withoutQuery = url.split('?')[0] ?? url;
  const apiBase = environment.apiBaseUrl.replace(/\/+$/, '');

  let pathname = withoutQuery;
  try {
    if (withoutQuery.startsWith('http')) {
      pathname = new URL(withoutQuery).pathname;
    }
  } catch {
    pathname = withoutQuery;
  }

  let basePath = '';
  try {
    const baseForUrl = apiBase.startsWith('http') ? apiBase : `http://local${apiBase}`;
    basePath = new URL(baseForUrl).pathname.replace(/\/+$/, '');
  } catch {
    basePath = '/api';
  }

  let relative = pathname;
  if (basePath && pathname.startsWith(basePath)) {
    relative = pathname.slice(basePath.length) || '/';
  } else if (pathname.startsWith('/api/')) {
    relative = pathname.slice(4);
  } else if (pathname === '/api') {
    relative = '/';
  }

  if (!relative.startsWith('/')) {
    relative = `/${relative}`;
  }

  return relative.replace(/\/+$/, '') || '/';
}
