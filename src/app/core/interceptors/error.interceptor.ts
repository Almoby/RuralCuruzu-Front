import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import { ApiError } from '../interfaces/api-response.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) =>
      resolveApiError(error).pipe(
        switchMap((apiError) => {
          const skipToast = req.context.get(SKIP_ERROR_TOAST);
          // 401 is owned by the auth interceptor (refresh or expireSession).
          // Never toast while session expiry navigation is in progress.
          const skipAuthNoise =
            apiError.status === 401 || authService.isSessionExpiring();

          if (apiError.status >= 400 && !skipToast && !skipAuthNoise) {
            notifications.error(apiError.message);
          }
          return throwError(() => apiError);
        }),
      ),
    ),
  );
};

function resolveApiError(error: unknown): Observable<ApiError> {
  if (
    error instanceof HttpErrorResponse &&
    typeof Blob !== 'undefined' &&
    error.error instanceof Blob
  ) {
    return from(error.error.text()).pipe(
      map((text) => {
        const trimmed = text.trim();
        const parsed = tryParseApiErrorBody(trimmed);
        if (parsed) {
          return {
            ...parsed,
            status: error.status || parsed.status || 500,
          };
        }
        return {
          status: error.status || 500,
          message: trimmed || error.message || 'Error inesperado del servidor',
        } satisfies ApiError;
      }),
      catchError(() =>
        of({
          status: error.status || 500,
          message: 'Error inesperado del servidor',
          code: 'BLOB_ERROR',
        } satisfies ApiError),
      ),
    );
  }

  return of(mapToApiError(error));
}

function mapToApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    return mapHttpError(error);
  }

  if (isApiErrorLike(error)) {
    return error;
  }

  return {
    status: 500,
    message: 'Error inesperado',
    code: 'UNKNOWN_ERROR',
  };
}

function mapHttpError(error: HttpErrorResponse): ApiError {
  const raw = error.error ?? null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const fromJson = tryParseApiErrorBody(trimmed);
    if (fromJson) {
      return {
        ...fromJson,
        status: error.status || fromJson.status || 500,
      };
    }
    return {
      status: error.status || 500,
      message: trimmed || error.message || 'Error inesperado del servidor',
    };
  }

  if (isApiErrorResponse(raw)) {
    return fromApiErrorResponse(raw, error.status);
  }

  return {
    status: error.status || 500,
    message: error.message || 'Error inesperado del servidor',
  };
}

function fromApiErrorResponse(parsed: ApiErrorResponse, status: number): ApiError {
  const fieldErrors =
    parsed.errores
      ?.map((item) => ({
        field: item.campo?.trim(),
        message: item.mensaje?.trim() || '',
      }))
      .filter((item) => item.message.length > 0) ?? [];

  const fieldMessages = fieldErrors.map((item) => item.message);

  return {
    status: status || 500,
    message:
      parsed.message?.trim() ||
      fieldMessages[0] ||
      'Error inesperado del servidor',
    code: parsed.codigo,
    details: fieldMessages.length > 0 ? fieldMessages : undefined,
    fieldErrors: fieldErrors.length > 0 ? fieldErrors : undefined,
  };
}

function tryParseApiErrorBody(text: string): ApiError | null {
  if (!text.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as ApiErrorResponse;
    if (!isApiErrorResponse(parsed)) {
      return null;
    }
    return fromApiErrorResponse(parsed, 0);
  } catch {
    return null;
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return typeof value === 'object' && value !== null;
}

function isApiErrorLike(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}
