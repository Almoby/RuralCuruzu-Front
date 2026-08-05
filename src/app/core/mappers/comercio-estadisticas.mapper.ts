import {
  ComercioEstadisticasMonthlyPointVm,
  ComercioEstadisticasPromotionPointVm,
  ComercioEstadisticasRecentUsageVm,
  ComercioEstadisticasViewModel,
  ConsumoRecienteResponseDto,
  EstadisticasComercioResponseDto,
  UsoMensualResponseDto,
  UsoPorPromocionResponseDto,
} from '../interfaces/comercio-estadisticas.interface';

const MONTH_SHORT_BY_INDEX: readonly string[] = [
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
] as const;

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Label for monthly chart: prefer backend `mes`, else derive short name from `periodo` (yyyy-MM).
 * Does not invent missing months — only maps what the API returns (order preserved).
 */
function mapMonthLabel(item: UsoMensualResponseDto): string {
  const mes = text(item.mes);
  if (mes) {
    return mes;
  }

  const periodo = text(item.periodo);
  const match = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (match) {
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return MONTH_SHORT_BY_INDEX[monthIndex];
    }
  }

  return periodo || '—';
}

function mapMonthlyUsage(
  items: UsoMensualResponseDto[] | null | undefined,
): ComercioEstadisticasMonthlyPointVm[] {
  return (items ?? []).map((item) => ({
    month: mapMonthLabel(item),
    usageCount: asNumber(item.cantidad),
    periodo: text(item.periodo),
  }));
}

function mapPromotionUsage(
  items: UsoPorPromocionResponseDto[] | null | undefined,
): ComercioEstadisticasPromotionPointVm[] {
  return (items ?? []).map((item, index) => ({
    promotionId: text(item.beneficioId, `promo-${index}`),
    promotionName: text(item.beneficioTitulo, 'Promoción'),
    usageCount: asNumber(item.cantidad),
  }));
}

/** Formats Instant/date-time for the recent usages table (es-AR, no invented values). */
export function formatConsumoFechaLabel(iso: string | null | undefined): string {
  const raw = text(iso);
  if (!raw) {
    return '—';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const formatted = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return formatted.replace(',', '');
}

function mapRecentUsages(
  items: ConsumoRecienteResponseDto[] | null | undefined,
): ComercioEstadisticasRecentUsageVm[] {
  return (items ?? []).map((item, index) => {
    const usedAt = text(item.fechaUso);
    return {
      id: usedAt ? `${usedAt}-${index}` : `consumo-${index}`,
      memberName: text(item.socioNombre, 'Socio'),
      benefitName: text(item.beneficioTitulo, 'Beneficio'),
      usedAt,
      usedAtLabel: formatConsumoFechaLabel(usedAt),
    };
  });
}

export function mapEstadisticasComercioDtoToViewModel(
  dto: EstadisticasComercioResponseDto | null | undefined,
): ComercioEstadisticasViewModel {
  const indicadores = dto?.indicadores ?? {};

  return {
    summary: {
      totalHistoricalUses: asNumber(indicadores.usosHistoricoTotal),
      uniqueMembers: asNumber(indicadores.sociosUnicos),
      activePromotions: asNumber(indicadores.promocionesActivas),
      usesThisMonth: asNumber(indicadores.usosEsteMes),
    },
    monthlyUsage: mapMonthlyUsage(dto?.usosMensuales),
    promotionUsage: mapPromotionUsage(dto?.usosPorPromocion),
    recentUsages: mapRecentUsages(dto?.consumosRecientes),
  };
}
