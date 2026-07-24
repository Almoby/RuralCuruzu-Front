import { MerchantCategory, MerchantStatus } from '../../shared/enums';

export interface Merchant {
  id: string;
  name: string;
  tradeName: string;
  email: string;
  phone: string;
  address: string;
  category: MerchantCategory;
  status: MerchantStatus;
  cuit: string;
  contactPerson: string;
  logoUrl?: string;
  joinedAt: string;
  activePromotionsCount: number;
  consumptions: number;
}

export type MerchantDetail = Merchant;

export interface CreateMerchantRequest {
  name: string;
  tradeName: string;
  email: string;
  phone: string;
  address: string;
  category: MerchantCategory;
  cuit: string;
  contactPerson?: string;
  logoUrl?: string;
}

export interface UpdateMerchantRequest {
  name?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: MerchantCategory;
  status?: MerchantStatus;
  cuit?: string;
  contactPerson?: string;
  logoUrl?: string;
  consumptions?: number;
  activePromotionsCount?: number;
}

export interface MerchantListResponse {
  items: Merchant[];
  total: number;
  activeCount: number;
}

export interface MerchantSummary {
  total: number;
  activeCount: number;
  inactiveCount: number;
}

export interface MerchantCategoryOption {
  value: MerchantCategory;
  label: string;
}
