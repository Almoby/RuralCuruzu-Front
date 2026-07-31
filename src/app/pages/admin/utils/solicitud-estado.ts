import { BadgeVariant } from '../../../shared/components';
import { RequestStatus } from '../../../shared/enums';

/** Admin actions allowed by Swagger transition rules. */
export type SolicitudAdminAction =
  | 'pass_to_review'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'reopen'
  | 'observe';

export function requestStatusLabel(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.Pendiente:
      return 'Pendiente';
    case RequestStatus.EnRevision:
      return 'En revisión';
    case RequestStatus.Aprobada:
      return 'Aprobada';
    case RequestStatus.Rechazada:
      return 'Rechazada';
    case RequestStatus.Cancelada:
      return 'Cancelada';
    default:
      return status;
  }
}

export function requestStatusBadge(status: RequestStatus): BadgeVariant {
  switch (status) {
    case RequestStatus.Pendiente:
      return 'warning';
    case RequestStatus.EnRevision:
      return 'primary';
    case RequestStatus.Aprobada:
      return 'success';
    case RequestStatus.Rechazada:
      return 'danger';
    case RequestStatus.Cancelada:
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function requestStatusIcon(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.Pendiente:
      return 'clock';
    case RequestStatus.EnRevision:
      return 'eye';
    case RequestStatus.Aprobada:
      return 'check_circle';
    case RequestStatus.Rechazada:
      return 'x_circle';
    case RequestStatus.Cancelada:
      return 'x_circle';
    default:
      return 'clock';
  }
}

/**
 * Allowed admin actions for the current estado.
 * Matches Swagger: PENDIENTE→EN_REVISION; EN_REVISION→APROBADA/RECHAZADA/CANCELADA;
 * RECHAZADA→EN_REVISION; APROBADA/CANCELADA finales.
 * Observaciones do not change estado and are allowed while the request is actionable.
 */
export function availableSolicitudActions(status: RequestStatus): SolicitudAdminAction[] {
  switch (status) {
    case RequestStatus.Pendiente:
      return ['pass_to_review', 'observe'];
    case RequestStatus.EnRevision:
      return ['approve', 'reject', 'cancel', 'observe'];
    case RequestStatus.Rechazada:
      return ['reopen', 'observe'];
    case RequestStatus.Aprobada:
    case RequestStatus.Cancelada:
      return [];
    default:
      return [];
  }
}

export function canReviewSolicitud(status: RequestStatus): boolean {
  return availableSolicitudActions(status).length > 0;
}

export function requiresMotivo(action: SolicitudAdminAction): boolean {
  return action === 'reject' || action === 'cancel';
}
