import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../../shared/enums';
import { AuthService } from '../services/auth.service';
import { APP_ROUTES } from '../constants/routes.constant';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const role = authService.currentRole();
  if (role === UserRole.Admin) {
    return router.createUrlTree(['/', ...APP_ROUTES.admin.dashboard.split('/')]);
  }
  if (role === UserRole.Socio) {
    return router.createUrlTree(['/', ...APP_ROUTES.socio.dashboard.split('/')]);
  }
  if (role === UserRole.Comercio) {
    return router.createUrlTree(['/', ...APP_ROUTES.comercio.home.split('/')]);
  }

  return true;
};
