import { PaymentMethod, PaymentStatus } from '../../shared/enums';

export type FeePeriod = string;

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  period: FeePeriod;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  notes?: string;
}

/** Alias retained for existing socio/admin imports. */
export type FeePayment = PaymentRecord;

export interface RegisterPaymentRequest {
  memberId: string;
  period: FeePeriod;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt?: string;
  receiptNumber?: string;
  notes?: string;
}

/** Alias retained for existing imports. */
export type RegisterFeePaymentRequest = RegisterPaymentRequest;

export interface GenerateFeesRequest {
  period: FeePeriod;
}

export interface PaymentSummary {
  collectedAmount: number;
  inReviewAmount: number;
  cashCollectedAmount: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

/** Alias retained for existing imports. */
export type FeeSummary = PaymentSummary;

export interface PaymentListResponse {
  items: PaymentRecord[];
  total: number;
}

export interface FeePeriodOption {
  value: FeePeriod;
  label: string;
}

export type PaymentFilter = 'all' | 'pending' | 'approved' | 'rejected';
