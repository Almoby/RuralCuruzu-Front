import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CreateMerchantRequest,
  Merchant,
  MerchantCategoryOption,
  MerchantDetail,
  MerchantSummary,
  UpdateMerchantRequest,
} from '../interfaces/merchant.interface';
import { MerchantCategory, MerchantStatus } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import merchantsMock from '../../../assets/mock-data/merchants.json';

const CATEGORY_OPTIONS: MerchantCategoryOption[] = Object.values(MerchantCategory).map(
  (value) => ({ value, label: value }),
);

@Injectable({ providedIn: 'root' })
export class MerchantService {
  private readonly http = inject(HttpClient);
  private merchants: Merchant[] = structuredClone(merchantsMock) as Merchant[];

  getMerchants(): Observable<Merchant[]> {
    return this.list();
  }

  list(): Observable<Merchant[]> {
    if (environment.useMocks) {
      return mockResponse([...this.merchants]);
    }
    return this.http.get<Merchant[]>(`${environment.apiBaseUrl}/merchants`);
  }

  getMerchantById(id: string): Observable<MerchantDetail> {
    return this.getById(id);
  }

  getById(id: string): Observable<MerchantDetail> {
    if (environment.useMocks) {
      const merchant = this.merchants.find((item) => item.id === id);
      if (!merchant) {
        return throwError(() => ({
          status: 404,
          message: 'Comercio no encontrado',
          code: 'MERCHANT_NOT_FOUND',
        }));
      }
      return mockResponse({ ...merchant });
    }
    return this.http.get<MerchantDetail>(`${environment.apiBaseUrl}/merchants/${id}`);
  }

  getMerchantSummary(): Observable<MerchantSummary> {
    if (environment.useMocks) {
      const activeCount = this.merchants.filter(
        (item) => item.status === MerchantStatus.Activo,
      ).length;
      return mockResponse({
        total: this.merchants.length,
        activeCount,
        inactiveCount: this.merchants.length - activeCount,
      });
    }
    return this.http.get<MerchantSummary>(`${environment.apiBaseUrl}/merchants/summary`);
  }

  getMerchantCategories(): Observable<MerchantCategoryOption[]> {
    if (environment.useMocks) {
      return mockResponse([...CATEGORY_OPTIONS]);
    }
    return this.http.get<MerchantCategoryOption[]>(
      `${environment.apiBaseUrl}/merchants/categories`,
    );
  }

  createMerchant(payload: CreateMerchantRequest): Observable<Merchant> {
    return this.create(payload);
  }

  create(payload: CreateMerchantRequest): Observable<Merchant> {
    if (environment.useMocks) {
      const created: Merchant = {
        id: `m-${String(this.merchants.length + 1).padStart(3, '0')}`,
        name: payload.name.trim(),
        tradeName: payload.tradeName.trim(),
        email: payload.email.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        category: payload.category,
        cuit: payload.cuit.trim(),
        contactPerson: payload.contactPerson?.trim() || payload.tradeName.trim(),
        logoUrl: payload.logoUrl,
        status: MerchantStatus.Activo,
        joinedAt: new Date().toISOString().slice(0, 10),
        activePromotionsCount: 0,
        consumptions: 0,
      };
      this.merchants = [...this.merchants, created];
      return mockResponse(created);
    }
    return this.http.post<Merchant>(`${environment.apiBaseUrl}/merchants`, payload);
  }

  updateMerchant(id: string, payload: UpdateMerchantRequest): Observable<Merchant> {
    return this.update(id, payload);
  }

  update(id: string, payload: UpdateMerchantRequest): Observable<Merchant> {
    if (environment.useMocks) {
      const index = this.merchants.findIndex((item) => item.id === id);
      if (index < 0) {
        return throwError(() => ({
          status: 404,
          message: 'Comercio no encontrado',
          code: 'MERCHANT_NOT_FOUND',
        }));
      }
      const updated: Merchant = { ...this.merchants[index], ...payload };
      this.merchants = this.merchants.map((item, i) => (i === index ? updated : item));
      return mockResponse(updated);
    }
    return this.http.put<Merchant>(`${environment.apiBaseUrl}/merchants/${id}`, payload);
  }

  activateMerchant(id: string): Observable<Merchant> {
    return this.update(id, { status: MerchantStatus.Activo });
  }

  deactivateMerchant(id: string): Observable<Merchant> {
    return this.update(id, { status: MerchantStatus.Inactivo });
  }

  deleteMerchant(id: string): Observable<void> {
    if (environment.useMocks) {
      const exists = this.merchants.some((item) => item.id === id);
      if (!exists) {
        return throwError(() => ({
          status: 404,
          message: 'Comercio no encontrado',
          code: 'MERCHANT_NOT_FOUND',
        }));
      }
      this.merchants = this.merchants.filter((item) => item.id !== id);
      return of(undefined).pipe(delay(environment.mockDelayMs));
    }
    return this.http.delete<void>(`${environment.apiBaseUrl}/merchants/${id}`);
  }

  getActiveCount(): Observable<number> {
    return this.list().pipe(
      map(
        (items) => items.filter((item) => item.status === MerchantStatus.Activo).length,
      ),
    );
  }
}
