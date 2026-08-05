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
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { UserIdentityService } from '../../../core/services/user-identity.service';
import {
  ComercioInicioFeaturedPromotion,
  ComercioInicioViewModel,
} from '../../../core/interfaces/comercio-inicio.interface';
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

type ComercioHomeViewState = 'loading' | 'success' | 'error';

function computeYAxisMax(values: number[]): number {
  const peak = values.reduce((max, value) => Math.max(max, value), 0);
  if (peak <= 0) {
    return 4;
  }
  if (peak <= 8) {
    return 8;
  }
  if (peak <= 32) {
    return Math.ceil(peak / 8) * 8;
  }
  const rough = Math.ceil(peak / 4) * 4;
  return rough;
}

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
  private readonly userIdentity = inject(UserIdentityService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  readonly routes = APP_ROUTES;
  readonly viewState = signal<ComercioHomeViewState>('loading');
  readonly stats = signal<ComercioInicioViewModel | null>(null);

  /**
   * Commercial name: dashboard/beneficios → session → identity chrome → fallback.
   * Never uses merchantId / refId.
   */
  readonly merchantName = computed(() => {
    const fromApi = this.stats()?.merchantName?.trim();
    if (fromApi) {
      return fromApi;
    }
    const sessionName =
      this.auth.currentUser()?.merchantName?.trim() ||
      this.auth.currentUser()?.fullName?.trim() ||
      this.auth.session()?.displayName?.trim();
    if (sessionName) {
      return sessionName;
    }
    const identity = this.userIdentity.sidebarIdentityLabel()?.trim();
    return identity || 'Comercio';
  });

  readonly featuredPromotion = computed(
    (): ComercioInicioFeaturedPromotion | null =>
      this.stats()?.featuredPromotion ?? null,
  );

  readonly usesThisMonth = computed(() => this.stats()?.usesThisMonth ?? 0);

  readonly activePromotions = computed(() => this.stats()?.activePromotions ?? 0);

  readonly reachedMembers = computed(() => this.stats()?.reachedMembers ?? 0);

  readonly validationsToday = computed(() => this.stats()?.validationsToday ?? 0);

  readonly weeklyChartData = computed((): ChartData<'bar'> | null => {
    const trend = this.stats()?.weeklyTrend ?? [];
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
    (): ChartConfiguration<'bar'>['options'] => {
      const values = (this.stats()?.weeklyTrend ?? []).map((point) => point.value);
      const yMax = computeYAxisMax(values);
      const stepSize = yMax <= 8 ? 2 : yMax / 4;

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
            beginAtZero: true,
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
            border: { display: false, dash: [4, 4] },
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
          this.dashboardService.getComercioDashboard().pipe(
            catchError(() => {
              this.stats.set(null);
              this.viewState.set('error');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((view) => {
        this.stats.set(view);
        this.viewState.set('success');
      });
  }

  retry(): void {
    this.reload$.next();
  }

  goToValidateQr(): void {
    void this.router.navigateByUrl('/' + APP_ROUTES.comercio.validateQr);
  }
}
