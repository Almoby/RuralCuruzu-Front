import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { DashboardService } from '../../../core/services/dashboard.service';
import { MerchantStatisticsData } from '../../../core/interfaces/dashboard.interface';
import {
  AppAlert,
  AppButton,
  AppCard,
  AppEmptyState,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import {
  CHART_COLORS,
  CHART_FONT_FAMILY,
  chartGridStyle,
  chartTickStyle,
} from '../../admin/utils/chart-theme';

type ComercioStatisticsViewState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-comercio-statistics',
  standalone: true,
  imports: [
    BaseChartDirective,
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppButton,
  ],
  templateUrl: './comercio-statistics.html',
  styleUrl: './comercio-statistics.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioStatistics {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewState = signal<ComercioStatisticsViewState>('loading');
  readonly data = signal<MerchantStatisticsData | null>(null);

  readonly summary = computed(() => this.data()?.summary ?? null);
  readonly recentUsages = computed(() => this.data()?.recentUsages ?? []);

  readonly monthlyChartData = computed((): ChartData<'line'> | null => {
    const points = this.data()?.monthlyUsage ?? [];
    if (points.length === 0) {
      return null;
    }

    return {
      labels: points.map((point) => point.month),
      datasets: [
        {
          data: points.map((point) => point.usageCount),
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primary,
          pointBackgroundColor: CHART_COLORS.primary,
          pointBorderColor: CHART_COLORS.primary,
          pointBorderWidth: 0,
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.35,
          fill: false,
        },
      ],
    };
  });

  readonly monthlyChartOptions = computed(
    (): ChartConfiguration<'line'>['options'] => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: ${item.parsed.y ?? 0}`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            ...chartGridStyle,
            drawTicks: false,
          },
          border: { display: false },
          ticks: {
            ...chartTickStyle,
            font: { size: 11, family: CHART_FONT_FAMILY },
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            ...chartTickStyle,
            stepSize: 25,
            font: { size: 10, family: CHART_FONT_FAMILY },
          },
          grid: {
            ...chartGridStyle,
            drawTicks: false,
          },
          border: { display: false },
        },
      },
    }),
  );

  readonly promotionChartData = computed((): ChartData<'bar'> | null => {
    const items = this.data()?.promotionUsage ?? [];
    if (items.length === 0) {
      return null;
    }

    return {
      labels: items.map((item) => item.promotionName),
      datasets: [
        {
          data: items.map((item) => item.usageCount),
          backgroundColor: CHART_COLORS.brown,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0,
          },
          borderSkipped: false,
          barPercentage: items.length === 1 ? 0.45 : 0.6,
          categoryPercentage: items.length === 1 ? 0.55 : 0.75,
          maxBarThickness: items.length === 1 ? 140 : 56,
        },
      ],
    };
  });

  readonly promotionChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const items = this.data()?.promotionUsage ?? [];
      const maxUsage = Math.max(...items.map((item) => item.usageCount), 0);
      const yMax = maxUsage <= 100 ? 100 : Math.ceil(maxUsage / 25) * 25;

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: () => '',
              label: (item) => `${item.label}: ${item.parsed.y ?? 0}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              ...chartTickStyle,
              font: { size: 11, family: CHART_FONT_FAMILY },
            },
          },
          y: {
            min: 0,
            max: yMax,
            ticks: {
              ...chartTickStyle,
              stepSize: yMax / 4,
              font: { size: 10, family: CHART_FONT_FAMILY },
            },
            grid: {
              ...chartGridStyle,
              drawTicks: false,
            },
            border: { display: false },
          },
        },
      };
    },
  );

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  formatUsageDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
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

  private load(): void {
    this.viewState.set('loading');

    this.dashboardService
      .getComercioStatistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.data.set(payload);
          this.viewState.set(payload ? 'success' : 'empty');
        },
        error: () => {
          this.data.set(null);
          this.viewState.set('error');
        },
      });
  }
}
