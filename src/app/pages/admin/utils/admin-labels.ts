import { BadgeVariant } from '../../../shared/components';
import { MemberCategory } from '../../../shared/enums';

export {
  requestStatusBadge,
  requestStatusIcon,
  requestStatusLabel,
} from './solicitud-estado';

export function categoryBadge(category: MemberCategory): BadgeVariant {
  return category === MemberCategory.Activo ? 'primary' : 'brown';
}

export function membershipTypeLabel(category: MemberCategory): string {
  return category === MemberCategory.Activo ? 'Socio Activo' : 'Socio Adherente';
}

export function formatMemberDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = match[1];
    const month = Number(match[2]);
    const day = Number(match[3]);
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function initialsFromName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return '?';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}
