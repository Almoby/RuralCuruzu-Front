import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ActualizarBeneficioRequestDto,
  BeneficioCreadoResponseDto,
  BeneficioEstadoDto,
  BeneficioResponseDto,
  CambiarEstadoBeneficioRequestDto,
  ComercioBeneficioViewModel,
  CrearBeneficioRequestDto,
} from '../interfaces/comercio-beneficio.interface';
import {
  mapComercioBeneficioDtoToViewModel,
  mapComercioBeneficiosToViewModels,
} from '../mappers/comercio-beneficio.mapper';

/**
 * Promotions / beneficios — Comercio Mis Promociones (`/comercio/beneficios*`).
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly comercioBase = `${environment.apiBaseUrl}/comercio/beneficios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /** GET /comercio/beneficios */
  getComercioBeneficios(): Observable<ComercioBeneficioViewModel[]> {
    return this.http
      .get<BeneficioResponseDto[]>(this.comercioBase, {
        context: this.silentContext,
      })
      .pipe(map((items) => mapComercioBeneficiosToViewModels(items)));
  }

  /** GET /comercio/beneficios/{id} */
  getComercioBeneficioById(id: string): Observable<ComercioBeneficioViewModel> {
    return this.http
      .get<BeneficioResponseDto>(`${this.comercioBase}/${id}`, {
        context: this.silentContext,
      })
      .pipe(map(mapComercioBeneficioDtoToViewModel));
  }

  /** POST /comercio/beneficios */
  createComercioBeneficio(
    body: CrearBeneficioRequestDto,
  ): Observable<ComercioBeneficioViewModel> {
    return this.http
      .post<BeneficioCreadoResponseDto>(this.comercioBase, body, {
        context: this.silentContext,
      })
      .pipe(
        map((response) => {
          if (!response?.beneficio) {
            throw {
              status: 500,
              message: response?.mensaje?.trim() || 'No se recibió el beneficio creado',
              code: 'EMPTY_BENEFICIO',
            };
          }
          return mapComercioBeneficioDtoToViewModel(response.beneficio);
        }),
      );
  }

  /** PUT /comercio/beneficios/{id} */
  updateComercioBeneficio(
    id: string,
    body: ActualizarBeneficioRequestDto,
  ): Observable<ComercioBeneficioViewModel> {
    return this.http
      .put<BeneficioResponseDto>(`${this.comercioBase}/${id}`, body, {
        context: this.silentContext,
      })
      .pipe(map(mapComercioBeneficioDtoToViewModel));
  }

  /** PATCH /comercio/beneficios/{id}/estado */
  changeComercioBeneficioEstado(
    id: string,
    nuevoEstado: BeneficioEstadoDto,
  ): Observable<ComercioBeneficioViewModel> {
    const body: CambiarEstadoBeneficioRequestDto = { nuevoEstado };
    return this.http
      .patch<BeneficioResponseDto>(`${this.comercioBase}/${id}/estado`, body, {
        context: this.silentContext,
      })
      .pipe(map(mapComercioBeneficioDtoToViewModel));
  }
}
