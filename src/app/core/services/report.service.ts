import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, from, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import { CuotaResumenResponseDto } from '../interfaces/admin-cuota.interface';
import { AdminDashboardDto } from '../interfaces/admin-dashboard.interface';
import {
  AdminReportExportFile,
  AdminReportQueryParams,
  AdminReportRawBundle,
  AdminReportsLoadResult,
} from '../interfaces/admin-report.interface';
import { SocioResumenDto } from '../interfaces/admin-socio.interface';
import { ApiError } from '../interfaces/api-response.interface';
import {
  BenefitUsageRanking,
  CommerceBenefitUsageReport,
  ExportReportRow,
  MemberDebtReport,
  MonthlyCollectedFeesReport,
  MonthlyPaymentsReport,
  OverdueMemberReport,
  ReportMetric,
  ReportsDashboardResponse,
} from '../interfaces/report.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import {
  mapAdminReportBundleToViewModel,
  mapCollectedFeesFromCuotas,
} from '../mappers/admin-report.mapper';
import { parseContentDispositionFileName } from '../mappers/admin-solicitud-socio.mapper';
import { mockResponse } from '../utils/mock.util';
import reportsMock from '../../../assets/mock-data/reports-dashboard.json';

/**
 * Reports data access.
 * Admin Reportes → real backend (dashboard + cuotas + socios).
 * Legacy helpers → mocks until other roles need them.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly adminDashboardBase = `${environment.apiBaseUrl}/admin/dashboard`;
  private readonly adminCuotasBase = `${environment.apiBaseUrl}/admin/cuotas`;
  private readonly adminSociosBase = `${environment.apiBaseUrl}/admin/socios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);
  private readonly store: ReportsDashboardResponse = structuredClone(
    reportsMock,
  ) as ReportsDashboardResponse;

  /**
   * Coordinated Admin Reportes load:
   * - GET /admin/dashboard
   * - GET /admin/cuotas
   * - GET /admin/socios?estado=ACTIVO
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
      sociosActivos: this.fetchSociosActivos().pipe(
        map((value) => ({ ok: true as const, value })),
        catchError(() => of({ ok: false as const, value: null as number | null })),
      ),
    }).pipe(
      map(({ dashboard, cuotas, sociosActivos }) => ({
        dashboard: dashboard.value,
        cuotas: cuotas.value,
        sociosActivosCount: sociosActivos.value,
        dashboardFailed: !dashboard.ok,
        cuotasFailed: !cuotas.ok,
      })),
    );
  }

  /** GET /admin/dashboard */
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

  /** GET /admin/cuotas (full list — no pagination in Swagger). */
  private fetchCuotas(): Observable<CuotaResumenResponseDto[]> {
    return this.http
      .get<CuotaResumenResponseDto[]>(this.adminCuotasBase, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  /** GET /admin/socios?estado=ACTIVO → count for "Socios activos". */
  private fetchSociosActivos(): Observable<number> {
    return this.http
      .get<SocioResumenDto[]>(this.adminSociosBase, {
        params: new HttpParams().set('estado', 'ACTIVO'),
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).length));
  }

  // --- Legacy (mocks / invented paths) — not used by Admin Reportes ---

  /** @deprecated Admin Reportes uses getAdminReports(). */
  getReports(): Observable<ReportsDashboardResponse> {
    if (environment.useMocks) {
      return mockResponse(structuredClone(this.store));
    }
    return this.http.get<ReportsDashboardResponse>(`${environment.apiBaseUrl}/reports`);
  }

  /** @deprecated Prefer getAdminReports() */
  getReportSummary(_periodLabel?: string): Observable<ReportsDashboardResponse> {
    return this.getReports();
  }

  getMetrics(): Observable<ReportMetric[]> {
    return this.getReports().pipe(map((data) => data.metrics));
  }

  getCollectionsVsPending(): Observable<MonthlyPaymentsReport> {
    return this.getReports().pipe(map((data) => data.collectionsVsPending));
  }

  getDebtByMember(): Observable<MemberDebtReport> {
    return this.getReports().pipe(map((data) => data.debtByMember));
  }

  getOverdueMembers(): Observable<OverdueMemberReport> {
    return this.getReports().pipe(map((data) => data.overdueMembers));
  }

  getMonthlyCollectedFees(): Observable<MonthlyCollectedFeesReport> {
    return this.getReports().pipe(map((data) => data.monthlyCollectedFees));
  }

  getTopBenefits(): Observable<BenefitUsageRanking> {
    return this.getReports().pipe(map((data) => data.topBenefits));
  }

  getBenefitsByCommerce(): Observable<CommerceBenefitUsageReport> {
    return this.getReports().pipe(map((data) => data.benefitsByCommerce));
  }

  /** @deprecated Admin Reportes uses exportAdminReport() (PDF). */
  exportReports(): Observable<Blob> {
    if (environment.useMocks) {
      const rows = this.buildExportRows(this.store);
      const csv = this.toCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      return mockResponse(blob);
    }
    return this.http.get(`${environment.apiBaseUrl}/reports/export`, {
      responseType: 'blob',
    });
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

  private buildExportRows(data: ReportsDashboardResponse): ExportReportRow[] {
    const rows: ExportReportRow[] = [];

    data.metrics.forEach((metric) => {
      rows.push({
        section: 'Métricas',
        label: metric.label,
        value: String(metric.value),
      });
    });

    data.collectionsVsPending.labels.forEach((label, index) => {
      data.collectionsVsPending.series.forEach((series) => {
        rows.push({
          section: data.collectionsVsPending.title,
          label: `${label} — ${series.name}`,
          value: String(series.values[index] ?? 0),
        });
      });
    });

    data.debtByMember.items.forEach((item) => {
      rows.push({
        section: data.debtByMember.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.overdueMembers.items.forEach((item) => {
      rows.push({
        section: data.overdueMembers.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.monthlyCollectedFees.items.forEach((item) => {
      rows.push({
        section: data.monthlyCollectedFees.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.topBenefits.items.forEach((item) => {
      rows.push({
        section: data.topBenefits.title,
        label: `${item.rank}. ${item.title} — ${item.merchantName}`,
        value: String(item.usesPerMonth),
      });
    });

    data.benefitsByCommerce.items.forEach((item) => {
      rows.push({
        section: data.benefitsByCommerce.title,
        label: item.name,
        value: String(item.value),
      });
    });

    return rows;
  }

  private toCsv(rows: ExportReportRow[]): string {
    const header = 'Sección,Etiqueta,Valor';
    const body = rows
      .map((row) =>
        [row.section, row.label, row.value]
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    return `${header}\n${body}\n`;
  }
}
