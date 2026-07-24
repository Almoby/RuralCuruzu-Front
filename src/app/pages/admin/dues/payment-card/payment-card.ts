import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AppBadge, AppIcon } from '../../../../shared/components';
import { PaymentRecord } from '../../../../core/interfaces/fee.interface';
import {
  formatMemberDate,
  formatMemberFee,
  paymentMethodIcon,
  paymentMethodLabel,
  paymentStatusBadge,
  paymentStatusLabel,
} from '../../utils/admin-labels';
import { formatPeriodLabel } from '../../../../shared/utils';

@Component({
  selector: 'app-payment-card',
  standalone: true,
  imports: [AppBadge, AppIcon],
  templateUrl: './payment-card.html',
  styleUrl: './payment-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCard {
  readonly payment = input.required<PaymentRecord>();

  protected readonly methodIcon = computed(() =>
    paymentMethodIcon(this.payment().paymentMethod),
  );

  protected readonly methodLabel = computed(() =>
    paymentMethodLabel(this.payment().paymentMethod),
  );

  protected readonly periodLabel = computed(() => formatPeriodLabel(this.payment().period));

  protected readonly amountLabel = computed(() => formatMemberFee(this.payment().amount));

  protected readonly dateLabel = computed(() => {
    const item = this.payment();
    return formatMemberDate(item.paidAt ?? item.dueDate);
  });

  protected readonly statusBadge = computed(() => paymentStatusBadge(this.payment().status));
  protected readonly statusLabel = computed(() => paymentStatusLabel(this.payment().status));
}
