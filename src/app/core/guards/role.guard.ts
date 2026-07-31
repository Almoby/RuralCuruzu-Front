import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../../shared/enums';
import { AuthService } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';
import { homeRouteForRole } from '../utils/auth-navigation.util';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      authService.clearSession();
      return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')]);
    }

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    const role = authService.currentRole();
    if (role) {
      return router.createUrlTree(homeRouteForRole(role));
    }

    authService.clearSession();
    return router.createUrlTree(['/', ...APP_ROUTES.auth.login.split('/')]);
  };
}
