import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarDatosBancariosRequest,
  ActualizarReglaCuotaRequest,
  AdminCuotaDetail,
  AdminCuotaListItem,
  AdminCuotasResumenViewModel,
  AdminDatosBancariosViewModel,
  AdminEjecucionGeneracionViewModel,
  AdminEstadoCuentaViewModel,
  AdminFeePeriodOption,
  AdminPaymentReceiptDownload,
  AdminReglaCuotaViewModel,
  AnularCuotaRequest,
  CuotaResponseDto,
  CuotaResumenResponseDto,
  DatosBancariosActualizadosResponseDto,
  DatosBancariosResponseDto,
  EstadoCuentaSocioResponseDto,
  GeneracionCuotasResponseDto,
  ListarCuotasAdminParams,
  PagoResponseDto,
  ReglaCuotaActualizadaResponseDto,
  ReglaCuotaResponseDto,
  RegistrarPagoCuotaRequest,
  RegistrarPagoResponseDto,
  ResumenCuotasResponseDto,
  RevisarPagoInformadoRequest,
  RevisarPagoInformadoResponseDto,
  SocioCategoriaCuota,
} from '../interfaces/admin-cuota.interface';
import {
  InformarPagoCuotaRequestDto,
  InformarPagoResponseDto,
  LinkDePagoResponseDto,
  SocioPaymentReceiptDownload,
} from '../interfaces/socio-payments.interface';
import { ApiError } from '../interfaces/api-response.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  buildAdminPeriodOptions,
  mapCuotaDtoToViewModel,
  mapCuotaResumenDtoToViewModel,
  mapDatosBancariosDtoToViewModel,
  mapEstadoCuentaSocioDtoToViewModel,
  mapEjecucionGeneracionDtoToViewModel,
  mapReglaCuotaDtoToViewModel,
  mapResumenCuotasDtoToViewModel,
} from '../mappers/admin-cuota.mapper';
import { parseContentDispositionFileName } from '../mappers/admin-solicitud-socio.mapper';
import { UserIdentityService } from './user-identity.service';

/**
 * Fees / cuotas access.
 * - Admin Gestión de Cuotas → `/admin/cuotas*`, reglas, datos bancarios
 * - Socio Mis Pagos / Historial → `/socio/cuotas*`
 */
@Injectable({ providedIn: 'root' })
export class FeeService {
  private readonly http = inject(HttpClient);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly adminCuotasBase = `${environment.apiBaseUrl}/admin/cuotas`;
  private readonly adminReglasBase = `${environment.apiBaseUrl}/admin/reglas-cuota`;
  private readonly adminDatosBancariosBase = `${environment.apiBaseUrl}/admin/datos-bancarios`;
  private readonly socioCuotasBase = `${environment.apiBaseUrl}/socio/cuotas`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET `${apiBaseUrl}/admin/cuotas`
   * Optional: estado, socioId, periodo.
   */
  getAdminCuotas(params?: ListarCuotasAdminParams): Observable<AdminCuotaListItem[]> {
    let httpParams = new HttpParams();
    if (params?.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }
    if (params?.socioId) {
      httpParams = httpParams.set('socioId', params.socioId);
    }
    if (params?.periodo) {
      httpParams = httpParams.set('periodo', params.periodo);
    }

    return this.http
      .get<CuotaResumenResponseDto[]>(this.adminCuotasBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).map(mapCuotaResumenDtoToViewModel)));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/{id}`
   */
  getAdminCuotaById(id: string): Observable<AdminCuotaDetail> {
    return this.http
      .get<CuotaResponseDto>(`${this.adminCuotasBase}/${encodeURIComponent(id)}`, {
        context: this.silentContext,
      })
      .pipe(map(mapCuotaDtoToViewModel));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/resumen`
   */
  getAdminCuotasResumen(): Observable<AdminCuotasResumenViewModel> {
    return this.http
      .get<ResumenCuotasResponseDto>(`${this.adminCuotasBase}/resumen`, {
        context: this.silentContext,
      })
      .pipe(map(mapResumenCuotasDtoToViewModel));
  }

  /**
   * POST `${apiBaseUrl}/admin/cuotas/generar?periodo=`
   */
  generateAdminCuotas(periodo?: string): Observable<GeneracionCuotasResponseDto> {
    let httpParams = new HttpParams();
    if (periodo) {
      httpParams = httpParams.set('periodo', periodo);
    }

    return this.http.post<GeneracionCuotasResponseDto>(
      `${this.adminCuotasBase}/generar`,
      null,
      {
        params: httpParams,
        context: this.silentContext,
      },
    );
  }

  /**
   * POST `${apiBaseUrl}/admin/cuotas/pagos`
   */
  registerAdminPago(body: RegistrarPagoCuotaRequest): Observable<RegistrarPagoResponseDto> {
    return this.http.post<RegistrarPagoResponseDto>(`${this.adminCuotasBase}/pagos`, body, {
      context: this.silentContext,
    });
  }

  /**
   * PATCH `${apiBaseUrl}/admin/cuotas/{id}/revision`
   * Approve or reject an informed payment (cuota EN_REVISION).
   */
  reviseAdminPago(
    cuotaId: string,
    body: RevisarPagoInformadoRequest,
  ): Observable<RevisarPagoInformadoResponseDto> {
    return this.http.patch<RevisarPagoInformadoResponseDto>(
      `${this.adminCuotasBase}/${encodeURIComponent(cuotaId)}/revision`,
      body,
      { context: this.silentContext },
    );
  }

  /** Alias matching requested naming for approve. */
  approveAdminPago(cuotaId: string): Observable<RevisarPagoInformadoResponseDto> {
    return this.reviseAdminPago(cuotaId, { aprobar: true });
  }

  /** Alias matching requested naming for reject (motivo required by API). */
  rejectAdminPago(
    cuotaId: string,
    motivoRechazo: string,
  ): Observable<RevisarPagoInformadoResponseDto> {
    return this.reviseAdminPago(cuotaId, { aprobar: false, motivoRechazo });
  }

  /**
   * PATCH `${apiBaseUrl}/admin/cuotas/{id}/anular`
   */
  anularAdminCuota(cuotaId: string, body: AnularCuotaRequest): Observable<CuotaResponseDto> {
    return this.http.patch<CuotaResponseDto>(
      `${this.adminCuotasBase}/${encodeURIComponent(cuotaId)}/anular`,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * GET `${apiBaseUrl}/admin/reglas-cuota`
   */
  getAdminReglasCuota(): Observable<AdminReglaCuotaViewModel[]> {
    return this.http
      .get<ReglaCuotaResponseDto[]>(this.adminReglasBase, {
        context: this.silentContext,
      })
      .pipe(
        map((items) =>
          (items ?? [])
            .map(mapReglaCuotaDtoToViewModel)
            .filter((item): item is AdminReglaCuotaViewModel => item !== null),
        ),
      );
  }

  /**
   * GET `${apiBaseUrl}/admin/reglas-cuota/{categoria}`
   */
  getAdminReglaCuotaByCategoria(
    categoria: SocioCategoriaCuota,
  ): Observable<AdminReglaCuotaViewModel> {
    return this.http
      .get<ReglaCuotaResponseDto>(
        `${this.adminReglasBase}/${encodeURIComponent(categoria)}`,
        { context: this.silentContext },
      )
      .pipe(
        map((dto) => {
          const mapped = mapReglaCuotaDtoToViewModel({
            ...dto,
            categoriaAplicable: dto.categoriaAplicable ?? categoria,
          });
          if (!mapped) {
            throw new Error('La regla no tiene categoría válida');
          }
          return mapped;
        }),
      );
  }

  /**
   * PUT `${apiBaseUrl}/admin/reglas-cuota/{categoria}`
   */
  updateAdminReglaCuota(
    categoria: SocioCategoriaCuota,
    body: ActualizarReglaCuotaRequest,
  ): Observable<ReglaCuotaActualizadaResponseDto> {
    return this.http.put<ReglaCuotaActualizadaResponseDto>(
      `${this.adminReglasBase}/${encodeURIComponent(categoria)}`,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * GET `${apiBaseUrl}/admin/datos-bancarios`
   */
  getAdminDatosBancarios(): Observable<AdminDatosBancariosViewModel> {
    return this.http
      .get<DatosBancariosResponseDto>(this.adminDatosBancariosBase, {
        context: this.silentContext,
      })
      .pipe(map(mapDatosBancariosDtoToViewModel));
  }

  /**
   * PUT `${apiBaseUrl}/admin/datos-bancarios`
   */
  updateAdminDatosBancarios(
    body: ActualizarDatosBancariosRequest,
  ): Observable<DatosBancariosActualizadosResponseDto> {
    return this.http.put<DatosBancariosActualizadosResponseDto>(
      this.adminDatosBancariosBase,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * Client-side period options helper (no Swagger catalog endpoint).
   * Prefer estado-cuenta periodos for register-payment.
   */
  getAdminPeriodOptions(count = 8): AdminFeePeriodOption[] {
    return buildAdminPeriodOptions(count);
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/pagos/{pagoId}/comprobante`
   * Real file or generated constancia PDF when pago is APROBADO.
   */
  downloadAdminComprobante(pagoId: string): Observable<AdminPaymentReceiptDownload> {
    return this.http
      .get(`${this.adminCuotasBase}/pagos/${encodeURIComponent(pagoId)}/comprobante`, {
        responseType: 'blob',
        observe: 'response',
        context: this.silentContext,
      })
      .pipe(switchMap((response) => from(this.toAdminReceiptDownload(response, pagoId))));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/ejecuciones`
   * Newest first (as returned by backend).
   */
  getAdminEjecuciones(): Observable<AdminEjecucionGeneracionViewModel[]> {
    return this.http
      .get<GeneracionCuotasResponseDto[]>(`${this.adminCuotasBase}/ejecuciones`, {
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).map(mapEjecucionGeneracionDtoToViewModel)));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/estado-cuenta/{socioId}`
   */
  getAdminEstadoCuenta(socioId: string): Observable<AdminEstadoCuentaViewModel> {
    return this.http
      .get<EstadoCuentaSocioResponseDto>(
        `${this.adminCuotasBase}/estado-cuenta/${encodeURIComponent(socioId)}`,
        { context: this.silentContext },
      )
      .pipe(map(mapEstadoCuentaSocioDtoToViewModel));
  }

  // ---------------------------------------------------------------------------
  // Socio Mis Pagos / Historial
  // ---------------------------------------------------------------------------

  /** GET /socio/cuotas */
  getSocioCuotas(): Observable<CuotaResumenResponseDto[]> {
    return this.http
      .get<CuotaResumenResponseDto[]>(this.socioCuotasBase, {
        context: this.silentContext,
      })
      .pipe(
        map((items) => {
          const list = items ?? [];
          const numero = list.find((item) => item.socioNumeroSocio?.trim())?.socioNumeroSocio;
          this.userIdentity.setSocioNumero(numero);
          return list;
        }),
      );
  }

  /**
   * GET /socio/cuotas/pagos
   * Historial de pagos del socio autenticado (todos los intentos; más recientes primero).
   */
  getSocioPaymentHistory(): Observable<PagoResponseDto[]> {
    return this.http
      .get<PagoResponseDto[]>(`${this.socioCuotasBase}/pagos`, {
        context: this.silentContext,
      })
      .pipe(
        map((items) => {
          const list = items ?? [];
          const numero = list.find((item) => item.socioNumeroSocio?.trim())?.socioNumeroSocio;
          this.userIdentity.setSocioNumero(numero);
          return list;
        }),
      );
  }

  /** Alias used by Mis Pagos for clarity. */
  getSocioPayments(): Observable<PagoResponseDto[]> {
    return this.getSocioPaymentHistory();
  }

  /** GET /socio/cuotas/datos-bancarios */
  getSocioBankDetails(): Observable<DatosBancariosResponseDto> {
    return this.http.get<DatosBancariosResponseDto>(
      `${this.socioCuotasBase}/datos-bancarios`,
      { context: this.silentContext },
    );
  }

  /**
   * POST /socio/cuotas/{cuotaId}/informar-pago
   * multipart/form-data: `datos` (JSON) + `comprobante` (file).
   */
  reportSocioTransferPayment(
    cuotaId: string,
    datos: InformarPagoCuotaRequestDto,
    comprobante: File,
  ): Observable<InformarPagoResponseDto> {
    const formData = new FormData();
    formData.append(
      'datos',
      new Blob([JSON.stringify(datos)], { type: 'application/json' }),
    );
    formData.append('comprobante', comprobante, comprobante.name);

    return this.http.post<InformarPagoResponseDto>(
      `${this.socioCuotasBase}/${encodeURIComponent(cuotaId)}/informar-pago`,
      formData,
      { context: this.silentContext },
    );
  }

  /** POST /socio/cuotas/{cuotaId}/link-de-pago */
  createSocioPaymentLink(cuotaId: string): Observable<LinkDePagoResponseDto> {
    return this.http.post<LinkDePagoResponseDto>(
      `${this.socioCuotasBase}/${encodeURIComponent(cuotaId)}/link-de-pago`,
      null,
      { context: this.silentContext },
    );
  }

  /** GET /socio/cuotas/pagos/{pagoId}/comprobante */
  downloadSocioPaymentReceipt(pagoId: string): Observable<SocioPaymentReceiptDownload> {
    return this.http
      .get(`${this.socioCuotasBase}/pagos/${encodeURIComponent(pagoId)}/comprobante`, {
        responseType: 'blob',
        observe: 'response',
        context: this.silentContext,
      })
      .pipe(switchMap((response) => from(this.toReceiptDownload(response, pagoId))));
  }

  private async toAdminReceiptDownload(
    response: HttpResponse<Blob>,
    pagoId: string,
  ): Promise<AdminPaymentReceiptDownload> {
    return this.toReceiptDownload(response, pagoId);
  }

  private async toReceiptDownload(
    response: HttpResponse<Blob>,
    pagoId: string,
  ): Promise<AdminPaymentReceiptDownload> {
    const blob = response.body;
    if (!blob) {
      throw {
        status: 500,
        message: 'No se recibió el comprobante',
        code: 'EMPTY_FILE',
      } satisfies ApiError;
    }

    if (this.looksLikeJsonErrorBlob(blob, response.status)) {
      throw await this.parseBlobApiError(blob, response.status);
    }

    const fromHeader = parseContentDispositionFileName(
      response.headers.get('Content-Disposition'),
    );

    return {
      blob,
      fileName: fromHeader ?? `comprobante-${pagoId}`,
    };
  }

  private looksLikeJsonErrorBlob(blob: Blob, status: number): boolean {
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
          'No se pudo descargar el comprobante',
        code: parsed.codigo,
        details: fieldMessages.length > 0 ? fieldMessages : undefined,
      };
    } catch {
      return {
        status: status || 500,
        message: 'No se pudo descargar el comprobante',
        code: 'DOWNLOAD_ERROR',
      };
    }
  }
}
