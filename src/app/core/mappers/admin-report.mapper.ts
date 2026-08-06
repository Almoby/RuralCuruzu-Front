import {
  CuotaEstado,
  CuotaResumenResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  BeneficioMasUtilizadoDto,
  CobranzaMensualDto,
  IndicadoresPrincipalesDto,
  SocioConDeudaDto,
} from '../interfaces/admin-dashboard.interface';
import { AdminReportRawBundle } from '../interfaces/admin-report.interface';
import {
  BenefitUsageRanking,
  BenefitUsageRankingItem,
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
import {
  asFiniteNumber,
  formatCobranzaMonthLabel,
} from './admin-dashboard.mapper';
import {
  buildBenefitsByCommerceForPeriod,
  currentCalendarBenefitPeriod,
  extractYearsFromPeriodos,
  parsePeriodParts,
} from './admin-uso-beneficios.mapper';

export {
  BENEFIT_MONTH_OPTIONS,
  buildBenefitsByCommerceChartTitle,
  buildBenefitsByCommerceForPeriod,
  currentCalendarBenefitPeriod,
  extractYearsFromUsoPorPeriodo,
  formatBenefitPeriodLabel,
  parsePeriodParts,
  resolveDefaultBenefitPeriod,
} from './admin-uso-beneficios.mapper';

/** Fallback debt states when dashboard `sociosConDeuda` is unavailable. */
const DEBT_STATES: ReadonlySet<CuotaEstado> = new Set([
  'PENDIENTE',
  'INFORMADA',
  'EN_REVISION',
  'VENCIDA',
  'RECHAZADA',
]);

function num(value: number | null | undefined): number {
  return asFiniteNumber(value);
}

export function extractYearsFromCobranza(items: CobranzaMensualDto[]): number[] {
  return extractYearsFromPeriodos(items.map((item) => item.periodo));
}

function resolveYear(items: CobranzaMensualDto[], fallback: number): number {
  const years = extractYearsFromCobranza(items);
  if (years.includes(fallback)) {
    return fallback;
  }
  return years[0] ?? fallback;
}

export function filterCobranzaByYear(
  items: CobranzaMensualDto[],
  year: number,
): CobranzaMensualDto[] {
  return items.filter((item) => parsePeriodParts(item.periodo)?.year === year);
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

function toMemberDebtItem(
  key: string,
  name: string,
  code: string,
  amount: number,
  extras?: Pick<MemberDebtItem, 'overdueCount' | 'paidAt' | 'period'>,
): MemberDebtItem {
  return {
    memberId: key,
    memberName: name || 'No informado',
    shortName: shortNameFromFull(name || 'No informado'),
    memberCode: code || '—',
    amount,
    ...extras,
  };
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

function aggregateByMember(
  cuotas: CuotaResumenResponseDto[],
): MemberDebtItem[] {
  const map = new Map<
    string,
    { name: string; code: string; amount: number; overdueCount: number }
  >();

  for (const cuota of cuotas) {
    const key = memberKey(cuota);
    const existing = map.get(key);
    const amount = num(cuota.importe);
    const name = cuota.socioNombre?.trim() || existing?.name || '';
    const code = cuota.socioNumeroSocio?.trim() || existing?.code || '';
    const overdueInc = cuota.estado === 'VENCIDA' ? 1 : 0;

    if (existing) {
      existing.amount += amount;
      existing.overdueCount += overdueInc;
      if (!existing.name && name) {
        existing.name = name;
      }
      if (!existing.code && code) {
        existing.code = code;
      }
    } else {
      map.set(key, { name, code, amount, overdueCount: overdueInc });
    }
  }

  return Array.from(map.entries())
    .map(([key, value]) =>
      toMemberDebtItem(key, value.name, value.code, value.amount, {
        overdueCount: value.overdueCount,
      }),
    )
    .filter((item) => item.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (b.overdueCount ?? 0) - (a.overdueCount ?? 0) ||
        a.memberName.localeCompare(b.memberName, 'es'),
    );
}

function compareCollectedFees(a: MemberDebtItem, b: MemberDebtItem): number {
  const paidA = a.paidAt?.trim() ?? '';
  const paidB = b.paidAt?.trim() ?? '';
  if (paidA !== paidB) {
    return paidB.localeCompare(paidA);
  }
  const periodA = a.period?.trim() ?? '';
  const periodB = b.period?.trim() ?? '';
  if (periodA !== periodB) {
    return periodB.localeCompare(periodA);
  }
  return a.memberName.localeCompare(b.memberName, 'es');
}

function buildMetrics(
  indicadores: IndicadoresPrincipalesDto,
  overdueDistinctCount: number,
): ReportMetric[] {
  return [
    {
      id: 'active-members',
      label: 'Socios activos',
      value: num(indicadores.sociosActivos ?? indicadores.totalSocios),
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

/** Builds “Cobrados vs pendientes” for a specific year (title without year). */
export function buildCollectionsVsPending(
  items: CobranzaMensualDto[],
  year: number,
): MonthlyPaymentsReport {
  const forYear = filterCobranzaByYear(items, year);
  const labels = forYear.map(formatCobranzaMonthLabel);
  const collected = forYear.map((item) => num(item.cobrado));
  const pending = forYear.map((item) => num(item.pendiente));
  const maxValue = Math.max(0, ...collected, ...pending);

  return {
    title: 'Cobrados vs pendientes',
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

/** Prefer Swagger `sociosConDeuda` from GET /admin/dashboard. */
export function mapDebtByMemberFromSociosConDeuda(
  items: SocioConDeudaDto[] | null | undefined,
): MemberDebtReport {
  const mapped = (items ?? [])
    .map((item, index) =>
      toMemberDebtItem(
        item.socioId?.trim() || item.numeroSocio?.trim() || `deuda-${index}`,
        item.nombre?.trim() || 'No informado',
        item.numeroSocio?.trim() || '—',
        num(item.montoAdeudado),
        { overdueCount: num(item.cantidadCuotasVencidas) },
      ),
    )
    .filter((item) => item.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (b.overdueCount ?? 0) - (a.overdueCount ?? 0) ||
        a.memberName.localeCompare(b.memberName, 'es'),
    );

  const max = Math.max(0, ...mapped.map((item) => item.amount));

  return {
    title: 'Deuda acumulada por socio',
    items: mapped,
    yAxisMax: niceAxisMax(max, 1000),
  };
}

/** Socios con cuota vencida — from `sociosConDeuda.cantidadCuotasVencidas`. */
export function mapOverdueMembersFromSociosConDeuda(
  items: SocioConDeudaDto[] | null | undefined,
): OverdueMemberReport {
  const mapped = (items ?? [])
    .filter((item) => num(item.cantidadCuotasVencidas) > 0)
    .map((item, index) =>
      toMemberDebtItem(
        item.socioId?.trim() || item.numeroSocio?.trim() || `vencida-${index}`,
        item.nombre?.trim() || 'No informado',
        item.numeroSocio?.trim() || '—',
        num(item.montoAdeudado),
        { overdueCount: num(item.cantidadCuotasVencidas) },
      ),
    )
    .filter((item) => item.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (b.overdueCount ?? 0) - (a.overdueCount ?? 0) ||
        a.memberName.localeCompare(b.memberName, 'es'),
    );

  return {
    title: 'Socios con cuota vencida',
    items: mapped,
  };
}

/** Fallback when dashboard debt payload is unavailable. */
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

/** Fallback overdue list from GET /admin/cuotas. */
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

/** Cuotas cobradas por mes — one row per PAGADA cuota in the selected period. */
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

  const items = paidForPeriod
    .map((cuota) => {
      const name = cuota.socioNombre?.trim() || 'No informado';
      const code = cuota.socioNumeroSocio?.trim() || '—';
      const paidAt = cuota.pagoVigente?.fechaPago?.trim() || '';
      const feePeriod =
        typeof cuota.periodo === 'string' ? cuota.periodo.slice(0, 7) : period;
      return toMemberDebtItem(cuota.id, name, code, num(cuota.importe), {
        paidAt,
        period: feePeriod,
      });
    })
    .filter((item) => item.amount > 0)
    .sort(compareCollectedFees);

  return {
    title: 'Cuotas cobradas por mes de socios activos y adherentes',
    monthLabel: formatPeriodLabel(period),
    monthOptions,
    selectedPeriod: period,
    items,
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

/**
 * Composes Admin Reports from dashboard (primary) + cuotas (collected-by-month only).
 * Debt / overdue prefer `sociosConDeuda`; cuotas aggregation is fallback only.
 * “Uso de beneficios por comercio” always uses the current calendar month/year.
 */
export function mapAdminReportBundleToViewModel(
  bundle: AdminReportRawBundle,
  selectedCollectedPeriod?: string,
): ReportsDashboardResponse {
  const dashboard = bundle.dashboard ?? {};
  const indicadores = dashboard.indicadoresPrincipales ?? {};
  const cobranza = dashboard.cobranzaMensual ?? [];
  const year = resolveYear(cobranza, new Date().getFullYear());
  const comercios = dashboard.usoBeneficiosPorComercio ?? [];
  const currentBenefit = currentCalendarBenefitPeriod();
  const benefitsByCommerce = buildBenefitsByCommerceForPeriod(
    comercios,
    currentBenefit.year,
    currentBenefit.month,
    { titleWithPeriod: true },
  );

  const hasDashboardDebt = !bundle.dashboardFailed && dashboard.sociosConDeuda != null;
  const debtByMember = hasDashboardDebt
    ? mapDebtByMemberFromSociosConDeuda(dashboard.sociosConDeuda)
    : mapDebtByMemberFromCuotas(bundle.cuotas);
  const overdueMembers = hasDashboardDebt
    ? mapOverdueMembersFromSociosConDeuda(dashboard.sociosConDeuda)
    : mapOverdueMembersFromCuotas(bundle.cuotas);

  return {
    title: 'Reportes',
    subtitle: 'Análisis y estadísticas de la cooperativa',
    metrics: buildMetrics(indicadores, overdueMembers.items.length),
    collectionsVsPending: buildCollectionsVsPending(cobranza, year),
    debtByMember,
    overdueMembers,
    monthlyCollectedFees: mapCollectedFeesFromCuotas(
      bundle.cuotas,
      selectedCollectedPeriod,
    ),
    topBenefits: buildTopBenefits(dashboard.beneficiosMasUtilizados ?? []),
    benefitsByCommerce: {
      title: benefitsByCommerce.title,
      items: benefitsByCommerce.items.map(({ name, value }) => ({ name, value })),
      scale: benefitsByCommerce.scale,
    },
  };
}
