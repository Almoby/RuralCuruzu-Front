import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';
import { homeRouteForRole } from '../utils/auth-navigation.util';

/**
 * Prevents authenticated users from opening login/register.
 * Exception: `/auth/login?token=...` must reach Login so it can redirect to
 * the public password-reset screen (email links currently point at Login).
 */
export const guestGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const parsed = router.parseUrl(state.url);
  const recoveryToken = (parsed.queryParamMap.get('token') ?? '').trim();
  const path = state.url.split('?')[0] ?? state.url;
  const isLoginWithRecoveryToken =
    recoveryToken.length > 0 &&
    (path === '/auth/login' || path.endsWith('/auth/login'));

  if (isLoginWithRecoveryToken) {
    return true;
  }

  if (!authService.isAuthenticated()) {
    return true;
  }

  if (authService.requiresPasswordChange()) {
    return router.createUrlTree(['/', ...APP_ROUTES.auth.changePassword.split('/')]);
  }

  const role = authService.currentRole();
  if (role) {
    return router.createUrlTree(homeRouteForRole(role));
  }

  authService.clearSession();
  return true;
};
