import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MemberQrResponse,
  MemberQrSummary,
  RefreshMemberQrResponse,
  ShareQrPayload,
} from '../interfaces/member-qr.interface';
import { mockResponse } from '../utils/mock.util';
import socioQrMock from '../../../assets/mock-data/socio-qr.json';

/**
 * Member QR access.
 * Mock mode returns typed payloads; swap to HttpClient when Swagger is ready.
 */
@Injectable({ providedIn: 'root' })
export class MemberQrService {
  private readonly http = inject(HttpClient);
  private mockState: MemberQrResponse = structuredClone(socioQrMock as MemberQrResponse);

  getMemberQr(): Observable<MemberQrResponse> {
    if (environment.useMocks) {
      return mockResponse(this.mockState);
    }

    return this.http.get<MemberQrResponse>(`${environment.apiBaseUrl}/members/me/qr`);
  }

  getMemberQrSummary(): Observable<MemberQrSummary> {
    return this.getMemberQr().pipe(map((response) => response.summary));
  }

  refreshMemberQr(): Observable<RefreshMemberQrResponse> {
    if (environment.useMocks) {
      const stamp = Date.now().toString(36).toUpperCase();
      const qrValue = `QR-${this.mockState.profile.memberNumber.replace('-', '')}-${stamp}`;
      this.mockState = {
        ...this.mockState,
        qr: {
          ...this.mockState.qr,
          qrValue,
          generatedAt: new Date().toISOString(),
          status: 'active',
          statusLabel: 'QR Activo',
          statusIcon: 'check_circle',
        },
      };
      return mockResponse({ qr: structuredClone(this.mockState.qr) });
    }

    return this.http.post<RefreshMemberQrResponse>(
      `${environment.apiBaseUrl}/members/me/qr/refresh`,
      {},
    );
  }

  shareMemberQr(): Observable<ShareQrPayload> {
    if (environment.useMocks) {
      const { profile, qr } = this.mockState;
      const payload: ShareQrPayload = {
        title: `QR de ${profile.memberName}`,
        text: `Código de socio ${profile.memberNumber}: ${qr.qrValue}`,
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/socio/mi-qr`,
      };
      return mockResponse(payload, 150);
    }

    return this.http.get<ShareQrPayload>(`${environment.apiBaseUrl}/members/me/qr/share`);
  }
}
