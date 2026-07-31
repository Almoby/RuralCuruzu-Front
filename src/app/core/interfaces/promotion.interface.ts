import { PromotionStatus, PromotionType } from '../../shared/enums';

export interface Promotion {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  description: string;
  /** Visual type label under the title (Descuento, Promoción, …). */
  type: PromotionType | string;
  /** Short value shown in the pill badge (15%, 2×1, 10%). */
  discountLabel: string;
  discountPercent?: number;
  status: PromotionStatus;
  validFrom: string;
  validTo: string;
  /** Monthly redemptions shown as “N usos este mes”. */
  redemptionsCount: number;
  imageUrl?: string;
  terms?: string;
  createdAt: string;
}

export interface CreatePromotionRequest {
  merchantId: string;
  title: string;
  description: string;
  type: PromotionType | string;
  discountLabel: string;
  discountPercent?: number;
  validFrom: string;
  validTo: string;
  imageUrl?: string;
  terms?: string;
}

export interface UpdatePromotionRequest {
  title?: string;
  description?: string;
  type?: PromotionType | string;
  discountLabel?: string;
  discountPercent?: number;
  status?: PromotionStatus;
  validFrom?: string;
  validTo?: string;
  imageUrl?: string;
  terms?: string;
}
