import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Benefit } from '../interfaces/benefit.interface';
import { mockResponse } from '../utils/mock.util';
import benefitsMock from '../../../assets/mock-data/benefits.json';

@Injectable({ providedIn: 'root' })
export class BenefitService {
  private readonly http = inject(HttpClient);
  private readonly benefits = structuredClone(benefitsMock) as Benefit[];

  listForSocio(activeOnly = true): Observable<Benefit[]> {
    if (environment.useMocks) {
      const data = activeOnly
        ? this.benefits.filter((benefit) => benefit.isActive)
        : this.benefits;
      return mockResponse(data);
    }
    return this.http.get<Benefit[]>(`${environment.apiBaseUrl}/benefits`, {
      params: { activeOnly: String(activeOnly) },
    });
  }

  search(term: string): Observable<Benefit[]> {
    if (environment.useMocks) {
      const normalized = term.trim().toLowerCase();
      const results = this.benefits.filter(
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
    });
  }
}
