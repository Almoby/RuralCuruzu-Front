import { UserRole } from '../../shared/enums';
import { APP_ROUTES } from '../constants/routes.constant';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
}

export const APP_NAVIGATION: Record<UserRole, NavItem[]> = {
  [UserRole.Admin]: [
    { label: 'Dashboard', route: APP_ROUTES.admin.dashboard, icon: 'dashboard' },
    { label: 'Solicitudes', route: APP_ROUTES.admin.requests, icon: 'inbox' },
    { label: 'Gestión de Socios', route: APP_ROUTES.admin.members, icon: 'people' },
    { label: 'Gestión de Cuotas', route: APP_ROUTES.admin.fees, icon: 'payments' },
    { label: 'Comercios', route: APP_ROUTES.admin.merchants, icon: 'storefront' },
    { label: 'Reportes', route: APP_ROUTES.admin.reports, icon: 'analytics' },
  ],
  [UserRole.Socio]: [
    { label: 'Mi Panel', route: APP_ROUTES.socio.dashboard, icon: 'home' },
    { label: 'Mi QR', route: APP_ROUTES.socio.qr, icon: 'qr_code' },
    { label: 'Beneficios', route: APP_ROUTES.socio.benefits, icon: 'loyalty' },
    { label: 'Historial', route: APP_ROUTES.socio.history, icon: 'history' },
    { label: 'Mis Pagos', route: APP_ROUTES.socio.payments, icon: 'account_balance_wallet' },
  ],
  [UserRole.Comercio]: [
    { label: 'Inicio', route: APP_ROUTES.comercio.home, icon: 'home' },
    { label: 'Mis Promociones', route: APP_ROUTES.comercio.promotions, icon: 'local_offer' },
    { label: 'Validar QR', route: APP_ROUTES.comercio.validateQr, icon: 'qr_code_scanner' },
    { label: 'Estadísticas', route: APP_ROUTES.comercio.stats, icon: 'bar_chart' },
  ],
};
