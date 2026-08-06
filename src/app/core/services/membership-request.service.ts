import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import {
  Observable,
  Subject,
  from,
  map,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  AgregarObservacionSolicitudRequest,
  CambiarEstadoSolicitudRequest,
  CambiarEstadoSolicitudResponse,
  ListarSolicitudesAdminParams,
  ObservacionAgregadaResponse,
  SolicitudArchivoDownload,
  SolicitudSocioDetalleDto,
  SolicitudSocioResumenDto,
} from '../interfaces/admin-solicitud-socio.interface';
import { ApiError } from '../interfaces/api-response.interface';
import {
  MembershipRequest,
  MembershipRequestSummary,
} from '../interfaces/member-request.interface';
import { ApiErrorResponse } from '../interfaces/respuesta-solicitud.interface';
import {
  SolicitudSocioCreadaResponse,
  SolicitudSocioRequest,
} from '../interfaces/solicitud-socio.interface';
import {
  mapSolicitudDetalleDtoToViewModel,
  mapSolicitudListItemDtoToViewModel,
  parseContentDispositionFileName,
} from '../mappers/admin-solicitud-socio.mapper';
import { RequestStatus } from '../../shared/enums';

/**
 * Membership requests access.
 * - Public create → `POST /solicitudes-socio`
 * - Admin Solicitudes → `/admin/solicitudes-socio*`
 */
@Injectable({ providedIn: 'root' })
export class MembershipRequestService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = `${environment.apiBaseUrl}/admin/solicitudes-socio`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);
  private readonly changesSubject = new Subject<void>();

  /** Emits when admin list/detail counters should refresh. */
  readonly changes$ = this.changesSubject.asObservable();

  getRequests(params?: ListarSolicitudesAdminParams): Observable<MembershipRequest[]> {
    return this.list(params);
  }

  /**
   * GET /admin/solicitudes-socio — full array (no pagination in Swagger).
   * Optional `estadoSolicitud` query only.
   */
  list(params?: ListarSolicitudesAdminParams): Observable<MembershipRequest[]> {
    let httpParams = new HttpParams();
    if (params?.estadoSolicitud) {
      httpParams = httpParams.set('estadoSolicitud', params.estadoSolicitud);
    }

    return this.http
      .get<SolicitudSocioResumenDto[]>(this.adminBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map((items) => items.map(mapSolicitudListItemDtoToViewModel)));
  }

  /** GET /admin/solicitudes-socio/{numeroSolicitud} */
  getRequestById(numeroSolicitud: string): Observable<MembershipRequest> {
    return this.getByNumero(numeroSolicitud);
  }

  getByNumero(numeroSolicitud: string): Observable<MembershipRequest> {
    return this.http
      .get<SolicitudSocioDetalleDto>(
        `${this.adminBase}/${encodeURIComponent(numeroSolicitud)}`,
        { context: this.silentContext },
      )
      .pipe(map(mapSolicitudDetalleDtoToViewModel));
  }

  getSummary(): Observable<MembershipRequestSummary> {
    return this.list().pipe(map((items) => this.toSummary(items)));
  }

  /**
   * Pending indicator: PENDIENTE + EN_REVISION (needs admin attention).
   * Derived from full list (Swagger has no dedicated counter endpoint).
   */
  countPending(): Observable<number> {
    return this.list().pipe(
      map(
        (requests) =>
          requests.filter(
            (request) =>
              request.status === RequestStatus.Pendiente ||
              request.status === RequestStatus.EnRevision,
          ).length,
      ),
    );
  }

  /**
   * Public “Quiero ser socio”.
   */
  createPublic(payload: SolicitudSocioRequest): Observable<SolicitudSocioCreadaResponse> {
    return this.http.post<SolicitudSocioCreadaResponse>(
      `${environment.apiBaseUrl}/solicitudes-socio`,
      payload,
      { context: this.silentContext },
    );
  }

  /** PATCH /admin/solicitudes-socio/{numero}/estado */
  changeEstado(
    numeroSolicitud: string,
    body: CambiarEstadoSolicitudRequest,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.http
      .patch<CambiarEstadoSolicitudResponse>(
        `${this.adminBase}/${encodeURIComponent(numeroSolicitud)}/estado`,
        body,
        { context: this.silentContext },
      )
      .pipe(tap(() => this.notifyChange()));
  }

  passToReview(
    numeroSolicitud: string,
    observacion?: string,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.changeEstado(numeroSolicitud, {
      nuevoEstado: RequestStatus.EnRevision,
      ...(observacion ? { observacion } : {}),
    });
  }

  approve(
    numeroSolicitud: string,
    observacion?: string,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.changeEstado(numeroSolicitud, {
      nuevoEstado: RequestStatus.Aprobada,
      ...(observacion ? { observacion } : {}),
    });
  }

  reject(
    numeroSolicitud: string,
    motivo: string,
    observacion?: string,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.changeEstado(numeroSolicitud, {
      nuevoEstado: RequestStatus.Rechazada,
      motivo,
      ...(observacion ? { observacion } : {}),
    });
  }

  cancel(
    numeroSolicitud: string,
    motivo: string,
    observacion?: string,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.changeEstado(numeroSolicitud, {
      nuevoEstado: RequestStatus.Cancelada,
      motivo,
      ...(observacion ? { observacion } : {}),
    });
  }

  reopen(
    numeroSolicitud: string,
    observacion?: string,
  ): Observable<CambiarEstadoSolicitudResponse> {
    return this.changeEstado(numeroSolicitud, {
      nuevoEstado: RequestStatus.EnRevision,
      ...(observacion ? { observacion } : {}),
    });
  }

  /** POST /admin/solicitudes-socio/{numero}/observaciones */
  addObservacion(
    numeroSolicitud: string,
    observacion: string,
  ): Observable<ObservacionAgregadaResponse> {
    const body: AgregarObservacionSolicitudRequest = { observacion };
    return this.http
      .post<ObservacionAgregadaResponse>(
        `${this.adminBase}/${encodeURIComponent(numeroSolicitud)}/observaciones`,
        body,
        { context: this.silentContext },
      )
      .pipe(tap(() => this.notifyChange()));
  }

  /**
   * GET /admin/solicitudes-socio/{numero}/archivos?ruta=
   * Uses blob + Content-Disposition when available.
   */
  downloadArchivo(
    numeroSolicitud: string,
    ruta: string,
  ): Observable<SolicitudArchivoDownload> {
    const params = new HttpParams().set('ruta', ruta);

    return this.http
      .get(`${this.adminBase}/${encodeURIComponent(numeroSolicitud)}/archivos`, {
        params,
        responseType: 'blob',
        observe: 'response',
        context: this.silentContext,
      })
      .pipe(switchMap((response) => from(this.toArchivoDownload(response, ruta))));
  }

  private async toArchivoDownload(
    response: HttpResponse<Blob>,
    ruta: string,
  ): Promise<SolicitudArchivoDownload> {
    const blob = response.body;
    if (!blob) {
      throw {
        status: 500,
        message: 'No se recibió el archivo',
        code: 'EMPTY_FILE',
      } satisfies ApiError;
    }

    if (this.looksLikeJsonError(blob, response.status)) {
      throw await this.parseBlobApiError(blob, response.status);
    }

    const fromHeader = parseContentDispositionFileName(
      response.headers.get('Content-Disposition'),
    );
    const fallback = ruta.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'archivo';

    return {
      blob,
      fileName: fromHeader ?? fallback,
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
          'No se pudo descargar el archivo',
        code: parsed.codigo,
        details: fieldMessages.length > 0 ? fieldMessages : undefined,
      };
    } catch {
      return {
        status: status || 500,
        message: 'No se pudo descargar el archivo',
        code: 'DOWNLOAD_ERROR',
      };
    }
  }

  private toSummary(items: MembershipRequest[]): MembershipRequestSummary {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === RequestStatus.Pendiente).length,
      inReview: items.filter((item) => item.status === RequestStatus.EnRevision).length,
      approved: items.filter((item) => item.status === RequestStatus.Aprobada).length,
      rejected: items.filter((item) => item.status === RequestStatus.Rechazada).length,
      cancelled: items.filter((item) => item.status === RequestStatus.Cancelada).length,
    };
  }

  private notifyChange(): void {
    this.changesSubject.next();
  }
}
