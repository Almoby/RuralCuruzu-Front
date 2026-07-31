import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import {
  changePasswordAccessGuard,
  passwordChangeGuard,
} from './core/guards/password-change.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './shared/enums';
import { ShellComponent } from './layout/shell/shell';
import { ADMIN_ROUTES } from './pages/admin/admin.routes';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'respuesta-solicitud',
    loadComponent: () =>
      import('./pages/public/respuesta-solicitud/respuesta-solicitud').then(
        (m) => m.RespuestaSolicitud,
      ),
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'registro',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/auth/member-request/member-request').then((m) => m.MemberRequest),
      },
      {
        path: 'recuperar-password',
        loadComponent: () =>
          import('./pages/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
      },
      {
        path: 'restablecer-password',
        loadComponent: () =>
          import('./pages/auth/reset-password/reset-password').then((m) => m.ResetPassword),
      },
      {
        path: 'cambiar-password',
        canActivate: [changePasswordAccessGuard],
        loadComponent: () =>
          import('./pages/auth/change-password/change-password').then((m) => m.ChangePassword),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, passwordChangeGuard, roleGuard([UserRole.Admin])],
    component: ShellComponent,
    children: ADMIN_ROUTES,
  },
  {
    path: 'socio',
    canActivate: [authGuard, passwordChangeGuard, roleGuard([UserRole.Socio])],
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      {
        path: 'panel',
        loadComponent: () =>
          import('./pages/socio/dashboard/socio-dashboard').then((m) => m.SocioDashboard),
      },
      {
        path: 'mi-qr',
        loadComponent: () => import('./pages/socio/qr/socio-qr').then((m) => m.SocioQr),
      },
      {
        path: 'beneficios',
        loadComponent: () =>
          import('./pages/socio/benefits/socio-benefits').then((m) => m.SocioBenefits),
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./pages/socio/history/socio-history').then((m) => m.SocioHistory),
      },
      {
        path: 'mis-pagos',
        loadComponent: () =>
          import('./pages/socio/payments/socio-payments').then((m) => m.SocioPayments),
      },
    ],
  },
  {
    path: 'comercio',
    canActivate: [authGuard, passwordChangeGuard, roleGuard([UserRole.Comercio])],
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./pages/comercio/dashboard/comercio-dashboard').then(
            (m) => m.ComercioDashboard,
          ),
      },
      {
        path: 'promociones',
        loadComponent: () =>
          import('./pages/comercio/promotions/comercio-promotions').then(
            (m) => m.ComercioPromotions,
          ),
      },
      {
        path: 'validar-qr',
        loadComponent: () =>
          import('./pages/comercio/validate-qr/comercio-validate-qr').then(
            (m) => m.ComercioValidateQr,
          ),
      },
      {
        path: 'estadisticas',
        loadComponent: () =>
          import('./pages/comercio/statistics/comercio-statistics').then(
            (m) => m.ComercioStatistics,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
