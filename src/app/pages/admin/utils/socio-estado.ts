import { BadgeVariant } from '../../../shared/components';
import { MemberCategory } from '../../../shared/enums';
import { SocioEstado } from '../../../core/interfaces/admin-socio.interface';
import { socioEstadoLabel } from '../../../core/mappers/admin-socio.mapper';

export { socioEstadoLabel };

export function socioEstadoBadge(estado: SocioEstado): BadgeVariant {
  switch (estado) {
    case 'ACTIVO':
      return 'success';
    case 'INACTIVO':
      return 'neutral';
    case 'DADO_DE_BAJA':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function socioCategoryBadge(category: MemberCategory): BadgeVariant {
  return category === MemberCategory.Activo ? 'primary' : 'brown';
}

export function socioCategoryLabel(category: MemberCategory): string {
  return category === MemberCategory.Activo ? 'Socio Activo' : 'Socio Adherente';
}
