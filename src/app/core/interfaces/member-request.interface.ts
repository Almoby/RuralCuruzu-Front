import { MemberCategory, RequestStatus } from '../../shared/enums';

export type PersonType = 'fisica' | 'juridica';

/** Filter keys for the requests list tabs. */
export type MembershipRequestFilter = 'all' | 'pending' | 'approved' | 'rejected';

export type MembershipRequestStatus = RequestStatus;
export type MembershipType = MemberCategory;

export interface MembershipRequest {
  id: string;
  fullName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberCategory;
  address?: string;
  birthDate?: string;
  personType?: PersonType;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  status: RequestStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export type MembershipRequestDetail = MembershipRequest;

export interface MembershipRequestSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface CreateMembershipRequest {
  fullName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberCategory;
  address?: string;
  birthDate?: string;
  personType?: PersonType;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  notes?: string;
}

export interface ReviewMembershipRequest {
  status: RequestStatus.Aprobada | RequestStatus.Rechazada;
  rejectionReason?: string;
  reviewedBy: string;
  notes?: string;
}

export interface UpdateMembershipRequestPayload {
  status: RequestStatus.Aprobada | RequestStatus.Rechazada;
  reviewedBy: string;
  rejectionReason?: string;
  notes?: string;
}
