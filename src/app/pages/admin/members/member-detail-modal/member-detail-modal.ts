import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AppBadge, AppLoading, AppModal } from '../../../../shared/components';
import { AdminMemberDetail } from '../../../../core/interfaces/admin-socio.interface';
import { formatMemberDate, initialsFromName } from '../../utils/admin-labels';
import {
  socioCategoryBadge,
  socioCategoryLabel,
  socioEstadoBadge,
  socioEstadoLabel,
} from '../../utils/socio-estado';

interface DetailField {
  label: string;
  value: string;
}

const NOT_PROVIDED = 'No informado';
const NO_DATA = 'Sin datos';

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
  readonly member = input<AdminMemberDetail | null>(null);
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

    const fields: DetailField[] = [
      {
        label: 'Tipo de persona',
        value:
          member.personType === 'FISICA'
            ? 'Persona física'
            : member.personType === 'JURIDICA'
              ? 'Persona jurídica'
              : NOT_PROVIDED,
      },
      { label: 'DNI', value: this.valueOrPlaceholder(member.documentNumber) },
      {
        label: 'Nacimiento',
        value: member.birthDate ? formatMemberDate(member.birthDate) : NOT_PROVIDED,
      },
      { label: 'CUIT / CUIL', value: this.valueOrPlaceholder(member.cuit) },
      { label: 'Teléfono', value: this.valueOrPlaceholder(member.phone) },
      { label: 'Email', value: this.valueOrPlaceholder(member.email) },
      { label: 'Dirección', value: this.valueOrPlaceholder(member.address) },
      {
        label: 'Portal / Piso / Depto',
        value: this.valueOrPlaceholder(member.portalFloor),
      },
      {
        label: 'Establecimiento',
        value: this.valueOrPlaceholder(member.establishmentName),
      },
      {
        label: 'Dirección establecimiento',
        value: this.valueOrPlaceholder(member.establishmentAddress),
      },
    ];

    if (member.personType === 'JURIDICA') {
      fields.push(
        {
          label: 'Responsable',
          value: this.valueOrPlaceholder(member.responsableName),
        },
        {
          label: 'DNI responsable',
          value: this.valueOrPlaceholder(member.responsableDocument),
        },
      );
    }

    fields.push(
      {
        label: 'Alta',
        value: member.joinDate ? formatMemberDate(member.joinDate) : NOT_PROVIDED,
      },
      {
        label: 'Solicitud origen',
        value: this.valueOrPlaceholder(member.originRequestNumber),
      },
    );

    return fields;
  });

  protected readonly accountRows = computed(() => {
    const member = this.member();
    if (!member) {
      return [];
    }

    return [
      {
        label: 'Estado de membresía',
        value: socioEstadoLabel(member.membershipStatus),
        emphasis: member.membershipStatus === 'ACTIVO',
      },
      {
        label: 'Cuota mensual',
        value: member.monthlyFeeLabel || NO_DATA,
        emphasis: false,
      },
      {
        label: 'Próx. vencimiento',
        value: member.nextDueDateLabel || NO_DATA,
        emphasis: false,
      },
      {
        label: 'Estado de cuota',
        value: member.feeStatusLabel || NO_DATA,
        emphasis: false,
      },
    ];
  });

  protected readonly socioCategoryBadge = socioCategoryBadge;
  protected readonly socioCategoryLabel = socioCategoryLabel;
  protected readonly socioEstadoBadge = socioEstadoBadge;
  protected readonly socioEstadoLabel = socioEstadoLabel;

  protected onClose(): void {
    this.close.emit();
  }

  private valueOrPlaceholder(value: string | null | undefined): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || trimmed === NOT_PROVIDED) {
      return NOT_PROVIDED;
    }
    return trimmed;
  }
}
