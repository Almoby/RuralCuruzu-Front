import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FeeService } from '../../../core/services/fee.service';
import { MemberService } from '../../../core/services/member.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FeePayment } from '../../../core/interfaces/fee.interface';
import { PaymentMethod, PaymentStatus } from '../../../shared/enums';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppTextarea,
} from '../../../shared/components';
import { CurrencyArsPipe, DateEsPipe } from '../../../shared/pipes';
import { formatFeePeriodTitle } from '../../../shared/utils';

@Component({
  selector: 'app-socio-payments',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppCard,
    AppBadge,
    AppButton,
    AppModal,
    AppInput,
    AppTextarea,
    AppLoading,
    AppEmptyState,
    CurrencyArsPipe,
    DateEsPipe,
  ],
  templateUrl: './socio-payments.html',
  styleUrl: './socio-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioPayments {
  private readonly auth = inject(AuthService);
  private readonly feeService = inject(FeeService);
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly fees = signal<FeePayment[]>([]);
  readonly memberId = signal<string | null>(null);
  readonly linkModalOpen = signal(false);
  readonly reportModalOpen = signal(false);

  readonly currentFee = computed(() => {
    const list = this.fees();
    return list.length > 0 ? list[0] : null;
  });

  readonly previousFees = computed(() => this.fees().slice(1));

  readonly reportForm = this.fb.nonNullable.group({
    receiptNumber: ['', [Validators.required, Validators.minLength(3)]],
    notes: [''],
  });

  constructor() {
    this.load();
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

  openLinkModal(): void {
    this.linkModalOpen.set(true);
  }

  closeLinkModal(): void {
    this.linkModalOpen.set(false);
  }

  openReportModal(): void {
    this.reportForm.reset({ receiptNumber: '', notes: '' });
    this.reportModalOpen.set(true);
  }

  closeReportModal(): void {
    this.reportModalOpen.set(false);
  }

  submitReport(): void {
    if (this.reportForm.invalid || this.submitting()) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const fee = this.currentFee();
    const memberId = this.memberId();
    if (!fee || !memberId) {
      this.notifications.error('No se pudo identificar la cuota actual.');
      return;
    }

    this.submitting.set(true);
    const { receiptNumber, notes } = this.reportForm.getRawValue();

    this.feeService
      .registerPayment({
        memberId,
        period: fee.period,
        amount: fee.amount,
        paymentMethod: PaymentMethod.Transferencia,
        receiptNumber,
        notes: notes || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.reportModalOpen.set(false);
          this.notifications.success('Pago informado correctamente!');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo informar el pago.');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    const code = this.auth.currentUser()?.memberCode;

    forkJoin({
      fees: this.feeService.list(),
      members: this.memberService.list().pipe(take(1)),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ fees, members }) => {
          const member = members.find((item) => item.memberCode === code);
          this.memberId.set(member?.id ?? null);

          const memberFees = (
            code ? fees.filter((fee) => fee.memberCode === code) : fees
          ).sort((a, b) => b.period.localeCompare(a.period));

          this.fees.set(memberFees);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
