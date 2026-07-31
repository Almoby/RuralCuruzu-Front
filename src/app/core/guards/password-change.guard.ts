import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';

/**
 * Blocks portal access until the user completes the mandatory password change.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')]);
  }

  if (authService.requiresPasswordChange()) {
    return router.createUrlTree(['/', ...APP_ROUTES.auth.changePassword.split('/')]);
  }

  return true;
};

/**
 * Allows the change-password screen only for authenticated users.
 */
export const changePasswordAccessGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')]);
  }

  return true;
};
