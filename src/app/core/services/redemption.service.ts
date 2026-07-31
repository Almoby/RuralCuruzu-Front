import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Redemption } from '../interfaces/redemption.interface';
import {
  ApprovedQrValidationResponse,
  QrRejectionReasonCode,
  QrValidationRequest,
  QrValidationResponse,
  RejectedQrValidationResponse,
} from '../interfaces/qr-validation.interface';
import { mockResponse } from '../utils/mock.util';
import redemptionsMock from '../../../assets/mock-data/redemptions.json';
import membersMock from '../../../assets/mock-data/members.json';
import promotionsMock from '../../../assets/mock-data/promotions.json';
import { Member } from '../interfaces/member.interface';
import { Promotion } from '../interfaces/promotion.interface';
import { FeeStatus } from '../../shared/enums';

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
      return mockResponse(this.mockValidateQr(payload));
    }

    return this.http.post<QrValidationResponse>(
      `${environment.apiBaseUrl}/redemptions/validate-qr`,
      payload,
    );
  }

  private mockValidateQr(payload: QrValidationRequest): QrValidationResponse {
    const members = membersMock as Member[];
    const promotions = promotionsMock as Promotion[];
    const benefitId = payload.benefitId ?? payload.promotionId ?? '';
    const promotion = promotions.find((item) => item.id === benefitId);
    const validatedAt = payload.validatedAt ?? new Date().toISOString();
    const member = members.find((item) => item.qrToken === payload.qrToken);

    if (!member) {
      return this.reject({
        reasonCode: 'QR_INVALID',
        reasonTitle: 'QR rechazado',
        reasonDescription: 'Código QR inválido',
        benefitId: benefitId || undefined,
        validatedAt,
      });
    }

    if (payload.qrToken.includes('EXPIRED') || !member.isActive) {
      return this.reject({
        reasonCode: 'QR_EXPIRED',
        reasonTitle: 'QR rechazado',
        reasonDescription: 'El QR del socio está vencido o inactivo',
        memberId: member.id,
        memberNumber: member.memberCode,
        fullName: member.fullName,
        benefitId: benefitId || undefined,
        validatedAt,
      });
    }

    if (member.feeStatus === FeeStatus.Vencida || member.feeStatus === FeeStatus.Mora) {
      return this.reject({
        reasonCode: 'MEMBERSHIP_OVERDUE',
        reasonTitle: 'QR rechazado',
        reasonDescription: 'Cuota vencida — el socio no puede acceder a beneficios',
        memberId: member.id,
        memberNumber: member.memberCode,
        fullName: member.fullName,
        benefitId: benefitId || undefined,
        validatedAt,
      });
    }

    const benefitName = promotion?.title ?? 'Beneficio validado';
    const benefitValue = promotion?.discountLabel ?? '—';
    const redemptionId = `red-${String(this.redemptions.length + 1).padStart(3, '0')}`;

    const redemption: Redemption = {
      id: redemptionId,
      memberId: member.id,
      memberCode: member.memberCode,
      memberName: member.fullName,
      merchantId: payload.merchantId,
      merchantName: 'Comercio',
      promotionId: benefitId || undefined,
      benefitTitle: benefitName,
      discountApplied: benefitValue,
      redeemedAt: validatedAt,
      status: 'Exitosa',
    };
    this.redemptions = [redemption, ...this.redemptions];

    const approved: ApprovedQrValidationResponse = {
      valid: true,
      status: 'approved',
      memberId: member.id,
      memberNumber: member.memberCode,
      fullName: member.fullName,
      initials: this.buildInitials(member.firstName, member.lastName, member.fullName),
      category: `Socio ${member.category}`,
      benefitId: benefitId || promotion?.id || '',
      benefitName,
      benefitValue,
      validatedAt,
      redemptionId,
      message: '¡Beneficio aprobado!',
    };

    return approved;
  }

  private reject(
    payload: Omit<RejectedQrValidationResponse, 'valid' | 'status' | 'message'> & {
      reasonCode: QrRejectionReasonCode;
    },
  ): RejectedQrValidationResponse {
    return {
      valid: false,
      status: 'rejected',
      message: payload.reasonDescription,
      ...payload,
    };
  }

  private buildInitials(firstName: string, lastName: string, fullName: string): string {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    if (first && last) {
      return `${first}${last}`.toLocaleUpperCase('es-AR');
    }
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toLocaleUpperCase('es-AR');
    }
    return (fullName.trim().charAt(0) || '?').toLocaleUpperCase('es-AR');
  }
}
