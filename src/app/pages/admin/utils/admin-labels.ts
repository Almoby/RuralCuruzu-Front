import { BadgeVariant } from '../../../shared/components';
import {
  FeeStatus,
  MemberCategory,
  MemberPlan,
  MerchantStatus,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
} from '../../../shared/enums';

export function feeStatusLabel(status: FeeStatus): string {
  switch (status) {
    case FeeStatus.AlDia:
      return 'Al día';
    case FeeStatus.Pendiente:
      return 'Pendiente';
    case FeeStatus.Vencida:
      return 'Vencido';
    case FeeStatus.Mora:
      return 'Mora';
    default:
      return status;
  }
}

export function feeStatusBadge(status: FeeStatus): BadgeVariant {
  switch (status) {
    case FeeStatus.AlDia:
      return 'success';
    case FeeStatus.Pendiente:
      return 'warning';
    case FeeStatus.Vencida:
    case FeeStatus.Mora:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function requestStatusBadge(status: RequestStatus): BadgeVariant {
  switch (status) {
    case RequestStatus.Pendiente:
      return 'warning';
    case RequestStatus.Aprobada:
      return 'success';
    case RequestStatus.Rechazada:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function categoryBadge(category: MemberCategory): BadgeVariant {
  return category === MemberCategory.Activo ? 'primary' : 'brown';
}

export function membershipTypeLabel(category: MemberCategory): string {
  return category === MemberCategory.Activo ? 'Socio Activo' : 'Socio Adherente';
}

export function memberPlanBadge(plan: MemberPlan): BadgeVariant {
  switch (plan) {
    case MemberPlan.Oro:
      return 'gold';
    case MemberPlan.Plata:
      return 'neutral';
    case MemberPlan.Premium:
      return 'violet';
    default:
      return 'neutral';
  }
}

export function formatMemberFee(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
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

export function merchantStatusBadge(status: MerchantStatus): BadgeVariant {
  return status === MerchantStatus.Activo ? 'success' : 'neutral';
}

export function paymentMethodLabel(method: PaymentMethod | undefined): string {
  if (!method) {
    return '—';
  }
  return method;
}

export function paymentStatusBadge(status: PaymentStatus): BadgeVariant {
  switch (status) {
    case PaymentStatus.Aprobado:
      return 'success';
    case PaymentStatus.Pendiente:
      return 'warning';
    case PaymentStatus.Rechazado:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return status;
}

export function paymentMethodIcon(method: PaymentMethod | undefined): string {
  switch (method) {
    case PaymentMethod.Efectivo:
      return 'banknote';
    case PaymentMethod.Transferencia:
      return 'payments';
    case PaymentMethod.Debito:
      return 'credit_card';
    case PaymentMethod.LinkPago:
      return 'link';
    case PaymentMethod.BilleteraVirtual:
      return 'account_balance_wallet';
    default:
      return 'payments';
  }
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

export function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}
