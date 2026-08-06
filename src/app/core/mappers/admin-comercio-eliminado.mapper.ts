import {
  AdminDeletedMerchantViewModel,
  ComercioEliminadoResponseDto,
  ComercioEstado,
} from '../interfaces/admin-comercio.interface';
import { comercioEstadoLabel, formatComercioDate } from './admin-comercio.mapper';

const NOT_PROVIDED = 'No informado';

function display(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : NOT_PROVIDED;
}

function optional(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed;
}

function resolveEstadoAlEliminar(
  value: ComercioEstado | undefined,
): ComercioEstado | null {
  if (
    value === 'ACTIVO' ||
    value === 'INACTIVO' ||
    value === 'SUSPENDIDO' ||
    value === 'DADO_DE_BAJA'
  ) {
    return value;
  }
  return null;
}

/**
 * Maps Swagger `ComercioEliminadoResponse` → UI view-model.
 * Does not reuse active-merchant mappers (different contract / no contacto).
 */
export function mapComercioEliminadoDtoToViewModel(
  dto: ComercioEliminadoResponseDto,
): AdminDeletedMerchantViewModel {
  const deletedAt = optional(dto.fechaBaja);
  const statusAtDeletion = resolveEstadoAlEliminar(dto.estadoAlEliminar);

  const id =
    optional(dto.id) ||
    optional(dto.comercioIdOriginal) ||
    [optional(dto.cuit), optional(dto.fechaBaja), optional(dto.nombreComercial)]
      .filter(Boolean)
      .join('|') ||
    'sin-id';

  return {
    id,
    tradeName: display(dto.nombreComercial),
    legalName: display(dto.razonSocial),
    cuit: display(dto.cuit),
    category: display(dto.rubro),
    statusAtDeletion,
    statusAtDeletionLabel: statusAtDeletion
      ? comercioEstadoLabel(statusAtDeletion)
      : NOT_PROVIDED,
    reason: display(dto.motivo),
    deletedByAdminName: display(dto.adminResponsableBajaNombre),
    deletedAt,
    deletedAtLabel: formatComercioDate(deletedAt || undefined),
    statusLabel: 'Eliminado',
    statusBadge: 'neutral',
  };
}

export function sortDeletedMerchants(
  items: readonly AdminDeletedMerchantViewModel[],
): AdminDeletedMerchantViewModel[] {
  return [...items].sort((a, b) => {
    const dateA = a.deletedAt;
    const dateB = b.deletedAt;
    if (dateA && dateB && dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    if (dateA && !dateB) {
      return -1;
    }
    if (!dateA && dateB) {
      return 1;
    }
    return a.tradeName.localeCompare(b.tradeName, 'es');
  });
}
