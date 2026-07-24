import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../interfaces/api-response.interface';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = mapToApiError(error);
      if (apiError.status >= 400) {
        notifications.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};

function mapToApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; code?: string; details?: string[] } | null;
    return {
      status: error.status || 500,
      message: body?.message || error.message || 'Error inesperado del servidor',
      code: body?.code,
      details: body?.details,
    };
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
