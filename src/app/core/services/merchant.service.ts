import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ActualizarComercioParcialRequest,
  AdminDeletedMerchantViewModel,
  AdminMerchant,
  AdminMerchantCategoryOption,
  AdminMerchantDetail,
  AltaComercioRequest,
  CambiarEstadoComercioRequest,
  CambiarEstadoComercioResponseDto,
  ComercioActualizadoResponseDto,
  ComercioCreadoResponseDto,
  ComercioDetalleDto,
  ComercioEliminadoResponseDto,
  ComercioResumenDto,
  EliminarComercioRequest,
  EliminarComercioResponseDto,
  ListarComerciosAdminParams,
} from '../interfaces/admin-comercio.interface';
import {
  buildAdminRubroOptions,
  mapComercioDetalleDtoToViewModel,
  mapComercioResumenDtoToViewModel,
} from '../mappers/admin-comercio.mapper';
import {
  mapComercioEliminadoDtoToViewModel,
  sortDeletedMerchants,
} from '../mappers/admin-comercio-eliminado.mapper';

/**
 * Merchants / comercios access — Admin Comercios Adheridos (`/admin/comercios*`).
 */
@Injectable({ providedIn: 'root' })
export class MerchantService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = `${environment.apiBaseUrl}/admin/comercios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET `${apiBaseUrl}/admin/comercios`
   * Optional query: `estado`.
   */
  getAdminMerchants(params?: ListarComerciosAdminParams): Observable<AdminMerchant[]> {
    let httpParams = new HttpParams();
    if (params?.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }

    return this.http
      .get<ComercioResumenDto[]>(this.adminBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).map(mapComercioResumenDtoToViewModel)));
  }

  /**
   * GET `${apiBaseUrl}/admin/comercios/{id}`
   */
  getAdminMerchantById(
    id: string,
    listHints?: Pick<AdminMerchant, 'consumptions' | 'activePromotionsCount'>,
  ): Observable<AdminMerchantDetail> {
    return this.http
      .get<ComercioDetalleDto>(`${this.adminBase}/${encodeURIComponent(id)}`, {
        context: this.silentContext,
      })
      .pipe(map((dto) => mapComercioDetalleDtoToViewModel(dto, listHints)));
  }

  /**
   * POST `${apiBaseUrl}/admin/comercios`
   */
  createAdminMerchant(body: AltaComercioRequest): Observable<AdminMerchantDetail> {
    return this.http
      .post<ComercioCreadoResponseDto>(this.adminBase, body, {
        context: this.silentContext,
      })
      .pipe(
        map((response) => {
          if (!response.comercio?.id) {
            throw {
              status: 500,
              message: response.mensaje?.trim() || 'Comercio creado sin datos de respuesta',
              code: 'COMERCIO_CREATE_EMPTY',
            };
          }
          return mapComercioDetalleDtoToViewModel(response.comercio);
        }),
      );
  }

  /**
   * PATCH `${apiBaseUrl}/admin/comercios/{id}`
   */
  updateAdminMerchant(
    id: string,
    body: ActualizarComercioParcialRequest,
  ): Observable<AdminMerchantDetail> {
    return this.http
      .patch<ComercioActualizadoResponseDto>(
        `${this.adminBase}/${encodeURIComponent(id)}`,
        body,
        { context: this.silentContext },
      )
      .pipe(
        map((response) => {
          if (!response.comercio?.id) {
            throw {
              status: 500,
              message: response.mensaje?.trim() || 'Comercio actualizado sin datos de respuesta',
              code: 'COMERCIO_UPDATE_EMPTY',
            };
          }
          return mapComercioDetalleDtoToViewModel(response.comercio);
        }),
      );
  }

  /**
   * PATCH `${apiBaseUrl}/admin/comercios/{id}/estado`
   */
  changeAdminMerchantEstado(
    id: string,
    body: CambiarEstadoComercioRequest,
  ): Observable<CambiarEstadoComercioResponseDto> {
    return this.http.patch<CambiarEstadoComercioResponseDto>(
      `${this.adminBase}/${encodeURIComponent(id)}/estado`,
      body,
      { context: this.silentContext },
    );
  }

  activateAdminMerchant(id: string): Observable<CambiarEstadoComercioResponseDto> {
    return this.changeAdminMerchantEstado(id, { nuevoEstado: 'ACTIVO' });
  }

  deactivateAdminMerchant(id: string): Observable<CambiarEstadoComercioResponseDto> {
    return this.changeAdminMerchantEstado(id, { nuevoEstado: 'INACTIVO' });
  }

  /**
   * DELETE `${apiBaseUrl}/admin/comercios/{id}`
   * Body required: `{ motivo }`.
   */
  deleteAdminMerchant(
    id: string,
    body: EliminarComercioRequest,
  ): Observable<EliminarComercioResponseDto> {
    return this.http.request<EliminarComercioResponseDto>(
      'DELETE',
      `${this.adminBase}/${encodeURIComponent(id)}`,
      {
        body,
        context: this.silentContext,
      },
    );
  }

  /**
   * GET `${apiBaseUrl}/admin/comercios/eliminados`
   */
  getAdminDeletedMerchants(): Observable<AdminDeletedMerchantViewModel[]> {
    return this.http
      .get<ComercioEliminadoResponseDto[]>(`${this.adminBase}/eliminados`, {
        context: this.silentContext,
      })
      .pipe(
        map((items) =>
          sortDeletedMerchants((items ?? []).map(mapComercioEliminadoDtoToViewModel)),
        ),
      );
  }

  /** Client-side rubro options for the admin form (no Swagger catalog). */
  getAdminRubroOptions(): AdminMerchantCategoryOption[] {
    return buildAdminRubroOptions();
  }
}
