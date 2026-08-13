import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ActualizarSocioParcialRequestDto,
  AdminMember,
  AdminMemberDetail,
  AltaManualSocioRequest,
  CambiarEstadoSocioRequestDto,
  CambiarEstadoSocioResponseDto,
  ListarSociosAdminParams,
  SocioActualizadoResponseDto,
  SocioCreadoResponse,
  SocioDetalleDto,
  SocioResumenDto,
} from '../interfaces/admin-socio.interface';
import {
  mapSocioDetalleDtoToViewModel,
  mapSocioListItemDtoToViewModel,
} from '../mappers/admin-socio.mapper';

/**
 * Members access — Admin Gestión de Socios (`/admin/socios*`).
 */
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = `${environment.apiBaseUrl}/admin/socios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET `${apiBaseUrl}/admin/socios`
   * Optional query: `estado`, `categoria` (ACTIVO | ADHERENTE).
   */
  getAdminSocios(params?: ListarSociosAdminParams): Observable<AdminMember[]> {
    let httpParams = new HttpParams();
    if (params?.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }
    if (params?.categoria) {
      httpParams = httpParams.set('categoria', params.categoria);
    }

    return this.http
      .get<SocioResumenDto[]>(this.adminBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).map(mapSocioListItemDtoToViewModel)));
  }

  /**
   * GET `${apiBaseUrl}/admin/socios/{id}`
   */
  getAdminSocioById(id: string): Observable<AdminMemberDetail> {
    return this.http
      .get<SocioDetalleDto>(`${this.adminBase}/${encodeURIComponent(id)}`, {
        context: this.silentContext,
      })
      .pipe(map(mapSocioDetalleDtoToViewModel));
  }

  /**
   * POST `${apiBaseUrl}/admin/socios`
   */
  createAdminSocio(payload: AltaManualSocioRequest): Observable<SocioCreadoResponse> {
    return this.http.post<SocioCreadoResponse>(this.adminBase, payload, {
      context: this.silentContext,
    });
  }

  /**
   * PATCH `${apiBaseUrl}/admin/socios/{id}`
   * Partial update — only non-empty body fields are applied by the backend.
   */
  updateAdminSocio(
    id: string,
    payload: ActualizarSocioParcialRequestDto,
  ): Observable<SocioActualizadoResponseDto> {
    return this.http.patch<SocioActualizadoResponseDto>(
      `${this.adminBase}/${encodeURIComponent(id)}`,
      payload,
      { context: this.silentContext },
    );
  }

  /**
   * PATCH `${apiBaseUrl}/admin/socios/{id}/estado`
   * Body: `{ nuevoEstado }`. Any transition is allowed by contract.
   */
  changeAdminSocioEstado(
    id: string,
    payload: CambiarEstadoSocioRequestDto,
  ): Observable<CambiarEstadoSocioResponseDto> {
    return this.http.patch<CambiarEstadoSocioResponseDto>(
      `${this.adminBase}/${encodeURIComponent(id)}/estado`,
      payload,
      { context: this.silentContext },
    );
  }
}
