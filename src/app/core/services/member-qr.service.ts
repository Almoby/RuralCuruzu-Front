import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  MemberQrResponse,
  MemberQrSummary,
  RefreshMemberQrResponse,
  ShareQrPayload,
} from '../interfaces/member-qr.interface';
import { MiQrResponseDto } from '../interfaces/socio-qr.interface';
import {
  mapMiQrDtoToViewModel,
  mapSocioQrSharePayload,
} from '../mappers/socio-qr.mapper';
import { mockResponse } from '../utils/mock.util';
import socioQrMock from '../../../assets/mock-data/socio-qr.json';
import { UserIdentityService } from './user-identity.service';

/**
 * Member QR access.
 * - Socio Mi QR → always real backend (`GET /socio/perfil/mi-qr`).
 * - Legacy helpers → mocks for any unmigrated callers.
 */
@Injectable({ providedIn: 'root' })
export class MemberQrService {
  private readonly http = inject(HttpClient);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly socioQrUrl = `${environment.apiBaseUrl}/socio/perfil/mi-qr`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);
  private mockState: MemberQrResponse = structuredClone(
    socioQrMock,
  ) as MemberQrResponse;

  /**
   * GET /socio/perfil/mi-qr — always hits the real API (ignores useMocks).
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

  // --- Legacy (mocks / invented paths) — not used by Mi QR ---

  /** @deprecated Mi QR uses getSocioQr(). */
  getMemberQr(): Observable<MemberQrResponse> {
    if (environment.useMocks) {
      return mockResponse(structuredClone(this.mockState));
    }

    return this.http.get<MemberQrResponse>(`${environment.apiBaseUrl}/members/me/qr`);
  }

  /** @deprecated */
  getMemberQrSummary(): Observable<MemberQrSummary> {
    return this.getMemberQr().pipe(map((response) => response.summary));
  }

  /** @deprecated Mi QR uses refreshSocioQr() → GET /socio/perfil/mi-qr. */
  refreshMemberQr(): Observable<RefreshMemberQrResponse> {
    if (environment.useMocks) {
      const stamp = Date.now().toString(36).toUpperCase();
      const number = this.mockState.profile.memberNumber.replace('-', '');
      const qrValue = `QR-${number}-${stamp}`;
      this.mockState = {
        ...this.mockState,
        available: true,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        qr: {
          qrValue,
          status: 'active',
          statusLabel: 'QR Activo',
          statusIcon: 'check_circle',
          generatedAt: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 30_000).toISOString(),
        },
      };
      return mockResponse({
        qr: this.mockState.qr,
        available: true,
        message: this.mockState.message,
        expiresAt: this.mockState.expiresAt,
        profile: this.mockState.profile,
        summary: this.mockState.summary,
      });
    }

    return this.http.post<RefreshMemberQrResponse>(
      `${environment.apiBaseUrl}/members/me/qr/refresh`,
      {},
    );
  }

  /** @deprecated Mi QR builds share payload locally without the token. */
  shareMemberQr(): Observable<ShareQrPayload> {
    if (environment.useMocks) {
      return mockResponse(mapSocioQrSharePayload(this.mockState), 150);
    }

    return this.http.get<ShareQrPayload>(`${environment.apiBaseUrl}/members/me/qr/share`);
  }
}
