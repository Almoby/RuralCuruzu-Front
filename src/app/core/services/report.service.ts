import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, from, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import { CuotaResumenResponseDto } from '../interfaces/admin-cuota.interface';
import {
  AdminDashboardDto,
  CobranzaMensualDto,
} from '../interfaces/admin-dashboard.interface';
import {
  AdminReportExportFile,
  AdminReportQueryParams,
  AdminReportRawBundle,
  AdminReportsLoadResult,
} from '../interfaces/admin-report.interface';
import { ApiError } from '../interfaces/api-response.interface';
import {
  MonthlyPaymentsReport,
  ReportsDashboardResponse,
} from '../interfaces/report.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import {
  buildCollectionsVsPending,
  mapAdminReportBundleToViewModel,
  mapCollectedFeesFromCuotas,
} from '../mappers/admin-report.mapper';
import { parseContentDispositionFileName } from '../mappers/admin-solicitud-socio.mapper';

/**
 * Reports data access — Admin Reportes:
 * - GET /admin/dashboard (KPIs, debt, benefits, collections series)
 * - GET /admin/cuotas (only “Cuotas cobradas por mes”)
 * - GET /admin/dashboard/exportar (PDF)
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly adminDashboardBase = `${environment.apiBaseUrl}/admin/dashboard`;
  private readonly adminCuotasBase = `${environment.apiBaseUrl}/admin/cuotas`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * Coordinated Admin Reportes load:
   * - GET /admin/dashboard
   * - GET /admin/cuotas
   */
  getAdminReports(
    params?: AdminReportQueryParams,
    selectedCollectedPeriod?: string,
  ): Observable<AdminReportsLoadResult> {
    return this.getAdminReportBundle(params).pipe(
      map((bundle) => {
        if (bundle.dashboardFailed && bundle.cuotasFailed) {
          throw {
            status: 500,
            message: 'No se pudieron cargar los reportes',
            code: 'REPORTS_LOAD_FAILED',
          } satisfies ApiError;
        }
        return {
          report: mapAdminReportBundleToViewModel(bundle, selectedCollectedPeriod),
          cuotas: bundle.cuotas,
          dashboard: bundle.dashboard,
        };
      }),
    );
  }

  /**
   * Re-map collected-fees section for a selected `yyyy-MM` without refetching.
   */
  withCollectedPeriod(
    current: ReportsDashboardResponse,
    cuotas: CuotaResumenResponseDto[],
    period: string,
  ): ReportsDashboardResponse {
    return {
      ...current,
      monthlyCollectedFees: mapCollectedFeesFromCuotas(cuotas, period),
    };
  }

  /**
   * GET /admin/dashboard?año= — Swagger returns 12 months for that year only.
   * Used by “Cobrados vs pendientes” year filter.
   */
  getCobranzaMensualForYear(year: number): Observable<{
    cobranzaMensual: CobranzaMensualDto[];
    collectionsVsPending: MonthlyPaymentsReport;
  }> {
    return this.fetchDashboard({ año: year }).pipe(
      map((dashboard) => {
        const cobranzaMensual = dashboard.cobranzaMensual ?? [];
        return {
          cobranzaMensual,
          collectionsVsPending: buildCollectionsVsPending(cobranzaMensual, year),
        };
      }),
    );
  }

  /**
   * GET /admin/dashboard/exportar — PDF blob for Admin Reportes.
   */
  exportAdminReport(): Observable<AdminReportExportFile> {
    return this.http
      .get(`${this.adminDashboardBase}/exportar`, {
        responseType: 'blob',
        observe: 'response',
        context: this.silentContext,
      })
      .pipe(switchMap((response) => from(this.toExportFile(response))));
  }

  private getAdminReportBundle(
    params?: AdminReportQueryParams,
  ): Observable<AdminReportRawBundle> {
    return forkJoin({
      dashboard: this.fetchDashboard(params).pipe(
        map((value) => ({ ok: true as const, value })),
        catchError(() => of({ ok: false as const, value: null })),
      ),
      cuotas: this.fetchCuotas().pipe(
        map((value) => ({ ok: true as const, value })),
        catchError(() => of({ ok: false as const, value: [] as CuotaResumenResponseDto[] })),
      ),
    }).pipe(
      map(({ dashboard, cuotas }) => ({
        dashboard: dashboard.value,
        cuotas: cuotas.value,
        dashboardFailed: !dashboard.ok,
        cuotasFailed: !cuotas.ok,
      })),
    );
  }

  /**
   * GET /admin/dashboard
   * Query filters prepared (`año`, `categoria`, `tipoPersona`); Reportes UI has none yet.
   */
  private fetchDashboard(
    params?: AdminReportQueryParams,
  ): Observable<AdminDashboardDto> {
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

    return this.http.get<AdminDashboardDto>(this.adminDashboardBase, {
      params: httpParams,
      context: this.silentContext,
    });
  }

  /** GET /admin/cuotas — used only for collected-fees-by-month list. */
  private fetchCuotas(): Observable<CuotaResumenResponseDto[]> {
    return this.http
      .get<CuotaResumenResponseDto[]>(this.adminCuotasBase, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  private async toExportFile(
    response: HttpResponse<Blob>,
  ): Promise<AdminReportExportFile> {
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
      fileName:
        fromHeader ?? `reportes-rural-curuzu-${new Date().toISOString().slice(0, 10)}.pdf`,
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
          'No se pudo exportar el reporte',
        code: parsed.codigo,
        details: fieldMessages.length > 0 ? fieldMessages : undefined,
      };
    } catch {
      return {
        status: status || 500,
        message: 'No se pudo exportar el reporte',
        code: 'EXPORT_ERROR',
      };
    }
  }
}
