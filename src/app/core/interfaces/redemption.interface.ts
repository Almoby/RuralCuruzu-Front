export interface Redemption {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  merchantId: string;
  merchantName: string;
  promotionId?: string;
  benefitId?: string;
  benefitTitle: string;
  discountApplied: string;
  redeemedAt: string;
  status: 'Exitosa' | 'Rechazada' | 'Expirada';
  notes?: string;
}

/** Alias used in UI copy for benefit usage history. */
export type BenefitUsage = Redemption;
