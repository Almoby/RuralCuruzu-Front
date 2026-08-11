import {
  CuotaEstado,
  CuotaResumenResponseDto,
  PagoResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  AvailableBenefitPreview,
  MemberDashboardResponse,
  MemberFinancialSummary,
  MemberProfileSummary,
  MembershipFeeStatus,
  MembershipStatusBanner,
  NamedValue,
  QuickAccessItem,
  UsedBenefitPreview,
} from '../interfaces/dashboard.interface';
import {
  SocioBeneficioResumenDto,
  SocioHistorialBeneficioDto,
  SocioPanelRawBundle,
} from '../interfaces/socio-panel.interface';
import { APP_ROUTES } from '../constants/routes.constant';
import { asDisplayableBusinessCode } from '../utils/display-identity.util';
import {
  formatSocioBenefitUsageLabel,
  isSocioBenefitUsageExhausted,
} from './socio-benefit.mapper';

const PREVIEW_LIMIT = 3;
const UNPAID_STATES: ReadonlySet<CuotaEstado> = new Set([
  'PENDIENTE',
  'INFORMADA',
  'EN_REVISION',
  'VENCIDA',
  'RECHAZADA',
]);

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstNameFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? '';
}

/** Formats LocalDate `YYYY-MM-DD` as `d/m/yyyy` without UTC shift. */
function formatLocalDateLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    return formatLocalDateLabel(value);
  }
  return value.trim();
}

function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function pickIdentity(bundle: SocioPanelRawBundle): {
  fullName: string;
  memberCode: string;
} {
  const fromCuota = bundle.cuotas.find(
    (item) => item.socioNombre?.trim() || item.socioNumeroSocio?.trim(),
  );
  const fromPago = bundle.pagos.find(
    (item) => item.socioNombre?.trim() || item.socioNumeroSocio?.trim(),
  );

  // Prefer session `nombre` (full), then endpoint identity fields — never split.
  const fullName =
    bundle.session.displayName.trim() ||
    fromCuota?.socioNombre?.trim() ||
    fromPago?.socioNombre?.trim() ||
    '';

  const memberCode =
    asDisplayableBusinessCode(bundle.session.numeroSocio) ||
    asDisplayableBusinessCode(fromCuota?.socioNumeroSocio) ||
    asDisplayableBusinessCode(fromPago?.socioNumeroSocio) ||
    '';

  return { fullName, memberCode };
}

function planLabelFromSession(
  categoria: SocioPanelRawBundle['session']['memberCategory'],
): string {
  switch (categoria) {
    case 'ACTIVO':
      return 'Activo';
    case 'ADHERENTE':
      return 'Adherente';
    default:
      return '';
  }
}

function buildProfile(bundle: SocioPanelRawBundle): MemberProfileSummary {
  const { fullName, memberCode } = pickIdentity(bundle);
  return {
    memberCode: memberCode || '—',
    fullName: fullName || 'Socio',
    firstName: firstNameFrom(fullName || 'Socio'),
    planLabel: planLabelFromSession(bundle.session.memberCategory),
  };
}

function resolveFeeStatus(cuotas: CuotaResumenResponseDto[]): MembershipFeeStatus {
  if (cuotas.some((cuota) => cuota.estado === 'VENCIDA')) {
    return 'overdue';
  }
  if (cuotas.some((cuota) => cuota.estado != null && UNPAID_STATES.has(cuota.estado))) {
    return 'pending';
  }
  return 'current';
}

function buildMembershipBanner(
  status: MembershipFeeStatus,
): MembershipStatusBanner {
  switch (status) {
    case 'overdue':
      return {
        status,
        title: 'Cuota vencida',
        message: 'Tenés cuotas vencidas. Regularizá tu situación para seguir usando beneficios.',
        icon: 'alert_circle',
      };
    case 'pending':
      return {
        status,
        title: 'Cuota pendiente',
        message: 'Hay cuotas pendientes de pago o en revisión.',
        icon: 'schedule',
      };
    default:
      return {
        status: 'current',
        title: 'Cuota al día',
        message: 'Tu membresía está activa y podés disfrutar de todos los beneficios.',
        icon: 'check_circle',
      };
  }
}

function buildQuickAccess(): QuickAccessItem[] {
  return [
    {
      id: 'qa-qr',
      label: 'Mi QR',
      icon: 'qr_code',
      route: APP_ROUTES.socio.qr,
    },
    {
      id: 'qa-benefits',
      label: 'Beneficios',
      icon: 'loyalty',
      route: APP_ROUTES.socio.benefits,
    },
    {
      id: 'qa-payments',
      label: 'Mis pagos',
      icon: 'account_balance_wallet',
      route: APP_ROUTES.socio.payments,
    },
    {
      id: 'qa-history',
      label: 'Historial',
      icon: 'history',
      route: APP_ROUTES.socio.history,
    },
  ];
}

function pickCurrentCuota(
  cuotas: CuotaResumenResponseDto[],
): CuotaResumenResponseDto | null {
  if (cuotas.length === 0) {
    return null;
  }

  const period = currentPeriod();
  const forCurrentPeriod = cuotas.find(
    (cuota) => typeof cuota.periodo === 'string' && cuota.periodo.slice(0, 7) === period,
  );
  if (forCurrentPeriod) {
    return forCurrentPeriod;
  }

  const unpaid = cuotas
    .filter((cuota) => cuota.estado != null && UNPAID_STATES.has(cuota.estado))
    .sort((a, b) => (b.periodo ?? '').localeCompare(a.periodo ?? ''));
  if (unpaid[0]) {
    return unpaid[0];
  }

  return [...cuotas].sort((a, b) => (b.periodo ?? '').localeCompare(a.periodo ?? ''))[0] ?? null;
}

function pickLastApprovedPayment(pagos: PagoResponseDto[]): PagoResponseDto | null {
  return pagos.find((pago) => pago.estado === 'APROBADO') ?? null;
}

function sumPendingDebt(cuotas: CuotaResumenResponseDto[]): number {
  return cuotas
    .filter((cuota) => cuota.estado != null && UNPAID_STATES.has(cuota.estado))
    .reduce((total, cuota) => total + num(cuota.importe), 0);
}

function buildFinancial(
  cuotas: CuotaResumenResponseDto[],
  pagos: PagoResponseDto[],
  historial: SocioHistorialBeneficioDto[],
): MemberFinancialSummary {
  const currentCuota = pickCurrentCuota(cuotas);
  const used = historial.filter((item) => item.estado === 'USADO');
  const savingsTotal = used.reduce((total, item) => total + num(item.montoAhorro), 0);
  const benefitsUsedCount = used.length;
  const lastPayment = pickLastApprovedPayment(pagos);

  const dueLabel = formatLocalDateLabel(currentCuota?.fechaVencimiento);
  const lastPaymentDate = formatDateTimeLabel(lastPayment?.fechaPago);

  return {
    monthlyFee: num(currentCuota?.importe),
    monthlyFeeHint: dueLabel ? `Vence el ${dueLabel}` : 'Sin vencimiento informado',
    savingsTotal,
    benefitsUsedCount,
    benefitsUsedHint:
      benefitsUsedCount === 1
        ? '1 beneficio usado'
        : `${benefitsUsedCount} beneficios usados`,
    lastPaymentAmount: num(lastPayment?.importe),
    lastPaymentHint: lastPaymentDate || 'Sin pagos aprobados',
  };
}

function mapAvailableBenefits(
  beneficios: SocioBeneficioResumenDto[],
): AvailableBenefitPreview[] {
  return beneficios.slice(0, PREVIEW_LIMIT).map((item, index) => {
    const usageDto = {
      limiteUsosPorSocio: item.limiteUsosPorSocio,
      usosRestantes: item.usosRestantes,
    };
    return {
      id: item.id?.trim() || `beneficio-${index}`,
      title: item.titulo?.trim() || 'Beneficio',
      merchantName: item.comercioNombre?.trim() || 'No informado',
      categoryName: item.comercioRubro?.trim() || 'General',
      discountBadge: item.valor?.trim() || '—',
      usageAvailabilityLabel: formatSocioBenefitUsageLabel(usageDto),
      hasUsesAvailable: !isSocioBenefitUsageExhausted(usageDto),
    };
  });
}

function mapRecentUsage(
  historial: SocioHistorialBeneficioDto[],
): UsedBenefitPreview[] {
  return historial
    .filter((item) => item.estado === 'USADO')
    .slice(0, PREVIEW_LIMIT)
    .map((item, index) => ({
      id: item.id?.trim() || `uso-${index}`,
      title: item.beneficioTitulo?.trim() || 'Beneficio',
      merchantName: item.comercioNombre?.trim() || 'No informado',
      dateLabel: formatDateTimeLabel(item.fechaUso) || 'Sin fecha',
      savingsAmount: num(item.montoAhorro),
    }));
}

function redemptionsThisMonth(historial: SocioHistorialBeneficioDto[]): number {
  const period = currentPeriod();
  return historial.filter((item) => {
    if (item.estado !== 'USADO' || !item.fechaUso) {
      return false;
    }
    return item.fechaUso.slice(0, 7) === period;
  }).length;
}

function recentBenefitsNamed(historial: SocioHistorialBeneficioDto[]): NamedValue[] {
  const counts = new Map<string, number>();
  for (const item of historial.filter((entry) => entry.estado === 'USADO')) {
    const name = item.comercioNombre?.trim() || 'Comercio';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, PREVIEW_LIMIT);
}

function feeStatusLabel(status: MembershipFeeStatus): string {
  switch (status) {
    case 'overdue':
      return 'Vencida';
    case 'pending':
      return 'Pendiente';
    default:
      return 'Al día';
  }
}

/**
 * Maps Socio panel raw API responses + session into the Mi panel ViewModel.
 */
export function mapSocioPanelBundleToViewModel(
  bundle: SocioPanelRawBundle,
): MemberDashboardResponse {
  const profile = buildProfile(bundle);
  const feeStatus = resolveFeeStatus(bundle.cuotas);
  const membershipStatus = buildMembershipBanner(feeStatus);
  const financial = buildFinancial(bundle.cuotas, bundle.pagos, bundle.historial);
  const availableBenefits = mapAvailableBenefits(bundle.beneficios);
  const recentUsage = mapRecentUsage(bundle.historial);
  const currentCuota = pickCurrentCuota(bundle.cuotas);

  return {
    profile,
    membershipStatus,
    quickAccess: buildQuickAccess(),
    financial,
    availableBenefits,
    recentUsage,
    memberCode: profile.memberCode,
    fullName: profile.fullName,
    feeStatusLabel: feeStatusLabel(feeStatus),
    nextDueDate: currentCuota?.fechaVencimiento,
    pendingAmount: sumPendingDebt(bundle.cuotas),
    availableBenefitsCount: bundle.beneficios.length,
    redemptionsThisMonth: redemptionsThisMonth(bundle.historial),
    recentBenefits: recentBenefitsNamed(bundle.historial),
    savingsEstimate: financial.savingsTotal,
    // No Socio endpoint exposes a monthly usage trend series.
    usageTrend: [],
  };
}
