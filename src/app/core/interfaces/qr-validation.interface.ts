export interface QrValidationRequest {
  qrToken: string;
  merchantId: string;
  promotionId?: string;
}

export interface QrValidationResponse {
  valid: boolean;
  reason?: 'expired' | 'invalid' | 'inactive' | 'already_used' | 'fee_overdue';
  message: string;
  memberCode?: string;
  memberName?: string;
  benefitTitle?: string;
  validatedAt?: string;
  redemptionId?: string;
}
