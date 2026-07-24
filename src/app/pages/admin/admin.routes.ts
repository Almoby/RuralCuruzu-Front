import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/admin-dashboard').then((m) => m.AdminDashboardPage),
    title: 'Dashboard General',
  },
  {
    path: 'solicitudes',
    loadComponent: () =>
      import('./member-requests/member-requests').then((m) => m.MemberRequestsPage),
    title: 'Solicitudes de Adhesión',
  },
  {
    path: 'socios',
    loadComponent: () => import('./members/members').then((m) => m.MembersPage),
    title: 'Gestión de Socios',
  },
  {
    path: 'cuotas',
    loadComponent: () => import('./dues/dues').then((m) => m.DuesPage),
    title: 'Gestión de Cuotas',
  },
  {
    path: 'comercios',
    loadComponent: () => import('./merchants/merchants').then((m) => m.MerchantsPage),
    title: 'Comercios Adheridos',
  },
  {
    path: 'reportes',
    loadComponent: () => import('./reports/reports').then((m) => m.ReportsPage),
    title: 'Reportes',
  },
];
