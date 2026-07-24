export const CHART_FONT_FAMILY = 'Inter, system-ui, sans-serif';

export const CHART_COLORS = {
  primary: '#004a49',
  brown: '#6b4419',
  muted: '#6b7280',
  text: '#1a1f1e',
  grid: '#e8ecec',
  white: '#ffffff',
} as const;

export function formatChartCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatChartCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${value}`;
}

export function currencyTooltipLabel(
  raw: unknown,
  label: string,
): string {
  const value = typeof raw === 'number' ? raw : Number(raw);
  return `${label}: ${formatChartCurrency(Number.isFinite(value) ? value : 0)}`;
}

export const chartTickStyle = {
  font: { size: 10, family: CHART_FONT_FAMILY },
  color: CHART_COLORS.muted,
};

export const chartGridStyle = {
  color: CHART_COLORS.grid,
  tickBorderDash: [3, 3] as number[],
};

export const chartLegendBottomLabels = {
  boxWidth: 10,
  boxHeight: 10,
  font: { size: 11, family: CHART_FONT_FAMILY },
  color: CHART_COLORS.text,
  padding: 14,
  usePointStyle: false as const,
};
