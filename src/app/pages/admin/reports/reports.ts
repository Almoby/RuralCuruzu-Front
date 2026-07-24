import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, TooltipItem } from 'chart.js';
import {
  AppAlert,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { ReportService } from '../../../core/services/report.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportsDashboardResponse } from '../../../core/interfaces/report.interface';
import { initialsFromName } from '../utils/admin-labels';
import {
  CHART_COLORS,
  chartGridStyle,
  chartLegendBottomLabels,
  chartTickStyle,
  currencyTooltipLabel,
  formatChartCurrency,
  formatChartCurrencyShort,
} from '../utils/chart-theme';

type ReportsViewState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    AppPageHeader,
    AppIcon,
    AppLoading,
    AppAlert,
    AppEmptyState,
    BaseChartDirective,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly reportService = inject(ReportService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly exporting = signal(false);
  protected readonly data = signal<ReportsDashboardResponse | null>(null);
  protected readonly selectedMonth = signal('');
  protected readonly monthMenuOpen = signal(false);

  protected readonly viewState = computed<ReportsViewState>(() => {
    if (this.loading()) {
      return 'loading';
    }
    if (this.loadError()) {
      return 'error';
    }
    if (!this.data()) {
      return 'empty';
    }
    return 'success';
  });

  protected readonly title = computed(() => this.data()?.title ?? 'Reportes');
  protected readonly subtitle = computed(
    () => this.data()?.subtitle ?? 'Análisis y estadísticas de la cooperativa',
  );

  protected readonly metrics = computed(() => this.data()?.metrics ?? []);
  protected readonly overdueItems = computed(
    () => this.data()?.overdueMembers.items ?? [],
  );
  protected readonly collectedItems = computed(
    () => this.data()?.monthlyCollectedFees.items ?? [],
  );
  protected readonly topBenefits = computed(() => this.data()?.topBenefits.items ?? []);
  protected readonly monthOptions = computed(
    () => this.data()?.monthlyCollectedFees.monthOptions ?? [],
  );
  protected readonly collectedTitle = computed(
    () => this.data()?.monthlyCollectedFees.title ?? '',
  );
  protected readonly overdueTitle = computed(
    () => this.data()?.overdueMembers.title ?? '',
  );
  protected readonly benefitsTitle = computed(
    () => this.data()?.topBenefits.title ?? '',
  );
  protected readonly commerceTitle = computed(
    () => this.data()?.benefitsByCommerce.title ?? '',
  );
  protected readonly collectionsTitle = computed(
    () => this.data()?.collectionsVsPending.title ?? '',
  );
  protected readonly debtTitle = computed(
    () => this.data()?.debtByMember.title ?? '',
  );

  protected readonly collectionsChartData = computed((): ChartData<'line'> | null => {
    const chart = this.data()?.collectionsVsPending;
    if (!chart || chart.labels.length === 0) {
      return null;
    }

    return {
      labels: chart.labels,
      datasets: chart.series.map((series) => ({
        label: series.name,
        data: series.values,
        borderColor: series.color,
        backgroundColor: series.color,
        pointBackgroundColor: series.color,
        pointBorderColor: CHART_COLORS.white,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        tension: 0.25,
        fill: false,
      })),
    };
  });

  protected readonly collectionsChartOptions = computed(
    (): ChartConfiguration<'line'>['options'] => {
      const chart = this.data()?.collectionsVsPending;
      const max = chart?.yAxisMax ?? 600000;

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: chartLegendBottomLabels,
          },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'line'>) =>
                currencyTooltipLabel(item.raw, item.dataset.label ?? item.label ?? ''),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: chartTickStyle,
            border: { display: false },
          },
          y: {
            min: 0,
            max,
            ticks: {
              ...chartTickStyle,
              stepSize: max / 6,
              callback: (value) => formatChartCurrencyShort(Number(value)),
            },
            grid: chartGridStyle,
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly debtChartData = computed((): ChartData<'bar'> | null => {
    const chart = this.data()?.debtByMember;
    if (!chart || chart.items.length === 0) {
      return null;
    }

    return {
      labels: chart.items.map((item) => item.shortName),
      datasets: [
        {
          label: 'Deuda',
          data: chart.items.map((item) => item.amount),
          backgroundColor: CHART_COLORS.brown,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 42,
          categoryPercentage: 0.55,
          barPercentage: 0.8,
        },
      ],
    };
  });

  protected readonly debtChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const chart = this.data()?.debtByMember;
      const max = chart?.yAxisMax ?? 10000;
      const items = chart?.items ?? [];

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const index = items[0]?.dataIndex ?? 0;
                return items[0] ? (chart?.items[index]?.memberName ?? '') : '';
              },
              label: (item: TooltipItem<'bar'>) => {
                const index = item.dataIndex;
                const member = items[index];
                return currencyTooltipLabel(
                  item.raw,
                  member?.memberName ?? 'Deuda',
                );
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: chartTickStyle.font.family },
              color: CHART_COLORS.text,
            },
            border: { display: false },
          },
          y: {
            min: 0,
            max,
            ticks: {
              ...chartTickStyle,
              stepSize: 2000,
              callback: (value) => formatChartCurrencyShort(Number(value)),
            },
            grid: chartGridStyle,
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly commerceChartData = computed((): ChartData<'bar'> | null => {
    const chart = this.data()?.benefitsByCommerce;
    if (!chart || chart.items.length === 0) {
      return null;
    }

    return {
      labels: chart.items.map((item) => item.name),
      datasets: [
        {
          label: chart.title,
          data: chart.items.map((item) => item.value),
          backgroundColor: CHART_COLORS.primary,
          borderWidth: 0,
          borderRadius: 3,
          maxBarThickness: 14,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
        },
      ],
    };
  });

  protected readonly commerceChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const chart = this.data()?.benefitsByCommerce;
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
              ...chartTickStyle,
            },
            grid: chartGridStyle,
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: chartTickStyle.font.family },
              color: CHART_COLORS.text,
            },
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly initialsFromName = initialsFromName;
  protected readonly formatCurrency = formatChartCurrency;

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected toggleMonthMenu(): void {
    this.monthMenuOpen.update((open) => !open);
  }

  protected selectMonth(month: string): void {
    this.selectedMonth.set(month);
    this.monthMenuOpen.set(false);
  }

  protected exportData(): void {
    this.exporting.set(true);
    this.reportService
      .exportReports()
      .pipe(
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `reportes-rural-curuzu-${new Date().toISOString().slice(0, 10)}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.notifications.success('Reporte exportado');
        },
        error: () => {
          this.notifications.error('No se pudo exportar el reporte');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.reportService
      .getReports()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.data.set(response);
          this.selectedMonth.set(response.monthlyCollectedFees.monthOptions[0] ?? '');
        },
        error: () => {
          this.loadError.set(true);
          this.notifications.error('No se pudieron cargar los reportes');
        },
      });
  }
}
