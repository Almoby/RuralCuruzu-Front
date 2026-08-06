import {
  AdminDashboardDto,
  BeneficioMasUtilizadoDto,
  CobranzaMensualDto,
  CobranzaMensualPorCategoriaDto,
  EstadoSociosDto,
  IndicadoresPrincipalesDto,
  SocioConDeudaDto,
  UsoBeneficioPorComercioDto,
} from '../interfaces/admin-dashboard.interface';
import {
  AdminDashboardStats,
  DashboardMetricCard,
  DashboardMonthlyCollections,
  DashboardMemberStatus,
  NamedValue,
  TrendDirection,
} from '../interfaces/dashboard.interface';
import { CHART_COLORS } from '../../pages/admin/utils/chart-theme';
import {
  buildBenefitsByCommerceForPeriod,
  currentCalendarBenefitPeriod,
} from './admin-uso-beneficios.mapper';

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
}

function trendFromDelta(delta: number): TrendDirection {
  if (delta > 0) {
    return 'increase';
  }
  if (delta < 0) {
    return 'decrease';
  }
  return 'neutral';
}

function buildSummaryCards(indicadores: IndicadoresPrincipalesDto): DashboardMetricCard[] {
  const nuevos = num(indicadores.sociosNuevosEsteMes);
  const porcentajeAlDia = num(indicadores.porcentajeAlDiaDelTotal);
  const promos = num(indicadores.promocionesActivas);

  return [
    {
      id: 'total-members',
      title: 'Total de Socios',
      value: num(indicadores.totalSocios),
      valueFormat: 'integer',
      description: `+${formatInteger(nuevos)} este mes`,
      icon: 'people',
      tone: 'primary',
      trendDirection: trendFromDelta(nuevos),
      trendText: `+${formatInteger(nuevos)} este mes`,
      showTrendIcon: nuevos !== 0,
    },
    {
      id: 'fees-up-to-date',
      title: 'Cuotas Al Día',
      value: num(indicadores.sociosConCuotaAlDia),
      valueFormat: 'integer',
      description: `${formatInteger(porcentajeAlDia)}% del total`,
      icon: 'check_circle',
      tone: 'success',
      trendDirection: 'increase',
      trendText: `${formatInteger(porcentajeAlDia)}% del total`,
      showTrendIcon: true,
    },
    {
      id: 'fees-overdue',
      title: 'Cuotas Vencidas',
      value: num(indicadores.sociosConCuotaVencida),
      valueFormat: 'integer',
      description: 'Requieren seguimiento',
      icon: 'alert_circle',
      tone: 'warning',
      trendDirection: 'decrease',
      trendText: 'Requieren seguimiento',
      showTrendIcon: true,
    },
    {
      id: 'active-merchants',
      title: 'Comercios Activos',
      value: num(indicadores.comerciosActivos),
      valueFormat: 'integer',
      description: `${formatInteger(promos)} promos activas`,
      icon: 'storefront',
      tone: 'violet',
      trendDirection: 'neutral',
      trendText: `${formatInteger(promos)} promos activas`,
      showTrendIcon: false,
    },
  ];
}

function buildFinancialCards(indicadores: IndicadoresPrincipalesDto): DashboardMetricCard[] {
  const variacion = num(indicadores.variacionPorcentualFacturacionVsMesAnterior);
  const mora = num(indicadores.sociosEnMora);

  return [
    {
      id: 'monthly-billing',
      title: 'Facturación mensual',
      value: num(indicadores.facturacionMensual),
      valueFormat: 'currency',
      description: `${formatSignedPercent(variacion)} vs mes anterior`,
      icon: 'payments',
      tone: 'primary',
      trendDirection: trendFromDelta(variacion),
      trendText: `${formatSignedPercent(variacion)} vs mes anterior`,
      showTrendIcon: variacion !== 0,
    },
    {
      id: 'accumulated-debt',
      title: 'Deuda acumulada',
      value: num(indicadores.deudaAcumulada),
      valueFormat: 'currency',
      description: `${formatInteger(mora)} socios en mora`,
      icon: 'alert_circle',
      tone: 'warning',
      trendDirection: 'decrease',
      trendText: `${formatInteger(mora)} socios en mora`,
      showTrendIcon: false,
    },
    {
      id: 'benefits-used',
      title: 'Beneficios utilizados',
      value: num(indicadores.beneficiosUtilizados),
      valueFormat: 'compact',
      description: 'Este mes',
      icon: 'gift',
      tone: 'violet',
      trendDirection: 'neutral',
      trendText: 'Este mes',
      showTrendIcon: false,
    },
  ];
}

/** Shared month label for cobranza series (Dashboard + Reportes). */
export function formatCobranzaMonthLabel(
  item: Pick<CobranzaMensualDto, 'mes' | 'periodo'>,
): string {
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

export function asFiniteNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function mapCobranzaMensualPorCategoriaDto(
  items: CobranzaMensualPorCategoriaDto[] | null | undefined,
): AdminDashboardStats['cobranzaMensualPorCategoria'] {
  return (items ?? []).map((item) => ({
    periodo: typeof item.periodo === 'string' ? item.periodo.trim() : '',
    mesLabel: formatCobranzaMonthLabel(item),
    cobradoActivo: asFiniteNumber(item.cobradoActivo),
    cobradoAdherente: asFiniteNumber(item.cobradoAdherente),
  }));
}

export function mapSociosConDeudaDto(
  items: SocioConDeudaDto[] | null | undefined,
): AdminDashboardStats['sociosConDeuda'] {
  return (items ?? []).map((item, index) => ({
    socioId: item.socioId?.trim() || `deuda-${index}`,
    numeroSocio: item.numeroSocio?.trim() || '—',
    nombre: item.nombre?.trim() || 'No informado',
    montoAdeudado: asFiniteNumber(item.montoAdeudado),
    cantidadCuotasVencidas: asFiniteNumber(item.cantidadCuotasVencidas),
  }));
}

function buildMonthlyCollections(
  items: CobranzaMensualDto[],
): DashboardMonthlyCollections {
  const labels = items.map(formatCobranzaMonthLabel);
  const collected = items.map((item) => num(item.cobrado));
  const pending = items.map((item) => num(item.pendiente));
  const maxValue = Math.max(0, ...collected, ...pending);
  const niceMax = maxValue <= 0 ? 1000 : Math.ceil(maxValue / 1000) * 1000;
  const tickCount = 4;
  const step = niceMax / tickCount;
  const yAxisLabels = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = step * index;
    return `$${Math.round(value / 1000)}k`;
  });

  return {
    title: 'Cobranza mensual',
    labels,
    yAxisLabels,
    yAxisMax: niceMax,
    series: [
      {
        id: 'collected',
        name: 'Cobrado',
        color: CHART_COLORS.primary,
        values: collected,
      },
      {
        id: 'pending',
        name: 'Pendiente',
        color: CHART_COLORS.brown,
        values: pending,
      },
    ],
    legend: [
      { id: 'collected', label: 'Cobrado', color: CHART_COLORS.primary },
      { id: 'pending', label: 'Pendiente', color: CHART_COLORS.brown },
    ],
  };
}

function buildMemberStatus(estado: EstadoSociosDto | null | undefined): DashboardMemberStatus {
  const segments = [
    {
      id: 'up-to-date',
      name: 'Al día',
      value: num(estado?.alDia),
      color: CHART_COLORS.primary,
    },
    {
      id: 'pending',
      name: 'Pendiente',
      value: num(estado?.pendientes),
      color: CHART_COLORS.brown,
    },
    {
      id: 'overdue',
      name: 'Vencido',
      value: num(estado?.vencidos),
      color: '#7B8A9A',
    },
    {
      id: 'inactive',
      name: 'Inactivo',
      value: num(estado?.inactivos),
      color: '#C4CBD1',
    },
  ];

  return {
    title: 'Estado de socios',
    segments,
  };
}


function buildTopBenefits(items: BeneficioMasUtilizadoDto[]): NamedValue[] {
  return items.map((item) => ({
    name: item.beneficioTitulo?.trim() || 'Beneficio',
    value: num(item.usosEsteMes),
  }));
}

/**
 * Maps Swagger `DashboardPrincipalResponse` to the Admin Dashboard view-model.
 */
export function mapAdminDashboardDtoToViewModel(dto: AdminDashboardDto): AdminDashboardStats {
  const indicadores = dto.indicadoresPrincipales ?? {};
  const cobranza = dto.cobranzaMensual ?? [];
  const comercios = dto.usoBeneficiosPorComercio ?? [];
  const topBenefits = dto.beneficiosMasUtilizados ?? [];

  const summaryCards = buildSummaryCards(indicadores);
  const financialCards = buildFinancialCards(indicadores);
  const monthlyCollections = buildMonthlyCollections(cobranza);
  const memberStatus = buildMemberStatus(dto.estadoSocios);
  const defaultBenefit = currentCalendarBenefitPeriod();
  const benefitsChart = buildBenefitsByCommerceForPeriod(
    comercios,
    defaultBenefit.year,
    defaultBenefit.month,
  );

  return {
    title: 'Dashboard General',
    subtitle: 'Resumen operativo de la cooperativa',
    summaryCards,
    financialCards,
    monthlyCollections,
    memberStatus,
    usoBeneficiosPorComercio: comercios,
    benefitsByCommerce: {
      title: benefitsChart.title,
      scale: benefitsChart.scale,
      items: benefitsChart.items,
    },
    cobranzaMensualPorCategoria: mapCobranzaMensualPorCategoriaDto(
      dto.cobranzaMensualPorCategoria,
    ),
    sociosConDeuda: mapSociosConDeudaDto(dto.sociosConDeuda),
    sociosActivos: num(indicadores.sociosActivos),
    sociosNuevosEsteAnio: num(indicadores.sociosNuevosEsteAnio),
    sociosConCuotaPendiente: num(indicadores.sociosConCuotaPendiente),
    beneficiosUtilizadosHistoricoTotal: num(
      indicadores.beneficiosUtilizadosHistoricoTotal,
    ),
    totalMembers: num(indicadores.totalSocios),
    activeMembers: num(indicadores.sociosActivos),
    pendingRequests: 0,
    activeMerchants: num(indicadores.comerciosActivos),
    feesCollectedMonth: num(indicadores.facturacionMensual),
    feesPendingMonth: num(indicadores.deudaAcumulada),
    redemptionsMonth: num(indicadores.beneficiosUtilizados),
    membersByCategory: memberStatus.segments.map((segment) => ({
      name: segment.name,
      value: segment.value,
      color: segment.color,
    })),
    feesTrend: monthlyCollections.labels.map((label, index) => ({
      label,
      value: monthlyCollections.series[0]?.values[index] ?? 0,
    })),
    redemptionsTrend: [],
    topMerchants: benefitsChart.items.map((item) => ({
      name: item.name,
      value: item.value,
    })),
    // Exposed for future UI; current Admin Dashboard design has no ranking section.
    topBenefits: buildTopBenefits(topBenefits),
  };
}
