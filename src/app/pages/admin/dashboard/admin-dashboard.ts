import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, TooltipItem } from 'chart.js';
import {
  AppAlert,
  AppCard,
  AppEmptyState,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { DashboardService } from '../../../core/services/dashboard.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  AdminDashboardStats,
  DashboardMetricCard,
  DashboardValueFormat,
  TrendDirection,
} from '../../../core/interfaces/dashboard.interface';

type DashboardViewState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    AppPageHeader,
    AppCard,
    AppLoading,
    AppIcon,
    AppAlert,
    AppEmptyState,
    BaseChartDirective,
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private readonly dashboardService = inject(DashboardService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly viewState = signal<DashboardViewState>('loading');
  protected readonly stats = signal<AdminDashboardStats | null>(null);

  protected readonly title = computed(() => this.stats()?.title ?? 'Dashboard General');
  protected readonly subtitle = computed(
    () => this.stats()?.subtitle ?? 'Resumen operativo de la cooperativa',
  );

  protected readonly summaryCards = computed(() => this.stats()?.summaryCards ?? []);
  protected readonly financialCards = computed(() => this.stats()?.financialCards ?? []);

  protected readonly monthlyCollections = computed(
    () => this.stats()?.monthlyCollections ?? null,
  );

  protected readonly memberStatus = computed(() => this.stats()?.memberStatus ?? null);

  protected readonly benefitsByCommerce = computed(
    () => this.stats()?.benefitsByCommerce ?? null,
  );

  protected readonly collectionChartData = computed((): ChartData<'bar'> | null => {
    const chart = this.monthlyCollections();
    if (!chart || chart.labels.length === 0) {
      return null;
    }

    return {
      labels: chart.labels,
      datasets: chart.series.map((series) => ({
        label: series.name,
        data: series.values,
        backgroundColor: series.color,
        borderColor: series.color,
        borderWidth: 0,
        borderRadius: 3,
        maxBarThickness: 16,
        categoryPercentage: 0.55,
        barPercentage: 0.75,
      })),
    };
  });

  protected readonly collectionChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const chart = this.monthlyCollections();
      const max = chart?.yAxisMax ?? 600000;
      const tickCount = Math.max((chart?.yAxisLabels.length ?? 5) - 1, 1);
      const stepSize = max / tickCount;

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              color: '#1a1f1e',
              padding: 14,
              usePointStyle: false,
            },
          },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'bar'>) => {
                const value = typeof item.raw === 'number' ? item.raw : Number(item.raw);
                return `${item.dataset.label ?? ''}: ${this.formatValue(value, 'currency')}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10, family: 'Inter, system-ui, sans-serif' },
              color: '#6b7280',
            },
          },
          y: {
            min: 0,
            max,
            ticks: {
              stepSize,
              font: { size: 10, family: 'Inter, system-ui, sans-serif' },
              color: '#6b7280',
              callback: (value) => `$${Math.round(Number(value) / 1000)}k`,
            },
            grid: {
              color: '#e8ecec',
              tickBorderDash: [3, 3],
            },
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly memberStatusChartData = computed((): ChartData<'doughnut'> | null => {
    const chart = this.memberStatus();
    if (!chart || chart.segments.length === 0) {
      return null;
    }

    return {
      labels: chart.segments.map((segment) => segment.name),
      datasets: [
        {
          data: chart.segments.map((segment) => segment.value),
          backgroundColor: chart.segments.map((segment) => segment.color),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  });

  protected readonly memberStatusChartOptions = computed(
    (): ChartConfiguration<'doughnut'>['options'] => {
      const chart = this.memberStatus();
      const values = chart?.segments.map((segment) => segment.value) ?? [];

      return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 12,
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              color: '#1a1f1e',
              generateLabels: (instance) => {
                const data = instance.data;
                const labels = data.labels ?? [];
                const dataset = data.datasets[0];
                const colors = Array.isArray(dataset.backgroundColor)
                  ? dataset.backgroundColor
                  : [];

                return labels.map((label, index) => {
                  const value = values[index] ?? Number(dataset.data[index] ?? 0);
                  const fillStyle =
                    typeof colors[index] === 'string' ? colors[index] : '#004A49';

                  return {
                    text: `${String(label)}  ${value}`,
                    fillStyle,
                    strokeStyle: fillStyle,
                    lineWidth: 0,
                    hidden: false,
                    index,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'doughnut'>) => {
                const label = item.label ?? '';
                const value = typeof item.raw === 'number' ? item.raw : Number(item.raw);
                return `${label}: ${value}`;
              },
            },
          },
        },
      };
    },
  );

  protected readonly commerceChartData = computed((): ChartData<'bar'> | null => {
    const chart = this.benefitsByCommerce();
    if (!chart || chart.items.length === 0) {
      return null;
    }

    return {
      labels: chart.items.map((item) => item.name),
      datasets: [
        {
          label: chart.title,
          data: chart.items.map((item) => item.value),
          backgroundColor: '#004A49',
          borderWidth: 0,
          borderRadius: 3,
          maxBarThickness: 12,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
        },
      ],
    };
  });

  protected readonly commerceChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const chart = this.benefitsByCommerce();
      const scale = chart?.scale ?? [0, 60, 120, 180, 240];
      const max = Math.max(...scale, 0);

      return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'bar'>) => {
                const value = typeof item.raw === 'number' ? item.raw : Number(item.raw);
                return `${item.label}: ${value}`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max,
            ticks: {
              stepSize: scale.length > 1 ? scale[1] - scale[0] : 60,
              font: { size: 10, family: 'Inter, system-ui, sans-serif' },
              color: '#6b7280',
            },
            grid: {
              color: '#e8ecec',
              tickBorderDash: [3, 3],
            },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              color: '#1a1f1e',
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
          this.stats.set(null);
        }),
        switchMap(() =>
          this.dashboardService.getAdminStats().pipe(
            catchError(() => {
              this.viewState.set('error');
              this.notifications.error('No se pudo cargar el dashboard');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((stats) => {
        const isEmpty =
          stats.summaryCards.length === 0 &&
          stats.financialCards.length === 0 &&
          stats.monthlyCollections.labels.length === 0 &&
          stats.memberStatus.segments.length === 0 &&
          stats.benefitsByCommerce.items.length === 0;

        this.stats.set(stats);
        this.viewState.set(isEmpty ? 'empty' : 'success');
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected formatCardValue(card: DashboardMetricCard): string {
    return this.formatValue(card.value, card.valueFormat);
  }

  protected trendIcon(direction: TrendDirection): string {
    if (direction === 'increase') {
      return 'trending_up';
    }
    if (direction === 'decrease') {
      return 'trending_down';
    }
    return '';
  }

  private formatValue(value: number, format: DashboardValueFormat): string {
    const numberPart = new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 0,
    }).format(value);

    if (format === 'currency') {
      return `$${numberPart}`;
    }

    return numberPart;
  }
}
