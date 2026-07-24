import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { RedemptionService } from '../../../core/services/redemption.service';
import { ComercioDashboardStats } from '../../../core/interfaces/dashboard.interface';
import { Redemption } from '../../../core/interfaces/redemption.interface';
import {
  AppBadge,
  AppCard,
  AppEmptyState,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { DateEsPipe } from '../../../shared/pipes';

interface PromoBar {
  name: string;
  value: number;
  percent: number;
}

@Component({
  selector: 'app-comercio-statistics',
  standalone: true,
  imports: [
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppBadge,
    AppLoading,
    AppEmptyState,
    DateEsPipe,
  ],
  templateUrl: './comercio-statistics.html',
  styleUrl: './comercio-statistics.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioStatistics {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly redemptionService = inject(RedemptionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly stats = signal<ComercioDashboardStats | null>(null);
  readonly redemptions = signal<Redemption[]>([]);

  readonly totalUsages = computed(() => {
    const month = this.stats()?.validationsMonth ?? 0;
    const historical = this.redemptions().filter((item) => item.status === 'Exitosa').length;
    return Math.max(month, historical);
  });

  readonly uniqueMembers = computed(() => this.stats()?.uniqueMembersMonth ?? 0);

  readonly promoBars = computed<PromoBar[]>(() => {
    const items = this.stats()?.topPromotions ?? [];
    const max = Math.max(...items.map((item) => item.value), 1);
    return items.map((item) => ({
      name: item.name,
      value: item.value,
      percent: Math.round((item.value / max) * 100),
    }));
  });

  readonly recentConsumptions = computed(() =>
    [...this.redemptions()]
      .sort(
        (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime(),
      )
      .slice(0, 8),
  );

  constructor() {
    const merchantId = this.auth.currentUser()?.merchantId;

    forkJoin({
      stats: this.dashboardService.getComercioStats(),
      redemptions: this.redemptionService.history(
        merchantId ? { merchantId } : undefined,
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, redemptions }) => {
          this.stats.set(stats);
          this.redemptions.set(redemptions);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
