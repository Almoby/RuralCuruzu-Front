import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, from, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  CuotaResumenResponseDto,
  PagoResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  AdminDashboardDto,
  AdminDashboardExportFile,
  AdminDashboardQueryParams,
} from '../interfaces/admin-dashboard.interface';
import { ApiError } from '../interfaces/api-response.interface';
import {
  AdminDashboardStats,
  MemberDashboardResponse,
} from '../interfaces/dashboard.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import {
  SocioBeneficioResumenDto,
  SocioHistorialBeneficioDto,
} from '../interfaces/socio-panel.interface';
import {
  BeneficioComercioResponseDto,
  ComercioInicioViewModel,
  InicioComercioResponseDto,
} from '../interfaces/comercio-inicio.interface';
import {
  ComercioEstadisticasViewModel,
  EstadisticasComercioResponseDto,
} from '../interfaces/comercio-estadisticas.interface';
import { mapAdminDashboardDtoToViewModel } from '../mappers/admin-dashboard.mapper';
import { mapComercioInicioBundleToViewModel } from '../mappers/comercio-inicio.mapper';
import { mapEstadisticasComercioDtoToViewModel } from '../mappers/comercio-estadisticas.mapper';
import { mapSocioPanelBundleToViewModel } from '../mappers/socio-panel.mapper';
import { parseContentDispositionFileName } from '../mappers/admin-solicitud-socio.mapper';
import { AuthService } from './auth.service';
import { UserIdentityService } from './user-identity.service';

/**
 * Dashboard data access.
 * - Admin dashboard → `GET /admin/dashboard`
 * - Socio Mi panel → `/socio/cuotas`, `/socio/beneficios`, …
 * - Comercio Inicio → `GET /comercio/dashboard` + `/comercio/beneficios`
 * - Comercio Estadísticas → `GET /comercio/dashboard/estadisticas`
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly adminBase = `${environment.apiBaseUrl}/admin/dashboard`;
  private readonly socioBase = `${environment.apiBaseUrl}/socio`;
  private readonly comercioBase = `${environment.apiBaseUrl}/comercio`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET /admin/dashboard
   * Optional filters (`año`, `categoria`, `tipoPersona`) are service-ready;
   * current Admin Dashboard UI has no filter controls.
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

  /**
   * Socio “Mi panel”.
   * Composes:
   * - GET /socio/cuotas
   * - GET /socio/cuotas/pagos
   * - GET /socio/beneficios
   * - GET /socio/beneficios/historial-beneficios
   * + session displayName for greeting fallback
   */
  getSocioPanelDashboard(): Observable<MemberDashboardResponse> {
    const session = this.auth.getCurrentSession();
    const displayName = session?.displayName?.trim() || '';
    const numeroSocio = session?.numeroSocio ?? null;
    const memberCategory = session?.memberCategory ?? null;

    return forkJoin({
      cuotas: this.fetchSocioCuotas().pipe(
        catchError(() => of(null as CuotaResumenResponseDto[] | null)),
      ),
      pagos: this.fetchSocioPagos().pipe(
        catchError(() => of(null as PagoResponseDto[] | null)),
      ),
      beneficios: this.fetchSocioBeneficios().pipe(
        catchError(() => of(null as SocioBeneficioResumenDto[] | null)),
      ),
      historial: this.fetchSocioHistorialBeneficios().pipe(
        catchError(() => of(null as SocioHistorialBeneficioDto[] | null)),
      ),
    }).pipe(
      map(({ cuotas, pagos, beneficios, historial }) => {
        const allFailed =
          cuotas === null &&
          pagos === null &&
          beneficios === null &&
          historial === null;

        if (allFailed) {
          throw {
            status: 500,
            message: 'No se pudo cargar tu panel',
            code: 'SOCIO_PANEL_LOAD_FAILED',
          } satisfies ApiError;
        }

        const view = mapSocioPanelBundleToViewModel({
          cuotas: cuotas ?? [],
          pagos: pagos ?? [],
          beneficios: beneficios ?? [],
          historial: historial ?? [],
          session: { displayName, numeroSocio, memberCategory },
        });
        this.userIdentity.setSocioNumero(view.profile.memberCode);
        return view;
      }),
    );
  }

  private fetchSocioCuotas(): Observable<CuotaResumenResponseDto[]> {
    return this.http
      .get<CuotaResumenResponseDto[]>(`${this.socioBase}/cuotas`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  private fetchSocioPagos(): Observable<PagoResponseDto[]> {
    return this.http
      .get<PagoResponseDto[]>(`${this.socioBase}/cuotas/pagos`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  private fetchSocioBeneficios(): Observable<SocioBeneficioResumenDto[]> {
    return this.http
      .get<SocioBeneficioResumenDto[]>(`${this.socioBase}/beneficios`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  private fetchSocioHistorialBeneficios(): Observable<SocioHistorialBeneficioDto[]> {
    return this.http
      .get<SocioHistorialBeneficioDto[]>(`${this.socioBase}/beneficios/historial-beneficios`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  /**
   * Comercio “Inicio”:
   * - GET /comercio/dashboard
   * - GET /comercio/beneficios (featured promo + nombre comercial; soft-fails to [])
   */
  getComercioDashboard(): Observable<ComercioInicioViewModel> {
    return forkJoin({
      inicio: this.http.get<InicioComercioResponseDto>(`${this.comercioBase}/dashboard`, {
        context: this.silentContext,
      }),
      beneficios: this.http
        .get<BeneficioComercioResponseDto[]>(`${this.comercioBase}/beneficios`, {
          context: this.silentContext,
        })
        .pipe(
          map((items) => items ?? []),
          catchError(() => of([] as BeneficioComercioResponseDto[])),
        ),
    }).pipe(
      map(({ inicio, beneficios }) =>
        mapComercioInicioBundleToViewModel(inicio, beneficios),
      ),
    );
  }

  /**
   * Comercio “Estadísticas”:
   * GET /comercio/dashboard/estadisticas
   * Optional query `año` (current year when omitted, per Swagger).
   */
  getComercioEstadisticas(año?: number): Observable<ComercioEstadisticasViewModel> {
    let params = new HttpParams();
    if (año !== undefined) {
      params = params.set('año', String(año));
    }

    return this.http
      .get<EstadisticasComercioResponseDto>(`${this.comercioBase}/dashboard/estadisticas`, {
        params,
        context: this.silentContext,
      })
      .pipe(map(mapEstadisticasComercioDtoToViewModel));
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
