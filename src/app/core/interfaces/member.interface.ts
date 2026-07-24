import { FeeStatus, MemberPlan } from '../../shared/enums';

export type MembershipFeeStatus = FeeStatus;
export type MemberCategoryPlan = MemberPlan;

export interface Member {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberPlan;
  feeStatus: FeeStatus;
  monthlyFee: number;
  nextDueDate: string;
  address?: string;
  birthDate?: string;
  joinDate: string;
  isActive: boolean;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  qrToken: string;
}

export interface MemberAccountStatus {
  monthlyFee: number;
  nextDueDate: string;
  pendingAmount: number;
  lastPaymentDate?: string;
}

export interface MemberDetail extends Member {
  lastPaymentDate?: string;
  pendingAmount: number;
  account: MemberAccountStatus;
  notes?: string;
}

export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberPlan;
  address: string;
  birthDate: string;
  isActive: boolean;
}

export interface UpdateMemberRequest {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  category?: MemberPlan;
  address?: string;
  birthDate?: string;
  documentNumber?: string;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  isActive?: boolean;
  feeStatus?: FeeStatus;
  monthlyFee?: number;
  nextDueDate?: string;
}

export interface MemberListResponse {
  items: Member[];
  total: number;
}
