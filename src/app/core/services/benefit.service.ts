import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Benefit,
  BenefitMerchantCard,
  SocioBenefitsCatalogResponse,
} from '../interfaces/benefit.interface';
import { mockResponse } from '../utils/mock.util';
import catalogMock from '../../../assets/mock-data/socio-benefits-catalog.json';

/**
 * Benefits catalog for the socio portal.
 * Mock mode serves a typed catalog; swap to HttpClient when Swagger is ready.
 */
@Injectable({ providedIn: 'root' })
export class BenefitService {
  private readonly http = inject(HttpClient);
  private readonly catalog = structuredClone(
    catalogMock,
  ) as SocioBenefitsCatalogResponse;

  getCatalog(): Observable<SocioBenefitsCatalogResponse> {
    if (environment.useMocks) {
      return mockResponse(this.catalog);
    }

    return this.http.get<SocioBenefitsCatalogResponse>(
      `${environment.apiBaseUrl}/benefits/catalog`,
    );
  }

  listForSocio(activeOnly = true): Observable<Benefit[]> {
    if (environment.useMocks) {
      const data = activeOnly
        ? this.catalog.promotions.filter((benefit) => benefit.isActive)
        : this.catalog.promotions;
      return mockResponse(data);
    }

    return this.http.get<Benefit[]>(`${environment.apiBaseUrl}/benefits`, {
      params: { activeOnly: String(activeOnly) },
    });
  }

  listMerchants(): Observable<BenefitMerchantCard[]> {
    if (environment.useMocks) {
      return mockResponse(this.catalog.merchants);
    }

    return this.http.get<BenefitMerchantCard[]>(
      `${environment.apiBaseUrl}/benefits/merchants`,
    );
  }

  search(term: string): Observable<Benefit[]> {
    if (environment.useMocks) {
      const normalized = term.trim().toLowerCase();
      const results = this.catalog.promotions.filter(
        (benefit) =>
          benefit.isActive &&
          (benefit.title.toLowerCase().includes(normalized) ||
            benefit.merchantName.toLowerCase().includes(normalized) ||
            benefit.categoryName.toLowerCase().includes(normalized) ||
            benefit.description.toLowerCase().includes(normalized)),
      );
      return mockResponse(results);
    }

    return this.http.get<Benefit[]>(`${environment.apiBaseUrl}/benefits`, {
      params: { q: term },
    }).pipe(map((items) => items));
  }
}
