import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Redemption } from '../interfaces/redemption.interface';
import {
  QrValidationRequest,
  QrValidationResponse,
} from '../interfaces/qr-validation.interface';
import { mockResponse } from '../utils/mock.util';
import redemptionsMock from '../../../assets/mock-data/redemptions.json';
import membersMock from '../../../assets/mock-data/members.json';
import { Member } from '../interfaces/member.interface';

@Injectable({ providedIn: 'root' })
export class RedemptionService {
  private readonly http = inject(HttpClient);
  private redemptions: Redemption[] = structuredClone(redemptionsMock) as Redemption[];

  history(filters?: {
    memberId?: string;
    merchantId?: string;
  }): Observable<Redemption[]> {
    if (environment.useMocks) {
      let data = this.redemptions;
      if (filters?.memberId) {
        data = data.filter((item) => item.memberId === filters.memberId);
      }
      if (filters?.merchantId) {
        data = data.filter((item) => item.merchantId === filters.merchantId);
      }
      return mockResponse(data);
    }

    return this.http.get<Redemption[]>(`${environment.apiBaseUrl}/redemptions`, {
      params: {
        ...(filters?.memberId ? { memberId: filters.memberId } : {}),
        ...(filters?.merchantId ? { merchantId: filters.merchantId } : {}),
      },
    });
  }

  validateQr(payload: QrValidationRequest): Observable<QrValidationResponse> {
    if (environment.useMocks) {
      const members = membersMock as Member[];
      const member = members.find((item) => item.qrToken === payload.qrToken);

      if (!member) {
        return mockResponse<QrValidationResponse>({
          valid: false,
          reason: 'invalid',
          message: 'Código QR inválido',
        });
      }

      if (payload.qrToken.includes('EXPIRED') || !member.isActive) {
        return mockResponse<QrValidationResponse>({
          valid: false,
          reason: 'expired',
          message: 'El QR del socio está vencido o inactivo',
          memberCode: member.memberCode,
          memberName: member.fullName,
        });
      }

      if (member.feeStatus === 'Vencida' || member.feeStatus === 'Mora') {
        return mockResponse<QrValidationResponse>({
          valid: false,
          reason: 'fee_overdue',
          message: 'El socio tiene la cuota vencida',
          memberCode: member.memberCode,
          memberName: member.fullName,
        });
      }

      const redemptionId = `red-${String(this.redemptions.length + 1).padStart(3, '0')}`;
      const validatedAt = new Date().toISOString();
      const redemption: Redemption = {
        id: redemptionId,
        memberId: member.id,
        memberCode: member.memberCode,
        memberName: member.fullName,
        merchantId: payload.merchantId,
        merchantName: 'Comercio',
        promotionId: payload.promotionId,
        benefitTitle: 'Beneficio validado',
        discountApplied: 'Aplicado',
        redeemedAt: validatedAt,
        status: 'Exitosa',
      };
      this.redemptions = [redemption, ...this.redemptions];

      return mockResponse<QrValidationResponse>({
        valid: true,
        message: 'QR válido. Beneficio aplicado correctamente.',
        memberCode: member.memberCode,
        memberName: member.fullName,
        benefitTitle: redemption.benefitTitle,
        validatedAt,
        redemptionId,
      });
    }

    return this.http.post<QrValidationResponse>(
      `${environment.apiBaseUrl}/redemptions/validate-qr`,
      payload,
    );
  }
}
