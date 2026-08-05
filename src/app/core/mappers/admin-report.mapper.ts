import {
  CuotaEstado,
  CuotaResumenResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  BeneficioMasUtilizadoDto,
  CobranzaMensualDto,
  IndicadoresPrincipalesDto,
  UsoBeneficioPorComercioDto,
} from '../interfaces/admin-dashboard.interface';
import { AdminReportRawBundle } from '../interfaces/admin-report.interface';
import {
  BenefitUsageRanking,
  BenefitUsageRankingItem,
  CommerceBenefitUsageReport,
  MemberDebtItem,
  MemberDebtReport,
  MonthlyCollectedFeesReport,
  MonthlyPaymentsReport,
  OverdueMemberReport,
  ReportMetric,
  ReportMonthOption,
  ReportsDashboardResponse,
} from '../interfaces/report.interface';
import { CHART_COLORS } from '../../pages/admin/utils/chart-theme';
import { formatPeriodLabel } from '../../shared/utils';

/** Cuotas that still count toward outstanding debt (not paid / not void). */
const DEBT_STATES: ReadonlySet<CuotaEstado> = new Set([
  'PENDIENTE',
  'INFORMADA',
  'EN_REVISION',
  'VENCIDA',
  'RECHAZADA',
]);

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function monthLabel(item: CobranzaMensualDto): string {
  const mes = typeof item.mes === 'string' ? item.mes.trim() : '';
  if (mes.length > 0) {
    return mes.length <= 3 ? mes : mes.slice(0, 3);
  }

  const periodo = typeof item.periodo === 'string' ? item.periodo.trim() : '';
  if (/^\d{4}-\d{2}/.test(periodo)) {
    const monthIndex = Number(periodo.slice(5, 7)) - 1;
    const labels = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return labels[monthIndex] ?? periodo;
  }

  return periodo || '—';
}

function resolveYear(items: CobranzaMensualDto[], fallback: number): number {
  for (const item of items) {
    const periodo = typeof item.periodo === 'string' ? item.periodo.trim() : '';
    if (/^\d{4}/.test(periodo)) {
      const year = Number(periodo.slice(0, 4));
      if (Number.isFinite(year)) {
        return year;
      }
    }
  }
  return fallback;
}

function niceAxisMax(maxValue: number, fallback: number): number {
  if (maxValue <= 0) {
    return fallback;
  }
  const magnitude = 10 ** Math.max(0, String(Math.floor(maxValue)).length - 2);
  return Math.ceil(maxValue / magnitude) * magnitude;
}

function shortNameFromFull(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '—';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

function memberKey(cuota: CuotaResumenResponseDto): string {
  const code = cuota.socioNumeroSocio?.trim();
  if (code) {
    return code;
  }
  const name = cuota.socioNombre?.trim();
  if (name) {
    return `name:${name}`;
  }
  return cuota.id;
}

function toMemberDebtItem(
  key: string,
  name: string,
  code: string,
  amount: number,
): MemberDebtItem {
  return {
    memberId: key,
    memberName: name || 'No informado',
    shortName: shortNameFromFull(name || 'No informado'),
    memberCode: code || '—',
    amount,
  };
}

function aggregateByMember(
  cuotas: CuotaResumenResponseDto[],
): MemberDebtItem[] {
  const map = new Map<string, { name: string; code: string; amount: number }>();

  for (const cuota of cuotas) {
    const key = memberKey(cuota);
    const existing = map.get(key);
    const amount = num(cuota.importe);
    const name = cuota.socioNombre?.trim() || existing?.name || '';
    const code = cuota.socioNumeroSocio?.trim() || existing?.code || '';

    if (existing) {
      existing.amount += amount;
      if (!existing.name && name) {
        existing.name = name;
      }
      if (!existing.code && code) {
        existing.code = code;
      }
    } else {
      map.set(key, { name, code, amount });
    }
  }

  return Array.from(map.entries())
    .map(([key, value]) => toMemberDebtItem(key, value.name, value.code, value.amount))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function buildMetrics(
  indicadores: IndicadoresPrincipalesDto,
  sociosActivosCount: number | null,
  overdueDistinctCount: number,
): ReportMetric[] {
  const activeValue =
    sociosActivosCount !== null
      ? sociosActivosCount
      : num(indicadores.totalSocios);

  return [
    {
      id: 'active-members',
      label: 'Socios activos',
      value: activeValue,
      icon: 'people',
      tone: 'primary',
    },
    {
      id: 'delinquent-members',
      label: 'Socios morosos',
      value:
        typeof indicadores.sociosEnMora === 'number'
          ? num(indicadores.sociosEnMora)
          : overdueDistinctCount,
      icon: 'alert_circle',
      tone: 'warning',
    },
    {
      id: 'new-members-month',
      label: 'Nuevos este mes',
      value: num(indicadores.sociosNuevosEsteMes),
      icon: 'trending_up',
      tone: 'info',
    },
    {
      id: 'active-benefits',
      label: 'Beneficios activos',
      value: num(indicadores.promocionesActivas),
      icon: 'local_offer',
      tone: 'success',
    },
  ];
}

function buildCollectionsVsPending(
  items: CobranzaMensualDto[],
  year: number,
): MonthlyPaymentsReport {
  const labels = items.map(monthLabel);
  const collected = items.map((item) => num(item.cobrado));
  const pending = items.map((item) => num(item.pendiente));
  const maxValue = Math.max(0, ...collected, ...pending);

  return {
    title: `Cobrados vs pendientes — ${year}`,
    year,
    labels,
    series: [
      {
        name: 'Cobrado',
        color: CHART_COLORS.primary,
        values: collected,
      },
      {
        name: 'Pendiente',
        color: CHART_COLORS.brown,
        values: pending,
      },
    ],
    yAxisMax: niceAxisMax(maxValue, 1000),
  };
}

/** Deuda acumulada por socio — from unpaid cuotas in GET /admin/cuotas. */
export function mapDebtByMemberFromCuotas(
  cuotas: CuotaResumenResponseDto[],
): MemberDebtReport {
  const items = aggregateByMember(
    cuotas.filter((cuota) => cuota.estado != null && DEBT_STATES.has(cuota.estado)),
  );
  const max = Math.max(0, ...items.map((item) => item.amount));

  return {
    title: 'Deuda acumulada por socio',
    items,
    yAxisMax: niceAxisMax(max, 1000),
  };
}

/** Socios con cuota vencida — from GET /admin/cuotas?estado=VENCIDA (or filtered). */
export function mapOverdueMembersFromCuotas(
  cuotas: CuotaResumenResponseDto[],
): OverdueMemberReport {
  return {
    title: 'Socios con cuota vencida',
    items: aggregateByMember(cuotas.filter((cuota) => cuota.estado === 'VENCIDA')),
  };
}

function currentPeriodValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildMonthOptions(cuotas: CuotaResumenResponseDto[]): ReportMonthOption[] {
  const periods = new Set<string>();

  for (const cuota of cuotas) {
    if (cuota.estado === 'PAGADA' && cuota.periodo && /^\d{4}-\d{2}/.test(cuota.periodo)) {
      periods.add(cuota.periodo.slice(0, 7));
    }
  }

  // Always offer the last 8 calendar months so the selector matches Figma even if empty.
  const cursor = new Date();
  for (let i = 0; i < 8; i += 1) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    periods.add(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return Array.from(periods)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: formatPeriodLabel(value) }));
}

/** Cuotas cobradas por mes — PAGADA rows for a `yyyy-MM` period. */
export function mapCollectedFeesFromCuotas(
  cuotas: CuotaResumenResponseDto[],
  selectedPeriod?: string,
): MonthlyCollectedFeesReport {
  const monthOptions = buildMonthOptions(cuotas);
  const period =
    selectedPeriod && monthOptions.some((option) => option.value === selectedPeriod)
      ? selectedPeriod
      : (monthOptions[0]?.value ?? currentPeriodValue());

  const paidForPeriod = cuotas.filter(
    (cuota) =>
      cuota.estado === 'PAGADA' &&
      typeof cuota.periodo === 'string' &&
      cuota.periodo.slice(0, 7) === period,
  );

  return {
    title: 'Cuotas cobradas por mes de socios activos y adherentes',
    monthLabel: formatPeriodLabel(period),
    monthOptions,
    selectedPeriod: period,
    items: aggregateByMember(paidForPeriod),
  };
}

function rankTone(rank: number): BenefitUsageRankingItem['tone'] {
  if (rank === 1) {
    return 'gold';
  }
  if (rank === 2) {
    return 'silver';
  }
  if (rank === 3) {
    return 'bronze';
  }
  return 'neutral';
}

function buildTopBenefits(items: BeneficioMasUtilizadoDto[]): BenefitUsageRanking {
  return {
    title: 'Beneficios más utilizados',
    items: items.map((item, index) => {
      const rank = index + 1;
      return {
        rank,
        title: item.beneficioTitulo?.trim() || 'Beneficio',
        merchantName: item.comercioNombre?.trim() || 'No informado',
        usesPerMonth: num(item.usosEsteMes),
        tone: rankTone(rank),
      };
    }),
  };
}

function buildBenefitsByCommerce(
  items: UsoBeneficioPorComercioDto[],
): CommerceBenefitUsageReport {
  // Title says "mes actual" → prefer monthly count, not historical total.
  const mapped = items
    .map((item) => ({
      name: item.comercioNombre?.trim() || 'Comercio',
      value: num(item.cantidadBeneficiosUtilizadosEsteMes),
    }))
    .filter((item) => item.value > 0);

  const max = Math.max(0, ...mapped.map((item) => item.value));
  const niceMax = max <= 0 ? 10 : Math.ceil(max / 4) * 4 || max;
  const step = niceMax / 4;
  const scale = [0, step, step * 2, step * 3, niceMax].map((value) => Math.round(value));

  return {
    title: 'Uso de beneficios por comercio (mes actual)',
    items: mapped,
    scale,
  };
}

/**
 * Composes the Admin Reports view-model from dashboard + cuotas (+ socios count).
 */
export function mapAdminReportBundleToViewModel(
  bundle: AdminReportRawBundle,
  selectedCollectedPeriod?: string,
): ReportsDashboardResponse {
  const dashboard = bundle.dashboard ?? {};
  const indicadores = dashboard.indicadoresPrincipales ?? {};
  const cobranza = dashboard.cobranzaMensual ?? [];
  const year = resolveYear(cobranza, new Date().getFullYear());
  const overdue = mapOverdueMembersFromCuotas(bundle.cuotas);

  return {
    title: 'Reportes',
    subtitle: 'Análisis y estadísticas de la cooperativa',
    metrics: buildMetrics(indicadores, bundle.sociosActivosCount, overdue.items.length),
    collectionsVsPending: buildCollectionsVsPending(cobranza, year),
    debtByMember: mapDebtByMemberFromCuotas(bundle.cuotas),
    overdueMembers: overdue,
    monthlyCollectedFees: mapCollectedFeesFromCuotas(
      bundle.cuotas,
      selectedCollectedPeriod,
    ),
    topBenefits: buildTopBenefits(dashboard.beneficiosMasUtilizados ?? []),
    benefitsByCommerce: buildBenefitsByCommerce(
      dashboard.usoBeneficiosPorComercio ?? [],
    ),
  };
}
