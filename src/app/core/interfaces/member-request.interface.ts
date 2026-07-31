import { MemberCategory, RequestStatus } from '../../shared/enums';

/** Person type aligned with backend `tipoPersona`. */
export type PersonType = 'FISICA' | 'JURIDICA';

/** Filter keys for the Admin solicitudes list tabs. */
export type MembershipRequestFilter =
  | 'all'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type MembershipRequestStatus = RequestStatus;
export type MembershipType = MemberCategory;

/** Attachment referenced from historial `archivosAdjuntos`. */
export interface MembershipRequestAttachment {
  path: string;
  fileName: string;
}

/** Historial / observación entry for the detail UI. */
export interface MembershipRequestHistorialItem {
  id: string;
  previousStatus?: RequestStatus;
  newStatus?: RequestStatus;
  dateTime: string;
  adminName: string;
  observation?: string;
  reason?: string;
  attachments: MembershipRequestAttachment[];
}

/**
 * View-model used by Admin Solicitudes UI.
 * `id` is the backend `numeroSolicitud`.
 */
export interface MembershipRequest {
  id: string;
  fullName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberCategory;
  address?: string;
  portalFloor?: string;
  birthDate?: string;
  personType?: PersonType;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  responsableName?: string;
  responsableDocument?: string;
  status: RequestStatus;
  submittedAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  cancelReason?: string;
  notes?: string;
  historial?: MembershipRequestHistorialItem[];
}

export type MembershipRequestDetail = MembershipRequest;

export interface MembershipRequestSummary {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

/** Legacy mock create payload (unused by Admin real API). */
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

/** @deprecated Prefer CambiarEstadoSolicitudRequest via MembershipRequestService.changeEstado */
export interface ReviewMembershipRequest {
  status: RequestStatus.Aprobada | RequestStatus.Rechazada;
  rejectionReason?: string;
  reviewedBy: string;
  notes?: string;
}

/** @deprecated Prefer CambiarEstadoSolicitudRequest */
export interface UpdateMembershipRequestPayload {
  status: RequestStatus.Aprobada | RequestStatus.Rechazada;
  reviewedBy: string;
  rejectionReason?: string;
  notes?: string;
}
