import { MerchantCategory } from '../enums';

export type MerchantCategoryTone =
  | 'farmacia'
  | 'gastronomia'
  | 'libreria'
  | 'fitness'
  | 'cafeteria'
  | 'optica'
  | 'otro';

export interface MerchantCategoryIconConfig {
  icon: string;
  tone: MerchantCategoryTone;
  /** CSS color tokens resolved via SCSS tone classes (no inline styles). */
  backgroundColor: string;
  iconColor: string;
}

export const MERCHANT_CATEGORY_ICON_CONFIG: Record<
  MerchantCategory,
  MerchantCategoryIconConfig
> = {
  [MerchantCategory.Farmacia]: {
    icon: 'pharmacy',
    tone: 'farmacia',
    backgroundColor: '#e8f5ef',
    iconColor: '#0f766e',
  },
  [MerchantCategory.Gastronomia]: {
    icon: 'utensils',
    tone: 'gastronomia',
    backgroundColor: '#fff4e8',
    iconColor: '#c2410c',
  },
  [MerchantCategory.Libreria]: {
    icon: 'book',
    tone: 'libreria',
    backgroundColor: '#eef2ff',
    iconColor: '#4338ca',
  },
  [MerchantCategory.SaludFitness]: {
    icon: 'fitness',
    tone: 'fitness',
    backgroundColor: '#f0fdf4',
    iconColor: '#15803d',
  },
  [MerchantCategory.Cafeteria]: {
    icon: 'coffee',
    tone: 'cafeteria',
    backgroundColor: '#faf5f0',
    iconColor: '#92400e',
  },
  [MerchantCategory.Optica]: {
    icon: 'glasses',
    tone: 'optica',
    backgroundColor: '#ecfeff',
    iconColor: '#0e7490',
  },
  [MerchantCategory.Otro]: {
    icon: 'storefront',
    tone: 'otro',
    backgroundColor: '#f3f4f6',
    iconColor: '#4b5563',
  },
};

export function resolveMerchantCategoryIcon(
  category: string,
): MerchantCategoryIconConfig {
  const known = Object.values(MerchantCategory).find((item) => item === category);
  if (known) {
    return MERCHANT_CATEGORY_ICON_CONFIG[known];
  }
  return MERCHANT_CATEGORY_ICON_CONFIG[MerchantCategory.Otro];
}
