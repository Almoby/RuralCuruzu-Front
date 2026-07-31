import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import {
  ComercioDashboardStats,
  MerchantPromotionSummary,
} from '../../../core/interfaces/dashboard.interface';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import {
  CHART_COLORS,
  CHART_FONT_FAMILY,
  chartGridStyle,
  chartTickStyle,
} from '../../admin/utils/chart-theme';

type ComercioHomeViewState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-comercio-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    BaseChartDirective,
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppBadge,
    AppButton,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppIcon,
  ],
  templateUrl: './comercio-dashboard.html',
  styleUrl: './comercio-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioDashboard {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly routes = APP_ROUTES;
  readonly viewState = signal<ComercioHomeViewState>('loading');
  readonly stats = signal<ComercioDashboardStats | null>(null);

  readonly merchantName = computed(
    () =>
      this.stats()?.merchantName ??
      this.auth.currentUser()?.merchantName ??
      this.auth.currentUser()?.fullName ??
      'Comercio',
  );

  readonly featuredPromotion = computed(
    (): MerchantPromotionSummary | null => this.stats()?.featuredPromotion ?? null,
  );

  readonly usesThisMonth = computed(
    () => this.stats()?.usesThisMonth ?? this.stats()?.validationsMonth ?? 0,
  );

  readonly activePromotions = computed(() => this.stats()?.activePromotions ?? 0);

  readonly reachedMembers = computed(
    () => this.stats()?.reachedMembers ?? this.stats()?.uniqueMembersMonth ?? 0,
  );

  readonly validationsToday = computed(() => this.stats()?.validationsToday ?? 0);

  readonly weeklyChartData = computed((): ChartData<'bar'> | null => {
    const trend = this.stats()?.validationsTrend ?? [];
    if (trend.length === 0) {
      return null;
    }

    return {
      labels: trend.map((point) => point.label),
      datasets: [
        {
          data: trend.map((point) => point.value),
          backgroundColor: CHART_COLORS.primary,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0,
          },
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 40,
        },
      ],
    };
  });

  readonly weeklyChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => ({
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
          beginAtZero: true,
          max: 32,
          ticks: {
            ...chartTickStyle,
            stepSize: 8,
            font: { size: 10, family: CHART_FONT_FAMILY },
          },
          grid: {
            ...chartGridStyle,
            drawTicks: false,
          },
          border: { display: false, dash: [4, 4] },
        },
      },
    }),
  );

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  goToValidateQr(): void {
    void this.router.navigateByUrl('/' + APP_ROUTES.comercio.validateQr);
  }

  private load(): void {
    this.viewState.set('loading');

    this.dashboardService
      .getComercioStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.viewState.set(stats ? 'success' : 'empty');
        },
        error: () => {
          this.stats.set(null);
          this.viewState.set('error');
        },
      });
  }
}
