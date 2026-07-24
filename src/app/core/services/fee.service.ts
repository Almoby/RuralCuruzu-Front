import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FeePeriod,
  FeePeriodOption,
  GenerateFeesRequest,
  PaymentFilter,
  PaymentRecord,
  PaymentSummary,
  RegisterPaymentRequest,
} from '../interfaces/fee.interface';
import { PaymentMethod, PaymentStatus } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import { formatPeriodLabel } from '../../shared/utils';
import feesMock from '../../../assets/mock-data/fees.json';
import membersMock from '../../../assets/mock-data/members.json';
import { Member } from '../interfaces/member.interface';

@Injectable({ providedIn: 'root' })
export class FeeService {
  private readonly http = inject(HttpClient);
  private payments: PaymentRecord[] = structuredClone(feesMock) as PaymentRecord[];

  getPayments(memberId?: string): Observable<PaymentRecord[]> {
    return this.list(memberId);
  }

  list(memberId?: string): Observable<PaymentRecord[]> {
    if (environment.useMocks) {
      const data = memberId
        ? this.payments.filter((payment) => payment.memberId === memberId)
        : [...this.payments];
      return mockResponse(data);
    }

    const url = memberId
      ? `${environment.apiBaseUrl}/fees?memberId=${memberId}`
      : `${environment.apiBaseUrl}/fees`;
    return this.http.get<PaymentRecord[]>(url);
  }

  getPaymentSummary(): Observable<PaymentSummary> {
    return this.summary();
  }

  summary(_period?: string): Observable<PaymentSummary> {
    if (environment.useMocks) {
      return mockResponse(this.buildSummary(this.payments));
    }
    return this.http.get<PaymentSummary>(`${environment.apiBaseUrl}/fees/summary`);
  }

  filterPayments(filter: PaymentFilter): Observable<PaymentRecord[]> {
    return this.getPayments().pipe(
      map((items) => items.filter((item) => this.matchesFilter(item, filter))),
    );
  }

  getMembersForPayment(): Observable<Member[]> {
    if (environment.useMocks) {
      const members = (structuredClone(membersMock) as Member[]).filter(
        (member) => member.isActive,
      );
      return mockResponse(members);
    }
    return this.http.get<Member[]>(`${environment.apiBaseUrl}/fees/members`);
  }

  getPeriodOptions(count = 8): Observable<FeePeriodOption[]> {
    if (environment.useMocks) {
      return mockResponse(this.buildPeriodOptions(count));
    }
    return this.http.get<FeePeriodOption[]>(`${environment.apiBaseUrl}/fees/periods`);
  }

  registerPayment(payload: RegisterPaymentRequest): Observable<PaymentRecord> {
    if (environment.useMocks) {
      const members = membersMock as Member[];
      const member = members.find((item) => item.id === payload.memberId);

      /**
       * Mock decision: all registered payments are marked Aprobado automatically
       * (matches Figma subtitle). Efectivo additionally skips any review UX.
       */
      const payment: PaymentRecord = {
        id: `fee-${String(this.payments.length + 1).padStart(3, '0')}`,
        memberId: payload.memberId,
        memberCode: member?.memberCode ?? 'S-0000',
        memberName: member?.fullName ?? 'Socio',
        period: payload.period,
        amount: payload.amount,
        status: PaymentStatus.Aprobado,
        dueDate: `${payload.period}-09`,
        paidAt: payload.paidAt ?? new Date().toISOString(),
        paymentMethod: payload.paymentMethod,
        receiptNumber: payload.receiptNumber ?? `REC-${Date.now()}`,
        notes: payload.notes,
      };
      this.payments = [payment, ...this.payments];
      return mockResponse(payment);
    }
    return this.http.post<PaymentRecord>(`${environment.apiBaseUrl}/fees/payments`, payload);
  }

  generateFees(periodOrRequest: string | GenerateFeesRequest): Observable<PaymentRecord[]> {
    const period =
      typeof periodOrRequest === 'string' ? periodOrRequest : periodOrRequest.period;

    if (environment.useMocks) {
      const members = membersMock as Member[];
      const existingMemberIds = new Set(
        this.payments
          .filter((payment) => payment.period === period)
          .map((payment) => payment.memberId),
      );
      const generated = members
        .filter((member) => member.isActive && !existingMemberIds.has(member.id))
        .map((member, index) => {
          const payment: PaymentRecord = {
            id: `fee-gen-${period}-${index + 1}`,
            memberId: member.id,
            memberCode: member.memberCode,
            memberName: member.fullName,
            period,
            amount: member.monthlyFee,
            status: PaymentStatus.Pendiente,
            dueDate: `${period}-09`,
          };
          return payment;
        });
      this.payments = [...generated, ...this.payments];
      return mockResponse(generated);
    }
    return this.http.post<PaymentRecord[]>(`${environment.apiBaseUrl}/fees/generate`, {
      period,
    });
  }

  private buildSummary(items: PaymentRecord[]): PaymentSummary {
    const approved = items.filter((item) => item.status === PaymentStatus.Aprobado);
    const pending = items.filter((item) => item.status === PaymentStatus.Pendiente);
    const rejected = items.filter((item) => item.status === PaymentStatus.Rechazado);

    return {
      collectedAmount: approved.reduce((acc, item) => acc + item.amount, 0),
      inReviewAmount: pending.reduce((acc, item) => acc + item.amount, 0),
      cashCollectedAmount: approved
        .filter((item) => item.paymentMethod === PaymentMethod.Efectivo)
        .reduce((acc, item) => acc + item.amount, 0),
      totalCount: items.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
    };
  }

  private matchesFilter(item: PaymentRecord, filter: PaymentFilter): boolean {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'pending') {
      return item.status === PaymentStatus.Pendiente;
    }
    if (filter === 'approved') {
      return item.status === PaymentStatus.Aprobado;
    }
    return item.status === PaymentStatus.Rechazado;
  }

  private buildPeriodOptions(count: number): FeePeriodOption[] {
    const options: FeePeriodOption[] = [];
    const now = new Date();
    for (let i = 0; i < count; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value: FeePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value, label: formatPeriodLabel(value) });
    }
    return options;
  }
}
