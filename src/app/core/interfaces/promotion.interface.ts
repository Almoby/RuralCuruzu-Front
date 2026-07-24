import { PromotionStatus } from '../../shared/enums';

export interface Promotion {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  description: string;
  discountLabel: string;
  discountPercent?: number;
  status: PromotionStatus;
  validFrom: string;
  validTo: string;
  redemptionsCount: number;
  imageUrl?: string;
  terms?: string;
  createdAt: string;
}

export interface CreatePromotionRequest {
  merchantId: string;
  title: string;
  description: string;
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
  discountLabel?: string;
  discountPercent?: number;
  status?: PromotionStatus;
  validFrom?: string;
  validTo?: string;
  imageUrl?: string;
  terms?: string;
}
