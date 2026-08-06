import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  BenefitCategoryFilter,
  SocioBenefitsCatalogResponse,
} from '../interfaces/benefit.interface';
import {
  ListarSocioBeneficiosParams,
  SocioBeneficioResumenDto,
  SocioComercioConBeneficiosDto,
} from '../interfaces/socio-benefit.interface';
import { SocioHistorialBeneficioDto } from '../interfaces/socio-panel.interface';
import { mapSocioBenefitsBundleToCatalog } from '../mappers/socio-benefit.mapper';

/**
 * Benefits catalog + Socio benefit history (`/socio/beneficios*`).
 */
@Injectable({ providedIn: 'root' })
export class BenefitService {
  private readonly http = inject(HttpClient);
  private readonly socioBase = `${environment.apiBaseUrl}/socio/beneficios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * Coordinated Socio Beneficios load:
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
   */
  getSocioBenefitHistory(): Observable<SocioHistorialBeneficioDto[]> {
    return this.http
      .get<SocioHistorialBeneficioDto[]>(`${this.socioBase}/historial-beneficios`, {
        context: this.silentContext,
      })
      .pipe(map((items) => items ?? []));
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
