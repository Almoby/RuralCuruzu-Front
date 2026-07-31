import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { FeeService } from '../../../core/services/fee.service';
import { RedemptionService } from '../../../core/services/redemption.service';
import { FeePayment } from '../../../core/interfaces/fee.interface';
import { Redemption } from '../../../core/interfaces/redemption.interface';
import { PaymentStatus } from '../../../shared/enums';
import {
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { CurrencyArsPipe } from '../../../shared/pipes';
import { formatFeePeriodTitle } from '../../../shared/utils';

type HistoryTab = 'benefits' | 'payments';

@Component({
  selector: 'app-socio-history',
  standalone: true,
  imports: [
    AppPageHeader,
    AppStatCard,
    AppLoading,
    AppEmptyState,
    AppIcon,
    CurrencyArsPipe,
    DatePipe,
  ],
  templateUrl: './socio-history.html',
  styleUrl: './socio-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioHistory {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly feeService = inject(FeeService);
  private readonly redemptionService = inject(RedemptionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly tab = signal<HistoryTab>('benefits');
  readonly savings = signal(0);
  readonly redemptions = signal<Redemption[]>([]);
  readonly fees = signal<FeePayment[]>([]);

  readonly usedBenefitsCount = computed(() => this.redemptions().length);
  readonly paymentsCount = computed(
    () => this.fees().filter((fee) => fee.status === PaymentStatus.Aprobado).length,
  );

  constructor() {
    const code = this.auth.currentUser()?.memberCode;

    forkJoin({
      stats: this.dashboardService.getSocioStats(),
      fees: this.feeService.list(),
      redemptions: this.redemptionService.history(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, fees, redemptions }) => {
          this.savings.set(stats.savingsEstimate);
          this.fees.set(
            (code ? fees.filter((fee) => fee.memberCode === code) : fees).sort(
              (a, b) => b.period.localeCompare(a.period),
            ),
          );
          this.redemptions.set(
            (code
              ? redemptions.filter((item) => item.memberCode === code)
              : redemptions
            ).sort(
              (a, b) =>
                new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime(),
            ),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setTab(tab: HistoryTab): void {
    this.tab.set(tab);
  }

  feeTitle(period: string): string {
    return formatFeePeriodTitle(period);
  }

  feeBadgeVariant(status: PaymentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case PaymentStatus.Aprobado:
        return 'success';
      case PaymentStatus.Pendiente:
        return 'warning';
      case PaymentStatus.Rechazado:
        return 'danger';
      default:
        return 'neutral';
    }
  }

  feeStatusLabel(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.Aprobado:
        return 'Al día';
      case PaymentStatus.Pendiente:
        return 'Pendiente';
      case PaymentStatus.Rechazado:
        return 'Rechazado';
      default:
        return status;
    }
  }
}
