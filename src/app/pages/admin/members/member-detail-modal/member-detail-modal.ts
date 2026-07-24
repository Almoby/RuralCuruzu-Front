import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AppBadge, AppLoading, AppModal } from '../../../../shared/components';
import { MemberDetail } from '../../../../core/interfaces/member.interface';
import {
  feeStatusBadge,
  feeStatusLabel,
  formatMemberDate,
  formatMemberFee,
  initialsFromName,
  memberPlanBadge,
} from '../../utils/admin-labels';

interface DetailField {
  label: string;
  value: string;
}

@Component({
  selector: 'app-member-detail-modal',
  standalone: true,
  imports: [AppModal, AppBadge, AppLoading],
  templateUrl: './member-detail-modal.html',
  styleUrl: './member-detail-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDetailModal {
  readonly open = input(false);
  readonly member = input<MemberDetail | null>(null);
  readonly loading = input(false);

  readonly close = output<void>();

  protected readonly initials = computed(() => {
    const member = this.member();
    return member ? initialsFromName(member.fullName) : '';
  });

  protected readonly personalFields = computed<DetailField[]>(() => {
    const member = this.member();
    if (!member) {
      return [];
    }

    return [
      { label: 'DNI', value: member.documentNumber },
      { label: 'Nacimiento', value: formatMemberDate(member.birthDate) },
      { label: 'Teléfono', value: member.phone },
      { label: 'Email', value: member.email },
      { label: 'Dirección', value: member.address ?? '—' },
      { label: 'Alta', value: formatMemberDate(member.joinDate) },
    ];
  });

  protected readonly accountRows = computed(() => {
    const member = this.member();
    if (!member) {
      return [];
    }

    const account = member.account;
    return [
      {
        label: 'Cuota mensual',
        value: formatMemberFee(account.monthlyFee),
        emphasis: false,
      },
      {
        label: 'Próx. vencimiento',
        value: formatMemberDate(account.nextDueDate),
        emphasis: false,
      },
      {
        label: 'Deuda acumulada',
        value: formatMemberFee(account.pendingAmount),
        emphasis: account.pendingAmount === 0,
      },
      {
        label: 'Último pago',
        value: formatMemberDate(account.lastPaymentDate),
        emphasis: false,
      },
    ];
  });

  protected readonly memberPlanBadge = memberPlanBadge;
  protected readonly feeStatusBadge = feeStatusBadge;
  protected readonly feeStatusLabel = feeStatusLabel;

  protected onClose(): void {
    this.close.emit();
  }
}
