import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map, tap, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ActualizarTipoBeneficioRequestDto,
  AdminBenefitTypeViewModel,
  BenefitTypeOptionViewModel,
  CrearTipoBeneficioRequestDto,
  TipoBeneficioActualizadoResponseDto,
  TipoBeneficioCreadoResponseDto,
  TipoBeneficioMensajeResponseDto,
  TipoBeneficioResponseDto,
} from '../interfaces/benefit-type.interface';
import {
  mapTipoBeneficiosToAdminViewModels,
  mapTipoBeneficiosToOptions,
  mapTipoBeneficioDtoToAdminViewModel,
} from '../mappers/benefit-type.mapper';

/**
 * Benefit-type catalog.
 * - Comercio: GET /tipos-beneficio (activos)
 * - Admin: /admin/tipos-beneficio*
 * Benefit types catalog against the real backend.
 */
@Injectable({ providedIn: 'root' })
export class BenefitTypeService {
  private readonly http = inject(HttpClient);
  private readonly publicBase = `${environment.apiBaseUrl}/tipos-beneficio`;
  private readonly adminBase = `${environment.apiBaseUrl}/admin/tipos-beneficio`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  private activeTypes$?: Observable<BenefitTypeOptionViewModel[]>;

  /** GET /tipos-beneficio — only ACTIVE types (Comercio dropdown). */
  getActiveBenefitTypes(options?: {
    forceRefresh?: boolean;
  }): Observable<BenefitTypeOptionViewModel[]> {
    if (options?.forceRefresh || !this.activeTypes$) {
      this.activeTypes$ = this.http
        .get<TipoBeneficioResponseDto[]>(this.publicBase, {
          context: this.silentContext,
        })
        .pipe(
          map(mapTipoBeneficiosToOptions),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.activeTypes$;
  }

  /** Drops the cached active catalog (after Admin mutations / failed retry). */
  clearCache(): void {
    this.activeTypes$ = undefined;
  }

  /** GET /admin/tipos-beneficio — activos e inactivos. */
  getAdminBenefitTypes(): Observable<AdminBenefitTypeViewModel[]> {
    return this.http
      .get<TipoBeneficioResponseDto[]>(this.adminBase, {
        context: this.silentContext,
      })
      .pipe(map(mapTipoBeneficiosToAdminViewModels));
  }

  /** POST /admin/tipos-beneficio */
  createAdminBenefitType(
    body: CrearTipoBeneficioRequestDto,
  ): Observable<{ mensaje: string; tipo: AdminBenefitTypeViewModel }> {
    return this.http
      .post<TipoBeneficioCreadoResponseDto>(this.adminBase, body, {
        context: this.silentContext,
      })
      .pipe(
        map((response) => {
          const tipo = response.tipoBeneficio
            ? mapTipoBeneficioDtoToAdminViewModel(response.tipoBeneficio)
            : null;
          if (!tipo) {
            throw {
              status: 500,
              message:
                response.mensaje?.trim() ||
                'No se recibió el tipo de beneficio creado',
              code: 'EMPTY_TIPO_BENEFICIO',
            };
          }
          return {
            mensaje: response.mensaje?.trim() || 'Tipo de beneficio creado con éxito',
            tipo,
          };
        }),
        tap(() => this.clearCache()),
      );
  }

  /** PATCH /admin/tipos-beneficio/{id} */
  updateAdminBenefitType(
    id: string,
    body: ActualizarTipoBeneficioRequestDto,
  ): Observable<{ mensaje: string; tipo: AdminBenefitTypeViewModel }> {
    return this.http
      .patch<TipoBeneficioActualizadoResponseDto>(
        `${this.adminBase}/${encodeURIComponent(id)}`,
        body,
        { context: this.silentContext },
      )
      .pipe(
        map((response) => {
          const tipo = response.tipoBeneficio
            ? mapTipoBeneficioDtoToAdminViewModel(response.tipoBeneficio)
            : null;
          if (!tipo) {
            throw {
              status: 500,
              message:
                response.mensaje?.trim() ||
                'No se recibió el tipo de beneficio actualizado',
              code: 'EMPTY_TIPO_BENEFICIO',
            };
          }
          return {
            mensaje:
              response.mensaje?.trim() || 'Tipo de beneficio actualizado con éxito',
            tipo,
          };
        }),
        tap(() => this.clearCache()),
      );
  }

  /** DELETE /admin/tipos-beneficio/{id} */
  deleteAdminBenefitType(id: string): Observable<string> {
    return this.http
      .delete<TipoBeneficioMensajeResponseDto>(
        `${this.adminBase}/${encodeURIComponent(id)}`,
        { context: this.silentContext },
      )
      .pipe(
        map(
          (response) =>
            response?.mensaje?.trim() || 'Tipo de beneficio eliminado correctamente',
        ),
        tap(() => this.clearCache()),
      );
  }
}
