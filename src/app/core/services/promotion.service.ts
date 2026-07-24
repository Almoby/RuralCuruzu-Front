import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreatePromotionRequest,
  Promotion,
  UpdatePromotionRequest,
} from '../interfaces/promotion.interface';
import { PromotionStatus } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import promotionsMock from '../../../assets/mock-data/promotions.json';

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);
  private promotions: Promotion[] = structuredClone(promotionsMock) as Promotion[];

  list(merchantId?: string): Observable<Promotion[]> {
    if (environment.useMocks) {
      const data = merchantId
        ? this.promotions.filter((promo) => promo.merchantId === merchantId)
        : this.promotions;
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
}
