import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ComercioQrRedemptionSuccessViewModel,
  ValidarBeneficioRequestDto,
  ValidarBeneficioResponseDto,
} from '../interfaces/comercio-qr-redemption.interface';
import { mapValidarBeneficioResponseToSuccessViewModel } from '../mappers/comercio-qr-redemption.mapper';

/**
 * Redemptions / QR canje — Comercio Validar QR
 * (`POST /comercio/beneficios/canjear-beneficio`).
 */
@Injectable({ providedIn: 'root' })
export class RedemptionService {
  private readonly http = inject(HttpClient);
  private readonly comercioCanjeUrl = `${environment.apiBaseUrl}/comercio/beneficios/canjear-beneficio`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * POST /comercio/beneficios/canjear-beneficio
   */
  redeemComercioBenefit(
    body: ValidarBeneficioRequestDto,
  ): Observable<ComercioQrRedemptionSuccessViewModel> {
    return this.http
      .post<ValidarBeneficioResponseDto>(this.comercioCanjeUrl, body, {
        context: this.silentContext,
      })
      .pipe(map(mapValidarBeneficioResponseToSuccessViewModel));
  }
}
