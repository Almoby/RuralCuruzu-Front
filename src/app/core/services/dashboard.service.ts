import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminDashboardStats,
  ComercioDashboardStats,
  SocioDashboardStats,
} from '../interfaces/dashboard.interface';
import { mockResponse } from '../utils/mock.util';
import adminDashboardMock from '../../../assets/mock-data/admin-dashboard.json';
import socioDashboardMock from '../../../assets/mock-data/socio-dashboard.json';
import comercioDashboardMock from '../../../assets/mock-data/comercio-dashboard.json';

/**
 * Dashboard data access.
 * While `environment.useMocks` is true, returns typed mock payloads.
 * When Swagger/backend is ready, flip `useMocks` and point `apiBaseUrl`
 * — components keep calling the same methods.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getAdminStats(): Observable<AdminDashboardStats> {
    if (environment.useMocks) {
      return mockResponse(adminDashboardMock as AdminDashboardStats);
    }

    return this.http.get<AdminDashboardStats>(`${environment.apiBaseUrl}/dashboard/admin`);
  }

  getSocioStats(): Observable<SocioDashboardStats> {
    if (environment.useMocks) {
      return mockResponse(socioDashboardMock as SocioDashboardStats);
    }

    return this.http.get<SocioDashboardStats>(`${environment.apiBaseUrl}/dashboard/socio`);
  }

  getComercioStats(): Observable<ComercioDashboardStats> {
    if (environment.useMocks) {
      return mockResponse(comercioDashboardMock as ComercioDashboardStats);
    }

    return this.http.get<ComercioDashboardStats>(`${environment.apiBaseUrl}/dashboard/comercio`);
  }
}
