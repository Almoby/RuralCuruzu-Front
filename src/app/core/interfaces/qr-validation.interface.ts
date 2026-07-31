/** Request payload for merchant QR validation (FormData/JSON ready). */
export interface QrValidationRequest {
  qrToken: string;
  merchantId: string;
  /** Preferred benefit identifier (backend-ready). */
  benefitId?: string;
  /** Alias retained for existing callers. */
  promotionId?: string;
  validatedAt?: string;
}

export type QrRejectionReasonCode =
  | 'MEMBERSHIP_OVERDUE'
  | 'QR_EXPIRED'
  | 'QR_INVALID'
  | 'BENEFIT_INACTIVE'
  | 'BENEFIT_UNAVAILABLE'
  | 'QR_ALREADY_USED';

export interface ApprovedQrValidationResponse {
  valid: true;
  status: 'approved';
  memberId: string;
  memberNumber: string;
  fullName: string;
  initials: string;
  category: string;
  benefitId: string;
  benefitName: string;
  benefitValue: string;
  validatedAt: string;
  redemptionId: string;
  message?: string;
}

export interface RejectedQrValidationResponse {
  valid: false;
  status: 'rejected';
  reasonCode: QrRejectionReasonCode;
  reasonTitle: string;
  reasonDescription: string;
  memberId?: string;
  memberNumber?: string;
  fullName?: string;
  benefitId?: string;
  validatedAt: string;
  message?: string;
}

export type QrValidationResponse =
  | ApprovedQrValidationResponse
  | RejectedQrValidationResponse;

/** @deprecated Prefer Approved/Rejected union — kept for gradual migration. */
export type LegacyQrValidationReason =
  | 'expired'
  | 'invalid'
  | 'inactive'
  | 'already_used'
  | 'fee_overdue';
