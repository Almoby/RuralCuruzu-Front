import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BenefitService } from '../../../core/services/benefit.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { FeeService } from '../../../core/services/fee.service';
import { RedemptionService } from '../../../core/services/redemption.service';
import { Benefit } from '../../../core/interfaces/benefit.interface';
import { SocioDashboardStats } from '../../../core/interfaces/dashboard.interface';
import { FeePayment } from '../../../core/interfaces/fee.interface';
import { Redemption } from '../../../core/interfaces/redemption.interface';
import { PaymentStatus } from '../../../shared/enums';
import {
  AppBadge,
  AppCard,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { CurrencyArsPipe, DateEsPipe } from '../../../shared/pipes';
import { APP_ROUTES } from '../../../core/constants/routes.constant';

@Component({
  selector: 'app-socio-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AppPageHeader,
    AppStatCard,
    AppCard,
    AppBadge,
    AppLoading,
    CurrencyArsPipe,
    DateEsPipe,
  ],
  templateUrl: './socio-dashboard.html',
  styleUrl: './socio-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioDashboard {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly benefitService = inject(BenefitService);
  private readonly feeService = inject(FeeService);
  private readonly redemptionService = inject(RedemptionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly routes = APP_ROUTES;
  readonly loading = signal(true);
  readonly stats = signal<SocioDashboardStats | null>(null);
  readonly benefits = signal<Benefit[]>([]);
  readonly recentRedemptions = signal<Redemption[]>([]);
  readonly paidFeesCount = signal(0);

  readonly user = this.auth.currentUser;
  readonly memberCode = computed(() => this.user()?.memberCode ?? '—');
  readonly greetingName = computed(() => this.user()?.fullName ?? 'Socio');
  readonly feeUpToDate = computed(() => {
    const label = this.stats()?.feeStatusLabel?.toLowerCase() ?? '';
    return label.includes('día') || label.includes('dia');
  });
  readonly previewBenefits = computed(() => this.benefits().slice(0, 3));

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const code = this.user()?.memberCode;

    forkJoin({
      stats: this.dashboardService.getSocioStats(),
      benefits: this.benefitService.listForSocio(true),
      fees: this.feeService.list(),
      redemptions: this.redemptionService.history(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, benefits, fees, redemptions }) => {
          this.stats.set(stats);
          this.benefits.set(benefits);

          const memberFees = code
            ? fees.filter((fee) => fee.memberCode === code)
            : ([] as FeePayment[]);
          this.paidFeesCount.set(
            memberFees.filter((fee) => fee.status === PaymentStatus.Aprobado).length,
          );

          const memberReds = code
            ? redemptions.filter((item) => item.memberCode === code)
            : ([] as Redemption[]);
          this.recentRedemptions.set(
            [...memberReds]
              .sort(
                (a, b) =>
                  new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime(),
              )
              .slice(0, 4),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
