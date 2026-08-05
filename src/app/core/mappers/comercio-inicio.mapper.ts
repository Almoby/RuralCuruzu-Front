import {
  BeneficioComercioResponseDto,
  ComercioInicioFeaturedPromotion,
  ComercioInicioTrendPoint,
  ComercioInicioViewModel,
  InicioComercioResponseDto,
  UsoDiaSemanaDto,
  UsoDiaSemanaResponseDto,
} from '../interfaces/comercio-inicio.interface';

const WEEK_ORDER: readonly UsoDiaSemanaDto[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const DAY_LABELS: Record<UsoDiaSemanaDto, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function isWeekDay(value: string | null | undefined): value is UsoDiaSemanaDto {
  return !!value && (WEEK_ORDER as readonly string[]).includes(value);
}

function mapWeeklyTrend(
  usosPorDia: UsoDiaSemanaResponseDto[] | null | undefined,
): ComercioInicioTrendPoint[] {
  const byDay = new Map<UsoDiaSemanaDto, number>();
  for (const item of usosPorDia ?? []) {
    const day = typeof item.dia === 'string' ? item.dia.trim().toUpperCase() : '';
    if (!isWeekDay(day)) {
      continue;
    }
    byDay.set(day, asNumber(item.cantidad));
  }

  // Always Mon→Sun so the chart keeps temporal order even if API omits a day.
  return WEEK_ORDER.map((day) => ({
    day,
    label: DAY_LABELS[day],
    value: byDay.get(day) ?? 0,
  }));
}

function mapFeaturedPromotion(
  beneficios: BeneficioComercioResponseDto[],
): ComercioInicioFeaturedPromotion | null {
  const active = beneficios.filter(
    (item) => text(item.estado).toUpperCase() === 'ACTIVO' && text(item.titulo),
  );
  if (active.length === 0) {
    return null;
  }

  active.sort((a, b) => asNumber(b.usosEsteMes) - asNumber(a.usosEsteMes));
  const top = active[0];
  const title = text(top.titulo);
  if (!title) {
    return null;
  }

  return {
    id: text(top.id) || `beneficio-${title}`,
    title,
    usesThisMonth: asNumber(top.usosEsteMes),
    status: 'Activa',
    statusRaw: 'ACTIVO',
  };
}

function pickMerchantName(beneficios: BeneficioComercioResponseDto[]): string | null {
  for (const item of beneficios) {
    const name = text(item.comercioNombre);
    if (name) {
      return name;
    }
  }
  return null;
}

/**
 * Maps Inicio dashboard + beneficios list into the Inicio Comercio ViewModel.
 */
export function mapComercioInicioBundleToViewModel(
  inicio: InicioComercioResponseDto | null | undefined,
  beneficios: BeneficioComercioResponseDto[] | null | undefined,
): ComercioInicioViewModel {
  const indicadores = inicio?.indicadores ?? {};
  const list = beneficios ?? [];

  return {
    merchantName: pickMerchantName(list),
    usesThisMonth: asNumber(indicadores.usosEsteMes),
    activePromotions: asNumber(indicadores.promocionesActivas),
    reachedMembers: asNumber(indicadores.sociosAlcanzados),
    validationsToday: asNumber(indicadores.validacionesHoy),
    weeklyTrend: mapWeeklyTrend(inicio?.usosPorDia),
    featuredPromotion: mapFeaturedPromotion(list),
  };
}
