import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AppBadge,
  AppButton,
  AppIcon,
  AppModal,
  AppTextarea,
} from '../../../../shared/components';
import { MembershipRequest } from '../../../../core/interfaces/member-request.interface';
import { RequestStatus } from '../../../../shared/enums';
import {
  categoryBadge,
  membershipTypeLabel,
  requestStatusBadge,
} from '../../utils/admin-labels';

export type RequestDetailMode = 'review' | 'view';

interface DetailField {
  id: string;
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-request-detail-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppModal,
    AppButton,
    AppTextarea,
    AppBadge,
    AppIcon,
  ],
  templateUrl: './request-detail-modal.html',
  styleUrl: './request-detail-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailModal {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly request = input<MembershipRequest | null>(null);
  /** `review` shows note + approve/reject; `view` is read-only detail. */
  readonly mode = input<RequestDetailMode>('view');
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly approve = output<string>();
  readonly reject = output<string>();

  protected readonly RequestStatus = RequestStatus;
  protected readonly noteControl = this.fb.nonNullable.control('');
  protected readonly categoryBadge = categoryBadge;
  protected readonly requestStatusBadge = requestStatusBadge;
  protected readonly membershipTypeLabel = membershipTypeLabel;

  protected readonly isPending = computed(
    () => this.request()?.status === RequestStatus.Pendiente && this.mode() === 'review',
  );

  protected readonly modalSubtitle = computed(() => {
    const item = this.request();
    if (!item) {
      return '';
    }
    return `Recibida el ${this.formatDate(item.submittedAt)}`;
  });

  protected readonly detailFields = computed((): DetailField[] => {
    const item = this.request();
    if (!item) {
      return [];
    }

    const fields: DetailField[] = [
      {
        id: 'fullName',
        label: 'Apellido y Nombre / Razón Social',
        value: item.fullName,
        icon: 'user',
      },
      {
        id: 'birthDate',
        label: 'Fecha de Nacimiento',
        value: item.birthDate ? this.formatDate(item.birthDate) : '—',
        icon: 'calendar',
      },
      {
        id: 'document',
        label: 'D.N.I. / C.I. / L.E.',
        value: item.documentNumber,
        icon: 'user',
      },
      {
        id: 'cuit',
        label: 'CUIT N°',
        value: item.cuit ?? '—',
        icon: 'analytics',
      },
      {
        id: 'email',
        label: 'Email',
        value: item.email,
        icon: 'mail',
      },
      {
        id: 'phone',
        label: 'Teléfono',
        value: item.phone,
        icon: 'phone',
      },
      {
        id: 'address',
        label: 'Dirección Postal',
        value: item.address ?? '—',
        icon: 'home',
      },
    ];

    if (item.establishmentName || item.establishmentAddress) {
      fields.push(
        {
          id: 'establishment',
          label: 'Establecimiento',
          value: item.establishmentName ?? '—',
          icon: 'storefront',
        },
        {
          id: 'establishmentAddress',
          label: 'Dirección Estab.',
          value: item.establishmentAddress ?? '—',
          icon: 'home',
        },
      );
    }

    return fields;
  });

  constructor() {
    effect(() => {
      const current = this.request();
      if (current) {
        this.noteControl.setValue(current.notes ?? '');
        if (current.status !== RequestStatus.Pendiente) {
          this.noteControl.disable({ emitEvent: false });
        } else {
          this.noteControl.enable({ emitEvent: false });
        }
      } else {
        this.noteControl.reset('');
        this.noteControl.enable({ emitEvent: false });
      }
    });
  }

  protected statusIcon(status: RequestStatus): string {
    if (status === RequestStatus.Pendiente) {
      return 'clock';
    }
    if (status === RequestStatus.Aprobada) {
      return 'check_circle';
    }
    return 'x_circle';
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected onApprove(): void {
    this.approve.emit(this.noteControl.value.trim());
  }

  protected onReject(): void {
    this.reject.emit(this.noteControl.value.trim());
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(date);
  }
}
