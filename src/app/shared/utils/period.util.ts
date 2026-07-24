const MONTH_NAMES_ES = [
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

/** Formats `YYYY-MM` as "Junio 2026". */
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  const monthIndex = Number(month) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return period;
  }
  return `${MONTH_NAMES_ES[monthIndex]} ${year}`;
}

/** Formats `YYYY-MM` as "Cuota de Junio 2026". */
export function formatFeePeriodTitle(period: string): string {
  return `Cuota de ${formatPeriodLabel(period)}`;
}
