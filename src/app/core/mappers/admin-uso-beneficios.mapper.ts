import { UsoBeneficioPorComercioDto } from '../interfaces/admin-dashboard.interface';

const MONTH_LABELS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Calendar month options (01–12) with Spanish labels. */
export const BENEFIT_MONTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  MONTH_LABELS_ES.map((label, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label,
  }));

export interface BenefitsByCommerceChartItem {
  id: string;
  name: string;
  value: number;
}

export interface BenefitsByCommerceChartModel {
  title: string;
  items: BenefitsByCommerceChartItem[];
  scale: number[];
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parsePeriodParts(
  periodo: string | null | undefined,
): { year: number; month: string } | null {
  if (!periodo) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})/.exec(periodo.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  if (!Number.isFinite(year)) {
    return null;
  }
  return { year, month: match[2] };
}

export function extractYearsFromPeriodos(periodos: Array<string | null | undefined>): number[] {
  const years = new Set<number>();
  for (const periodo of periodos) {
    const parts = parsePeriodParts(periodo);
    if (parts) {
      years.add(parts.year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function extractYearsFromUsoPorPeriodo(
  items: UsoBeneficioPorComercioDto[],
): number[] {
  const periodos: Array<string | null | undefined> = [];
  for (const comercio of items) {
    for (const uso of comercio.usoPorPeriodo ?? []) {
      periodos.push(uso.periodo);
    }
  }
  return extractYearsFromPeriodos(periodos);
}

export function extractPeriodosFromUsoPorPeriodo(
  items: UsoBeneficioPorComercioDto[],
): string[] {
  const periods = new Set<string>();
  for (const comercio of items) {
    for (const uso of comercio.usoPorPeriodo ?? []) {
      const parts = parsePeriodParts(uso.periodo);
      if (parts) {
        periods.add(`${parts.year}-${parts.month}`);
      }
    }
  }
  return Array.from(periods).sort((a, b) => b.localeCompare(a));
}

/** Current browser calendar period (`yyyy` + `MM`). */
export function currentCalendarBenefitPeriod(now = new Date()): {
  year: number;
  month: string;
} {
  return {
    year: now.getFullYear(),
    month: String(now.getMonth() + 1).padStart(2, '0'),
  };
}

/**
 * Default filter period:
 * 1) current calendar period if data exists;
 * 2) otherwise most recent available period;
 * 3) otherwise current calendar period as visual reference.
 */
export function resolveDefaultBenefitPeriod(
  items: UsoBeneficioPorComercioDto[],
  now = new Date(),
): { year: number; month: string } {
  const current = currentCalendarBenefitPeriod(now);
  const currentPeriod = `${current.year}-${current.month}`;
  const periods = extractPeriodosFromUsoPorPeriodo(items);

  if (periods.includes(currentPeriod)) {
    return current;
  }

  if (periods.length > 0) {
    const parts = parsePeriodParts(periods[0]);
    if (parts) {
      return parts;
    }
  }

  return current;
}

/** e.g. `Agosto 2026` */
export function formatBenefitPeriodLabel(year: number, month: string): string {
  const normalized = month.padStart(2, '0');
  const monthLabel =
    BENEFIT_MONTH_OPTIONS.find((item) => item.value === normalized)?.label ?? normalized;
  return `${monthLabel} ${year}`;
}

export function buildBenefitsByCommerceChartTitle(year: number, month: string): string {
  return `Uso de beneficios por comercio (${formatBenefitPeriodLabel(year, month)})`;
}

/**
 * Builds “Uso de beneficios por comercio” for `yyyy-MM` via `usoPorPeriodo`.
 * Missing period → 0 (never uses historical totals).
 * Items with value 0 are omitted from the series.
 */
export function buildBenefitsByCommerceForPeriod(
  items: UsoBeneficioPorComercioDto[],
  year: number,
  month: string,
  options?: { titleWithPeriod?: boolean },
): BenefitsByCommerceChartModel {
  const period = `${year}-${month.padStart(2, '0')}`;
  const mapped = items.map((item, index) => {
    const match = (item.usoPorPeriodo ?? []).find((uso) => {
      const parts = parsePeriodParts(uso.periodo);
      return parts != null && `${parts.year}-${parts.month}` === period;
    });
    return {
      id: item.comercioId?.trim() || `commerce-${index}`,
      name: item.comercioNombre?.trim() || 'Comercio',
      value: match ? num(match.cantidad) : 0,
    };
  });

  const withUsage = mapped.filter((item) => item.value > 0);
  const max = Math.max(0, ...withUsage.map((item) => item.value));
  const niceMax = max <= 0 ? 10 : Math.ceil(max / 4) * 4 || max;
  const step = niceMax / 4;
  const scale = [0, step, step * 2, step * 3, niceMax].map((value) => Math.round(value));

  return {
    title: options?.titleWithPeriod
      ? buildBenefitsByCommerceChartTitle(year, month)
      : 'Uso de beneficios por comercio',
    items: withUsage,
    scale,
  };
}
