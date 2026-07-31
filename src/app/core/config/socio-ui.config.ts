import { APP_ROUTES } from '../constants/routes.constant';

/** Institutional labels for layout chrome (sidebar brand). Backend-ready. */
export const PORTAL_BRANDING = {
  organizationName: 'Soc. Rural Curuzú Cuatiá',
} as const;

/**
 * Single source of truth for socio module icons.
 * Sidebar navigation and Mi Panel quick-access cards must resolve from here.
 */
export const SOCIO_MODULE_ICONS = {
  [APP_ROUTES.socio.dashboard]: 'home',
  [APP_ROUTES.socio.qr]: 'qr_code',
  [APP_ROUTES.socio.benefits]: 'gift',
  [APP_ROUTES.socio.history]: 'history',
  [APP_ROUTES.socio.payments]: 'account_balance_wallet',
} as const;

export type SocioModuleRoute = keyof typeof SOCIO_MODULE_ICONS;

export function resolveSocioModuleIcon(route: string): string {
  if (route in SOCIO_MODULE_ICONS) {
    return SOCIO_MODULE_ICONS[route as SocioModuleRoute];
  }
  return 'home';
}
