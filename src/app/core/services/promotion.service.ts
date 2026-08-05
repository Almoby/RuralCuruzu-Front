import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
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
  CreatePromotionRequest,
  Promotion,
  UpdatePromotionRequest,
} from '../interfaces/promotion.interface';
import {
  mapComercioBeneficioDtoToViewModel,
  mapComercioBeneficiosToViewModels,
} from '../mappers/comercio-beneficio.mapper';
import { PromotionStatus, PromotionType } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import promotionsMock from '../../../assets/mock-data/promotions.json';

/**
 * Promotions / beneficios access.
 * - Comercio Mis Promociones → always real backend (`/comercio/beneficios*`).
 * - Legacy helpers (Validar QR, etc.) → still mocks / invented `/promotions*` when `useMocks`.
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly comercioBase = `${environment.apiBaseUrl}/comercio/beneficios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  private promotions: Promotion[] = (structuredClone(promotionsMock) as Promotion[]).map(
    (promo) => ({
      ...promo,
      type: promo.type ?? PromotionType.Descuento,
    }),
  );

  // ---------------------------------------------------------------------------
  // Comercio Mis Promociones — backend real (ignores environment.useMocks)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Legacy — Validar QR / unmigrated callers (mocks when useMocks)
  // ---------------------------------------------------------------------------

  list(merchantId?: string): Observable<Promotion[]> {
    if (environment.useMocks) {
      const data = merchantId
        ? this.promotions.filter((promo) => promo.merchantId === merchantId)
        : [...this.promotions];
      return mockResponse(data);
    }

    const url = merchantId
      ? `${environment.apiBaseUrl}/promotions?merchantId=${merchantId}`
      : `${environment.apiBaseUrl}/promotions`;
    return this.http.get<Promotion[]>(url);
  }

  create(payload: CreatePromotionRequest): Observable<Promotion> {
    if (environment.useMocks) {
      const created: Promotion = {
        id: `promo-${String(this.promotions.length + 1).padStart(3, '0')}`,
        merchantId: payload.merchantId,
        merchantName: 'Comercio',
        title: payload.title,
        description: payload.description,
        type: payload.type,
        discountLabel: payload.discountLabel,
        discountPercent: payload.discountPercent,
        status: PromotionStatus.Activa,
        validFrom: payload.validFrom,
        validTo: payload.validTo,
        redemptionsCount: 0,
        imageUrl: payload.imageUrl,
        terms: payload.terms,
        createdAt: new Date().toISOString(),
      };
      this.promotions = [created, ...this.promotions];
      return mockResponse(created);
    }
    return this.http.post<Promotion>(`${environment.apiBaseUrl}/promotions`, payload);
  }

  update(id: string, payload: UpdatePromotionRequest): Observable<Promotion> {
    if (environment.useMocks) {
      const index = this.promotions.findIndex((item) => item.id === id);
      if (index < 0) {
        return throwError(() => ({
          status: 404,
          message: 'Promoción no encontrada',
          code: 'PROMOTION_NOT_FOUND',
        }));
      }
      const updated: Promotion = { ...this.promotions[index], ...payload };
      this.promotions = this.promotions.map((item, i) => (i === index ? updated : item));
      return mockResponse(updated);
    }
    return this.http.put<Promotion>(`${environment.apiBaseUrl}/promotions/${id}`, payload);
  }

  toggleStatus(id: string): Observable<Promotion> {
    if (environment.useMocks) {
      const current = this.promotions.find((item) => item.id === id);
      if (!current) {
        return throwError(() => ({
          status: 404,
          message: 'Promoción no encontrada',
          code: 'PROMOTION_NOT_FOUND',
        }));
      }

      const nextStatus =
        current.status === PromotionStatus.Activa
          ? PromotionStatus.Inactiva
          : PromotionStatus.Activa;

      return this.update(id, { status: nextStatus });
    }

    return this.http.patch<Promotion>(`${environment.apiBaseUrl}/promotions/${id}/toggle`, {});
  }
}
