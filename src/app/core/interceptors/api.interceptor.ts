import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const isApiRequest =
    req.url.startsWith(environment.apiBaseUrl) || req.url.startsWith('/api');

  if (!isApiRequest) {
    return next(req);
  }

  const apiUrl = req.url.startsWith('http')
    ? req.url
    : `${environment.apiBaseUrl}${req.url.replace(/^\/api/, '')}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return next(
    req.clone({
      url: apiUrl,
      setHeaders: headers,
    }),
  );
};
