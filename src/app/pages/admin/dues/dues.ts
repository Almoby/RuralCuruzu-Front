import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, take } from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { FeeService } from '../../../core/services/fee.service';
import { MemberService } from '../../../core/services/member.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  FeePeriodOption,
  PaymentFilter,
  PaymentRecord,
  PaymentSummary,
  RegisterPaymentRequest,
} from '../../../core/interfaces/fee.interface';
import { Member } from '../../../core/interfaces/member.interface';
import { PaymentStatus } from '../../../shared/enums';
import { formatMemberFee, currentPeriod } from '../utils/admin-labels';
import { PaymentCard } from './payment-card/payment-card';
import { RegisterPaymentModal } from './register-payment-modal/register-payment-modal';

type DuesViewState = 'loading' | 'success' | 'empty' | 'error';

interface FilterTab {
  value: PaymentFilter;
  label: string;
  count: number;
}

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  tone: 'success' | 'warning' | 'primary';
}

@Component({
  selector: 'app-dues',
  standalone: true,
  imports: [
    AppPageHeader,
    AppButton,
    AppIcon,
    AppLoading,
    AppEmptyState,
    AppAlert,
    PaymentCard,
    RegisterPaymentModal,
  ],
  templateUrl: './dues.html',
  styleUrl: './dues.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuesPage {
  private readonly feeService = inject(FeeService);
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly payments = signal<PaymentRecord[]>([]);
  protected readonly members = signal<Member[]>([]);
  protected readonly periodOptions = signal<FeePeriodOption[]>([]);
  protected readonly summary = signal<PaymentSummary | null>(null);
  protected readonly filter = signal<PaymentFilter>('all');
  protected readonly paymentModalOpen = signal(false);

  protected readonly filterTabs = computed<FilterTab[]>(() => {
    const summary = this.summary();
    return [
      { value: 'all', label: 'Todos', count: summary?.totalCount ?? 0 },
      { value: 'pending', label: 'Pendientes', count: summary?.pendingCount ?? 0 },
      { value: 'approved', label: 'Aprobados', count: summary?.approvedCount ?? 0 },
      { value: 'rejected', label: 'Rechazados', count: summary?.rejectedCount ?? 0 },
    ];
  });

  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const summary = this.summary();
    return [
      {
        label: 'Total cobrado',
        value: formatMemberFee(summary?.collectedAmount ?? 0),
        icon: 'banknote',
        tone: 'success',
      },
      {
        label: 'En revisión',
        value: formatMemberFee(summary?.inReviewAmount ?? 0),
        icon: 'clock',
        tone: 'warning',
      },
      {
        label: 'Cobrado en efectivo',
        value: formatMemberFee(summary?.cashCollectedAmount ?? 0),
        icon: 'check_circle',
        tone: 'primary',
      },
    ];
  });

  protected readonly filteredPayments = computed(() => {
    const filter = this.filter();
    const items = this.payments();
    if (filter === 'pending') {
      return items.filter((item) => item.status === PaymentStatus.Pendiente);
    }
    if (filter === 'approved') {
      return items.filter((item) => item.status === PaymentStatus.Aprobado);
    }
    if (filter === 'rejected') {
      return items.filter((item) => item.status === PaymentStatus.Rechazado);
    }
    return items;
  });

  protected readonly viewState = computed<DuesViewState>(() => {
    if (this.loading()) {
      return 'loading';
    }
    if (this.loadError()) {
      return 'error';
    }
    if (this.filteredPayments().length === 0) {
      return 'empty';
    }
    return 'success';
  });

  constructor() {
    this.load();
  }

  protected setFilter(filter: PaymentFilter): void {
    this.filter.set(filter);
  }

  protected openPaymentModal(): void {
    this.paymentModalOpen.set(true);
  }

  protected closePaymentModal(): void {
    this.paymentModalOpen.set(false);
  }

  protected retry(): void {
    this.load();
  }

  protected generateFees(): void {
    this.submitting.set(true);
    this.feeService
      .generateFees(currentPeriod())
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (generated) => {
          this.notifications.success(
            generated.length > 0
              ? `Se generaron ${generated.length} cuotas`
              : 'No hay cuotas nuevas para generar',
          );
          this.load();
        },
        error: () => {
          this.notifications.error('No se pudieron generar las cuotas');
        },
      });
  }

  protected registerPayment(payload: RegisterPaymentRequest): void {
    this.submitting.set(true);
    this.feeService
      .registerPayment(payload)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closePaymentModal();
          this.notifications.success('Pago registrado y marcado como abonado');
          this.load();
        },
        error: () => {
          this.notifications.error('No se pudo registrar el pago');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);

    // BehaviorSubject streams never complete; take(1) so forkJoin can finish.
    forkJoin({
      payments: this.feeService.getPayments(),
      summary: this.feeService.getPaymentSummary(),
      members: this.memberService.getMembers().pipe(take(1)),
      periods: this.feeService.getPeriodOptions(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ payments, summary, members, periods }) => {
          this.payments.set(payments);
          this.summary.set(summary);
          this.members.set(members.filter((member) => member.isActive));
          this.periodOptions.set(periods);
        },
        error: () => {
          this.loadError.set(true);
          this.notifications.error('No se pudieron cargar las cuotas');
        },
      });
  }
}
