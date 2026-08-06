import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AppBadge, AppButton, AppIcon, AppLoading, AppModal } from '../../../../shared/components';
import {
  AdminMemberDetail,
  SocioEstado,
} from '../../../../core/interfaces/admin-socio.interface';
import { CuotaEstado } from '../../../../core/interfaces/admin-cuota.interface';
import { cuotaEstadoBadge } from '../../../../core/mappers/admin-cuota.mapper';
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

@Component({
  selector: 'app-member-detail-modal',
  standalone: true,
  imports: [AppModal, AppBadge, AppLoading, AppButton, AppIcon],
  templateUrl: './member-detail-modal.html',
  styleUrl: './member-detail-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDetailModal {
  readonly open = input(false);
  readonly member = input<AdminMemberDetail | null>(null);
  readonly loading = input(false);
  readonly statusBusy = input(false);

  readonly close = output<void>();
  readonly edit = output<AdminMemberDetail>();
  readonly changeStatus = output<{ member: AdminMemberDetail; nuevoEstado: SocioEstado }>();

  protected readonly initials = computed(() => {
    const member = this.member();
    return member ? initialsFromName(member.fullName) : '';
  });

  protected readonly personalFields = computed<DetailField[]>(() => {
    const member = this.member();
    if (!member) {
      return [];
    }

    if (member.personType === 'JURIDICA') {
      return [
        { label: 'Tipo de persona', value: 'Persona jurídica' },
        { label: 'CUIT', value: this.valueOrPlaceholder(member.cuit) },
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
        {
          label: 'Responsable',
          value: this.valueOrPlaceholder(member.responsableName),
        },
        {
          label: 'DNI responsable',
          value: this.valueOrPlaceholder(member.responsableDocument),
        },
        {
          label: 'Alta',
          value: member.joinDate ? formatMemberDate(member.joinDate) : NOT_PROVIDED,
        },
        {
          label: 'Solicitud origen',
          value: this.valueOrPlaceholder(member.originRequestNumber),
        },
      ];
    }

    return [
      { label: 'Tipo de persona', value: 'Persona física' },
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
      {
        label: 'Alta',
        value: member.joinDate ? formatMemberDate(member.joinDate) : NOT_PROVIDED,
      },
      {
        label: 'Solicitud origen',
        value: this.valueOrPlaceholder(member.originRequestNumber),
      },
    ];
  });

  protected readonly accountState = computed(() => this.member()?.accountState ?? null);

  protected readonly socioCategoryBadge = socioCategoryBadge;
  protected readonly socioCategoryLabel = socioCategoryLabel;
  protected readonly socioEstadoBadge = socioEstadoBadge;
  protected readonly socioEstadoLabel = socioEstadoLabel;
  protected readonly cuotaEstadoBadge = (estado: string) =>
    cuotaEstadoBadge(estado as CuotaEstado);

  protected onClose(): void {
    this.close.emit();
  }

  protected onEdit(): void {
    const member = this.member();
    if (!member || this.loading()) {
      return;
    }
    this.edit.emit(member);
  }

  protected onChangeStatus(nuevoEstado: SocioEstado): void {
    const member = this.member();
    if (!member || this.loading() || this.statusBusy()) {
      return;
    }
    if (member.membershipStatus === nuevoEstado) {
      return;
    }
    this.changeStatus.emit({ member, nuevoEstado });
  }

  private valueOrPlaceholder(value: string | null | undefined): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || trimmed === NOT_PROVIDED) {
      return NOT_PROVIDED;
    }
    return trimmed;
  }
}
