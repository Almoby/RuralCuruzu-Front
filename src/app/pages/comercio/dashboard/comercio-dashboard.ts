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
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { ComercioDashboardStats } from '../../../core/interfaces/dashboard.interface';
import { Promotion } from '../../../core/interfaces/promotion.interface';
import { PromotionStatus } from '../../../shared/enums';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { APP_ROUTES } from '../../../core/constants/routes.constant';

@Component({
  selector: 'app-comercio-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppBadge,
    AppButton,
    AppLoading,
  ],
  templateUrl: './comercio-dashboard.html',
  styleUrl: './comercio-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioDashboard {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly promotionService = inject(PromotionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly routes = APP_ROUTES;
  readonly loading = signal(true);
  readonly stats = signal<ComercioDashboardStats | null>(null);
  readonly promotions = signal<Promotion[]>([]);

  readonly merchantName = computed(
    () => this.stats()?.merchantName ?? this.auth.currentUser()?.fullName ?? 'Comercio',
  );
  readonly previewPromotions = computed(() => this.promotions().slice(0, 3));
  readonly weekUsages = computed(() => {
    const trend = this.stats()?.validationsTrend ?? [];
    return trend.reduce((acc, point) => acc + point.value, 0);
  });

  constructor() {
    const merchantId = this.auth.currentUser()?.merchantId;

    forkJoin({
      stats: this.dashboardService.getComercioStats(),
      promotions: this.promotionService.list(merchantId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, promotions }) => {
          this.stats.set(stats);
          this.promotions.set(
            promotions.filter((promo) => promo.status === PromotionStatus.Activa),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  statusVariant(status: PromotionStatus): 'success' | 'warning' | 'neutral' {
    switch (status) {
      case PromotionStatus.Activa:
        return 'success';
      case PromotionStatus.Vencida:
        return 'warning';
      default:
        return 'neutral';
    }
  }

  goToValidateQr(): void {
    void this.router.navigateByUrl('/' + APP_ROUTES.comercio.validateQr);
  }
}
