import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SESSION_EXPIRED_LOGIN_REASON } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  authService.clearSession();

  // Do not preserve returnUrl when session expiry is already navigating to Login.
  if (authService.isSessionExpiring()) {
    return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')], {
      queryParams: { reason: SESSION_EXPIRED_LOGIN_REASON },
    });
  }

  return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')], {
    queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : undefined,
  });
};
