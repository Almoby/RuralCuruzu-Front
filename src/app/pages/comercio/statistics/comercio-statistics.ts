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
import {
  EMPTY,
  Subject,
  catchError,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { DashboardService } from '../../../core/services/dashboard.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { ComercioEstadisticasViewModel } from '../../../core/interfaces/comercio-estadisticas.interface';
import {
  AppAlert,
  AppButton,
  AppCard,
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

type ComercioStatisticsViewState = 'loading' | 'success' | 'error';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

function computeYAxisMax(values: number[], fallback = 4): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  if (peak <= 0) {
    return fallback;
  }
  if (peak <= 100) {
    return Math.max(25, Math.ceil(peak / 25) * 25);
  }
  return Math.ceil(peak / 25) * 25;
}

@Component({
  selector: 'app-comercio-statistics',
  standalone: true,
  imports: [
    BaseChartDirective,
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppLoading,
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
  private readonly reload$ = new Subject<void>();

  readonly viewState = signal<ComercioStatisticsViewState>('loading');
  readonly data = signal<ComercioEstadisticasViewModel | null>(null);
  readonly errorMessage = signal(
    'No se pudieron cargar las estadísticas. Intentá nuevamente.',
  );

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
    (): ChartConfiguration<'line'>['options'] => {
      const values = (this.data()?.monthlyUsage ?? []).map(
        (point) => point.usageCount,
      );
      const yMax = computeYAxisMax(values, 100);
      const stepSize = yMax / 4;

      return {
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
            max: yMax,
            ticks: {
              ...chartTickStyle,
              stepSize,
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
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.viewState.set('loading');
          this.data.set(null);
        }),
        switchMap(() =>
          this.dashboardService.getComercioEstadisticas().pipe(
            catchError((error: unknown) => {
              this.data.set(null);
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar las estadísticas. Intentá nuevamente.',
              );
              this.viewState.set('error');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.data.set(payload);
        this.viewState.set('success');
      });
  }

  retry(): void {
    this.reload$.next();
  }
}
