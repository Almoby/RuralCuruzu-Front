import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  MemberQrResponse,
  ShareQrPayload,
} from '../interfaces/member-qr.interface';
import { MiQrResponseDto } from '../interfaces/socio-qr.interface';
import {
  mapMiQrDtoToViewModel,
  mapSocioQrSharePayload,
} from '../mappers/socio-qr.mapper';
import { UserIdentityService } from './user-identity.service';

/**
 * Member QR access — Socio Mi QR (`GET /socio/perfil/mi-qr`).
 */
@Injectable({ providedIn: 'root' })
export class MemberQrService {
  private readonly http = inject(HttpClient);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly socioQrUrl = `${environment.apiBaseUrl}/socio/perfil/mi-qr`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /**
   * GET /socio/perfil/mi-qr
   * Calling again is the only supported way to renew the short-lived token.
   */
  getSocioQr(): Observable<MemberQrResponse> {
    return this.http
      .get<MiQrResponseDto>(this.socioQrUrl, { context: this.silentContext })
      .pipe(
        map((dto) => {
          const view = mapMiQrDtoToViewModel(dto);
          this.userIdentity.setSocioNumero(
            dto.numeroSocio ?? view.profile.memberNumber,
          );
          return view;
        }),
      );
  }

  /**
   * Renews the QR by requesting a new token from the same endpoint.
   * There is no dedicated refresh path in Swagger.
   */
  refreshSocioQr(): Observable<MemberQrResponse> {
    return this.getSocioQr();
  }

  /** Share metadata for the current view-model (never includes the token). */
  buildSocioQrSharePayload(view: MemberQrResponse): ShareQrPayload {
    return mapSocioQrSharePayload(view);
  }
}
