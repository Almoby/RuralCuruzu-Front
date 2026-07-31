import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';
import { homeRouteForRole } from '../utils/auth-navigation.util';

/** Prevents authenticated users from opening login/register. */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

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
