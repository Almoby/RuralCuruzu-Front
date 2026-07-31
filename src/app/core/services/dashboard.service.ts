import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  AdminDashboardDto,
  AdminDashboardExportFile,
  AdminDashboardQueryParams,
} from '../interfaces/admin-dashboard.interface';
import { ApiError } from '../interfaces/api-response.interface';
import {
  AdminDashboardStats,
  ComercioDashboardStats,
  MemberDashboardResponse,
  MemberFinancialSummary,
  MemberProfileSummary,
  MembershipStatusBanner,
  MerchantStatisticsData,
  QuickAccessItem,
  SocioDashboardStats,
  AvailableBenefitPreview,
  UsedBenefitPreview,
} from '../interfaces/dashboard.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import { mapAdminDashboardDtoToViewModel } from '../mappers/admin-dashboard.mapper';
import { parseContentDispositionFileName } from '../mappers/admin-solicitud-socio.mapper';
import { mockResponse } from '../utils/mock.util';
import socioDashboardMock from '../../../assets/mock-data/socio-dashboard.json';
import comercioDashboardMock from '../../../assets/mock-data/comercio-dashboard.json';
import comercioStatisticsMock from '../../../assets/mock-data/comercio-statistics.json';

/**
 * Dashboard data access.
 * - Admin dashboard → always real backend (`GET /admin/dashboard`).
 * - Socio / Comercio → mocks until those modules are connected.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = `${environment.apiBaseUrl}/admin/dashboard`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET /admin/dashboard — always hits the real API (ignores useMocks).
   */
  getAdminStats(params?: AdminDashboardQueryParams): Observable<AdminDashboardStats> {
    return this.getAdminDashboard(params);
  }

  getAdminDashboard(params?: AdminDashboardQueryParams): Observable<AdminDashboardStats> {
    let httpParams = new HttpParams();
    if (params?.año !== undefined) {
      httpParams = httpParams.set('año', String(params.año));
    }
    if (params?.categoria) {
      httpParams = httpParams.set('categoria', params.categoria);
    }
    if (params?.tipoPersona) {
      httpParams = httpParams.set('tipoPersona', params.tipoPersona);
    }

    return this.http
      .get<AdminDashboardDto>(this.adminBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map(mapAdminDashboardDtoToViewModel));
  }

  /**
   * GET /admin/dashboard/exportar — PDF blob.
   * Connected for when the UI exposes export; current layout has no export button.
   */
  exportAdminDashboard(): Observable<AdminDashboardExportFile> {
    return this.http
      .get(`${this.adminBase}/exportar`, {
        responseType: 'blob',
        observe: 'response',
        context: this.silentContext,
      })
      .pipe(switchMap((response) => from(this.toExportFile(response))));
  }

  /** Full Mi Panel payload for the authenticated member. */
  getMemberDashboard(): Observable<MemberDashboardResponse> {
    return this.getSocioStats();
  }

  getMemberProfile(): Observable<MemberProfileSummary> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.profile));
  }

  getMemberStatus(): Observable<MembershipStatusBanner> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.membershipStatus));
  }

  getAvailableBenefits(): Observable<AvailableBenefitPreview[]> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.availableBenefits));
  }

  getRecentBenefitUsage(): Observable<UsedBenefitPreview[]> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.recentUsage));
  }

  getMemberPayments(): Observable<MemberFinancialSummary> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.financial));
  }

  getQuickAccess(): Observable<QuickAccessItem[]> {
    return this.getMemberDashboard().pipe(map((dashboard) => dashboard.quickAccess));
  }

  getSocioStats(): Observable<SocioDashboardStats> {
    if (environment.useMocks) {
      return mockResponse(socioDashboardMock as MemberDashboardResponse);
    }

    return this.http.get<MemberDashboardResponse>(`${environment.apiBaseUrl}/dashboard/socio`);
  }

  getComercioStats(): Observable<ComercioDashboardStats> {
    if (environment.useMocks) {
      return mockResponse(comercioDashboardMock as ComercioDashboardStats);
    }

    return this.http.get<ComercioDashboardStats>(`${environment.apiBaseUrl}/dashboard/comercio`);
  }

  /** Full Estadísticas payload for the authenticated merchant. */
  getComercioStatistics(): Observable<MerchantStatisticsData> {
    if (environment.useMocks) {
      return mockResponse(comercioStatisticsMock as MerchantStatisticsData);
    }

    return this.http.get<MerchantStatisticsData>(
      `${environment.apiBaseUrl}/dashboard/comercio/statistics`,
    );
  }

  private async toExportFile(
    response: HttpResponse<Blob>,
  ): Promise<AdminDashboardExportFile> {
    const blob = response.body;
    if (!blob) {
      throw {
        status: 500,
        message: 'No se recibió el archivo de exportación',
        code: 'EMPTY_FILE',
      } satisfies ApiError;
    }

    if (this.looksLikeJsonError(blob, response.status)) {
      throw await this.parseBlobApiError(blob, response.status);
    }

    const fromHeader = parseContentDispositionFileName(
      response.headers.get('Content-Disposition'),
    );

    return {
      blob,
      fileName: fromHeader ?? `dashboard-rural-curuzu-${new Date().toISOString().slice(0, 10)}.pdf`,
    };
  }

  private looksLikeJsonError(blob: Blob, status: number): boolean {
    if (status >= 400) {
      return true;
    }
    const type = (blob.type || '').toLowerCase();
    return type.includes('application/json') || type.includes('text/json');
  }

  private async parseBlobApiError(blob: Blob, status: number): Promise<ApiError> {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text) as ApiErrorResponse;
      const fieldMessages =
        parsed.errores
          ?.map((item) => item.mensaje?.trim() || '')
          .filter((message) => message.length > 0) ?? [];

      return {
        status: status || 500,
        message:
          parsed.message?.trim() ||
          fieldMessages[0] ||
          'No se pudo exportar el dashboard',
        code: parsed.codigo,
        details: fieldMessages.length > 0 ? fieldMessages : undefined,
      };
    } catch {
      return {
        status: status || 500,
        message: 'No se pudo exportar el dashboard',
        code: 'EXPORT_ERROR',
      };
    }
  }
}
