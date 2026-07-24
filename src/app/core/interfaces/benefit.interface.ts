export interface BenefitCategory {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface Benefit {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  discountLabel: string;
  discountPercent?: number;
  imageUrl?: string;
  address?: string;
  isActive: boolean;
  validFrom: string;
  validTo?: string;
  terms?: string;
}
