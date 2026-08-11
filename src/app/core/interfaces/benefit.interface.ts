export type BenefitOfferType = 'descuento' | 'promocion' | 'fijo';

export type BenefitsCatalogView = 'promotions' | 'merchants';

export interface BenefitCategory {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface BenefitCategoryFilter {
  id: string;
  label: string;
  /** Category name to match, or `all`. */
  value: string;
}

export interface BenefitsViewModeOption {
  id: BenefitsCatalogView;
  label: string;
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
  /** Compact badge shown on cards, e.g. `15%`, `2×1`, `Gratis`. */
  badgeLabel: string;
  offerType: BenefitOfferType;
  offerTypeLabel: string;
  offerTypeIcon: string;
  validToLabel: string;
  imageUrl?: string;
  address?: string;
  isActive: boolean;
  validFrom: string;
  validTo?: string;
  terms?: string;
  /** From BeneficioResumenResponse.limiteUsosPorSocio (0 = unlimited). */
  limiteUsosPorSocio: number | null;
  usosDelSocio: number | null;
  /** null = unlimited (backend). */
  usosRestantes: number | null;
  /** Discrete card line from backend usage fields. */
  usageAvailabilityLabel: string;
  /** False when backend reports 0 remaining (still listed if returned). */
  hasUsesAvailable: boolean;
}

export interface BenefitMerchantCard {
  id: string;
  name: string;
  categoryName: string;
  address: string;
  phone: string;
  benefitsCount: number;
  benefitsCountLabel: string;
  badges: string[];
}

export interface SocioBenefitsCatalogResponse {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  categories: BenefitCategoryFilter[];
  viewModes: BenefitsViewModeOption[];
  promotions: Benefit[];
  merchants: BenefitMerchantCard[];
}
