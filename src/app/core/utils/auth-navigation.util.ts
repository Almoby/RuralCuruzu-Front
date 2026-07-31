import { UserRole } from '../../shared/enums';
import { APP_ROUTES } from '../constants/routes.constant';

export function homeRouteForRole(role: UserRole): string[] {
  if (role === UserRole.Admin) {
    return ['/', ...APP_ROUTES.admin.dashboard.split('/')];
  }
  if (role === UserRole.Socio) {
    return ['/', ...APP_ROUTES.socio.dashboard.split('/')];
  }
  return ['/', ...APP_ROUTES.comercio.home.split('/')];
}

export function isSafeInternalReturnUrl(url: string, role: UserRole): boolean {
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('://')) {
    return false;
  }

  if (role === UserRole.Admin) {
    return url === '/admin' || url.startsWith('/admin/');
  }
  if (role === UserRole.Socio) {
    return url === '/socio' || url.startsWith('/socio/');
  }
  if (role === UserRole.Comercio) {
    return url === '/comercio' || url.startsWith('/comercio/');
  }
  return false;
}
