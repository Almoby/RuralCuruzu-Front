import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  Benefit,
  BenefitCategoryFilter,
  BenefitMerchantCard,
  SocioBenefitsCatalogResponse,
} from '../interfaces/benefit.interface';
import {
  ListarSocioBeneficiosParams,
  SocioBeneficioResumenDto,
  SocioComercioConBeneficiosDto,
} from '../interfaces/socio-benefit.interface';
import { SocioHistorialBeneficioDto } from '../interfaces/socio-panel.interface';
import { mapSocioBenefitsBundleToCatalog } from '../mappers/socio-benefit.mapper';
import { mockResponse } from '../utils/mock.util';
import catalogMock from '../../../assets/mock-data/socio-benefits-catalog.json';

/**
 * Benefits catalog + Socio benefit history.
 * - Socio Beneficios / Historial → always real backend (`/socio/beneficios*`).
 * - Legacy helpers → mocks until other callers migrate.
 */
@Injectable({ providedIn: 'root' })
export class BenefitService {
  private readonly http = inject(HttpClient);
  private readonly socioBase = `${environment.apiBaseUrl}/socio/beneficios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);
  private readonly catalog = structuredClone(
    catalogMock,
  ) as SocioBenefitsCatalogResponse;

  /**
   * Coordinated Socio Beneficios load (ignores useMocks):
   * - GET /socio/beneficios
   * - GET /socio/beneficios/comercios-con-beneficios
   */
  getSocioBenefitsCatalog(
    params?: ListarSocioBeneficiosParams,
    options?: { categories?: BenefitCategoryFilter[] },
  ): Observable<SocioBenefitsCatalogResponse> {
    return forkJoin({
      beneficios: this.getSocioBeneficios(params),
      comercios: this.getSocioComerciosConBeneficios(params),
    }).pipe(
      map((bundle) =>
        mapSocioBenefitsBundleToCatalog(bundle, {
          categories: options?.categories,
        }),
      ),
    );
  }

  /** GET /socio/beneficios */
  getSocioBeneficios(
    params?: ListarSocioBeneficiosParams,
  ): Observable<SocioBeneficioResumenDto[]> {
    return this.http
      .get<SocioBeneficioResumenDto[]>(this.socioBase, {
        params: this.toHttpParams(params),
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  /** GET /socio/beneficios/comercios-con-beneficios */
  getSocioComerciosConBeneficios(
    params?: ListarSocioBeneficiosParams,
  ): Observable<SocioComercioConBeneficiosDto[]> {
    return this.http
      .get<SocioComercioConBeneficiosDto[]>(`${this.socioBase}/comercios-con-beneficios`, {
        params: this.toHttpParams(params),
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  /**
   * GET /socio/beneficios/historial-beneficios
   * Socio Historial — ignores useMocks.
   */
  getSocioBenefitHistory(): Observable<SocioHistorialBeneficioDto[]> {
    return this.http
      .get<SocioHistorialBeneficioDto[]>(`${this.socioBase}/historial-beneficios`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
  }

  // --- Legacy (mocks / invented paths) — not used by Socio Beneficios / Historial ---

  /** @deprecated Socio Beneficios uses getSocioBenefitsCatalog(). */
  getCatalog(): Observable<SocioBenefitsCatalogResponse> {
    if (environment.useMocks) {
      return mockResponse(this.catalog);
    }

    return this.http.get<SocioBenefitsCatalogResponse>(
      `${environment.apiBaseUrl}/benefits/catalog`,
    );
  }

  /** @deprecated Prefer getSocioBeneficios(). */
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

  /** @deprecated Prefer getSocioComerciosConBeneficios(). */
  listMerchants(): Observable<BenefitMerchantCard[]> {
    if (environment.useMocks) {
      return mockResponse(this.catalog.merchants);
    }

    return this.http.get<BenefitMerchantCard[]>(
      `${environment.apiBaseUrl}/benefits/merchants`,
    );
  }

  /** @deprecated Prefer getSocioBeneficios({ busqueda }). */
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

    return this.http
      .get<Benefit[]>(`${environment.apiBaseUrl}/benefits`, {
        params: { q: term },
      })
      .pipe(map((items) => items));
  }

  private toHttpParams(params?: ListarSocioBeneficiosParams): HttpParams {
    let httpParams = new HttpParams();
    const rubro = params?.rubro?.trim();
    const busqueda = params?.busqueda?.trim();
    if (rubro) {
      httpParams = httpParams.set('rubro', rubro);
    }
    if (busqueda) {
      httpParams = httpParams.set('busqueda', busqueda);
    }
    return httpParams;
  }
}
