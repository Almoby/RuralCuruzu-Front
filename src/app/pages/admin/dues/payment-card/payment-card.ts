import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AppBadge, AppButton, AppIcon } from '../../../../shared/components';
import { AdminCuotaListItem } from '../../../../core/interfaces/admin-cuota.interface';
import { canRegisterPayment } from '../../../../core/mappers/admin-cuota.mapper';
import { formatPeriodLabel } from '../../../../shared/utils';

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [AppBadge, AppIcon, AppButton],
  templateUrl: './payment-card.html',
  styleUrl: './payment-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCard {
  readonly payment = input.required<AdminCuotaListItem>();
  readonly busy = input(false);

  readonly openDetail = output<AdminCuotaListItem>();
  readonly approve = output<AdminCuotaListItem>();
  readonly reject = output<AdminCuotaListItem>();
  readonly registerPayment = output<AdminCuotaListItem>();

  protected readonly methodIcon = computed(() => this.payment().paymentMethodIcon);
  protected readonly methodLabel = computed(() => this.payment().paymentMethodLabel);
  protected readonly periodLabel = computed(() => {
    const period = this.payment().period;
    if (!period) {
      return 'Sin datos';
    }
    return formatPeriodLabel(period);
  });
  protected readonly amountLabel = computed(() => this.payment().amountLabel);
  protected readonly dateLabel = computed(() => this.payment().dateLabel);
  protected readonly statusBadge = computed(() => this.payment().estadoBadge);
  protected readonly statusLabel = computed(() => this.payment().estadoLabel);
  protected readonly canReview = computed(() => this.payment().canReview);
  protected readonly canRegister = computed(() => canRegisterPayment(this.payment()));

  protected onOpenDetail(): void {
    this.openDetail.emit(this.payment());
  }

  protected onApprove(event: Event): void {
    event.stopPropagation();
    this.approve.emit(this.payment());
  }

  protected onReject(event: Event): void {
    event.stopPropagation();
    this.reject.emit(this.payment());
  }

  protected onRegisterPayment(event: Event): void {
    event.stopPropagation();
    this.registerPayment.emit(this.payment());
  }
}
