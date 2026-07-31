import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppIcon,
  AppLoading,
  AppModal,
  AppTextarea,
} from '../../../../shared/components';
import { MembershipRequest } from '../../../../core/interfaces/member-request.interface';
import { RequestStatus } from '../../../../shared/enums';
import {
  categoryBadge,
  membershipTypeLabel,
  requestStatusBadge,
  requestStatusIcon,
  requestStatusLabel,
} from '../../utils/admin-labels';
import {
  SolicitudAdminAction,
  availableSolicitudActions,
} from '../../utils/solicitud-estado';

export type RequestDetailMode = 'review' | 'view';

interface DetailField {
  id: string;
  label: string;
  value: string;
  icon: string;
}

type PendingConfirmAction = Extract<
  SolicitudAdminAction,
  'approve' | 'reject' | 'cancel' | 'pass_to_review' | 'reopen'
>;

const NOT_PROVIDED = 'No informado';
const MOTIVO_REQUIRED_MESSAGE = 'El motivo es obligatorio';

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
    AppLoading,
    AppConfirmDialog,
  ],
  templateUrl: './request-detail-modal.html',
  styleUrl: './request-detail-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly motivoSection = viewChild<ElementRef<HTMLElement>>('motivoSection');

  /** Tracks which solicitud is loaded so field resets only happen on open / change. */
  private boundRequestId: string | null = null;

  readonly open = input(false);
  readonly request = input<MembershipRequest | null>(null);
  /** `review` shows actions; `view` is read-only detail. */
  readonly mode = input<RequestDetailMode>('view');
  readonly submitting = input(false);
  readonly loading = input(false);

  readonly close = output<void>();
  readonly passToReview = output<string>();
  readonly approve = output<string>();
  readonly reject = output<{ motivo: string; observacion: string }>();
  readonly cancelRequest = output<{ motivo: string; observacion: string }>();
  readonly reopen = output<string>();
  readonly observe = output<string>();
  readonly downloadFile = output<string>();

  protected readonly RequestStatus = RequestStatus;
  protected readonly requestStatusLabel = requestStatusLabel;
  protected readonly requestStatusIcon = requestStatusIcon;
  protected readonly categoryBadge = categoryBadge;
  protected readonly requestStatusBadge = requestStatusBadge;
  protected readonly membershipTypeLabel = membershipTypeLabel;

  protected readonly noteControl = this.fb.nonNullable.control('');
  protected readonly motivoControl = this.fb.nonNullable.control('', [
    Validators.required,
  ]);
  protected readonly observacionControl = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.minLength(1),
  ]);

  protected readonly confirmOpen = signal(false);
  protected readonly pendingAction = signal<PendingConfirmAction | null>(null);
  protected readonly motivoError = signal('');
  protected readonly observacionError = signal('');

  protected readonly actions = computed(() => {
    const item = this.request();
    if (!item || this.mode() !== 'review') {
      return [] as SolicitudAdminAction[];
    }
    return availableSolicitudActions(item.status);
  });

  protected readonly canAct = computed(() => this.actions().length > 0);

  protected readonly needsMotivo = computed(() => {
    const actions = this.actions();
    return actions.includes('reject') || actions.includes('cancel');
  });

  protected readonly confirmTitle = computed(() => {
    switch (this.pendingAction()) {
      case 'approve':
        return '¿Aprobar solicitud?';
      case 'reject':
        return '¿Rechazar solicitud?';
      case 'cancel':
        return '¿Cancelar solicitud?';
      case 'pass_to_review':
        return '¿Pasar a revisión?';
      case 'reopen':
        return '¿Reabrir solicitud?';
      default:
        return 'Confirmar acción';
    }
  });

  protected readonly confirmMessage = computed(() => {
    switch (this.pendingAction()) {
      case 'approve':
        return 'Se creará el socio y se enviarán credenciales temporales. Esta acción no se puede deshacer.';
      case 'reject':
        return 'Se notificará al solicitante con el motivo indicado.';
      case 'cancel':
        return 'La solicitud quedará cancelada de forma definitiva.';
      case 'pass_to_review':
        return 'La solicitud pasará al estado En revisión para su evaluación.';
      case 'reopen':
        return 'La solicitud volverá a En revisión.';
      default:
        return '';
    }
  });

  protected readonly confirmLabel = computed(() => {
    switch (this.pendingAction()) {
      case 'approve':
        return 'Aprobar';
      case 'reject':
        return 'Rechazar';
      case 'cancel':
        return 'Cancelar solicitud';
      case 'pass_to_review':
        return 'Pasar a revisión';
      case 'reopen':
        return 'Reabrir';
      default:
        return 'Confirmar';
    }
  });

  protected readonly confirmDanger = computed(() => {
    const action = this.pendingAction();
    return action === 'reject' || action === 'cancel';
  });

  /**
   * Avoid “Cancelar” on the dismiss button when confirming a cancel/reject,
   * which made the footer Cancelar action feel broken.
   */
  protected readonly confirmCancelLabel = computed(() => {
    const action = this.pendingAction();
    if (action === 'cancel' || action === 'reject') {
      return 'Volver';
    }
    return 'Cancelar';
  });

  protected readonly isReviewFooter = computed(
    () =>
      this.hasAction('approve') &&
      this.hasAction('reject') &&
      this.hasAction('cancel'),
  );

  protected readonly modalSubtitle = computed(() => {
    const item = this.request();
    if (!item) {
      return '';
    }
    const numero = item.id ? `${item.id} · ` : '';
    return `${numero}Recibida el ${this.formatDate(item.submittedAt)}`;
  });

  protected readonly detailFields = computed((): DetailField[] => {
    const item = this.request();
    if (!item) {
      return [];
    }

    const fields: DetailField[] = [
      {
        id: 'numero',
        label: 'Nº de solicitud',
        value: this.valueOrPlaceholder(item.id),
        icon: 'analytics',
      },
      {
        id: 'personType',
        label: 'Tipo de persona',
        value:
          item.personType === 'FISICA'
            ? 'Persona física'
            : item.personType === 'JURIDICA'
              ? 'Persona jurídica'
              : NOT_PROVIDED,
        icon: 'user',
      },
      {
        id: 'fullName',
        label:
          item.personType === 'JURIDICA'
            ? 'Razón social'
            : 'Apellido y Nombre / Razón Social',
        value: this.valueOrPlaceholder(item.fullName),
        icon: 'user',
      },
    ];

    if (item.personType !== 'JURIDICA') {
      fields.push(
        {
          id: 'birthDate',
          label: 'Fecha de Nacimiento',
          value: item.birthDate ? this.formatDate(item.birthDate) : NOT_PROVIDED,
          icon: 'calendar',
        },
        {
          id: 'document',
          label: 'D.N.I. / C.I. / L.E.',
          value: this.valueOrPlaceholder(item.documentNumber),
          icon: 'user',
        },
      );
    }

    fields.push(
      {
        id: 'cuit',
        label: item.personType === 'FISICA' ? 'CUIT / CUIL' : 'CUIT N°',
        value: this.valueOrPlaceholder(item.cuit),
        icon: 'analytics',
      },
      {
        id: 'email',
        label: 'Email',
        value: this.valueOrPlaceholder(item.email),
        icon: 'mail',
      },
      {
        id: 'phone',
        label: 'Teléfono',
        value: this.valueOrPlaceholder(item.phone),
        icon: 'phone',
      },
      {
        id: 'address',
        label: 'Dirección Postal',
        value: this.valueOrPlaceholder(item.address),
        icon: 'home',
      },
      {
        id: 'portal',
        label: 'Portal / Piso / Depto',
        value: this.valueOrPlaceholder(item.portalFloor),
        icon: 'home',
      },
    );

    if (item.personType === 'JURIDICA') {
      fields.push(
        {
          id: 'responsable',
          label: 'Nombre del responsable',
          value: this.valueOrPlaceholder(item.responsableName),
          icon: 'user',
        },
        {
          id: 'responsableDoc',
          label: 'DNI del responsable',
          value: this.valueOrPlaceholder(item.responsableDocument),
          icon: 'user',
        },
      );
    }

    fields.push(
      {
        id: 'establishment',
        label: 'Establecimiento',
        value: this.valueOrPlaceholder(item.establishmentName),
        icon: 'storefront',
      },
      {
        id: 'establishmentAddress',
        label: 'Dirección Estab.',
        value: this.valueOrPlaceholder(item.establishmentAddress),
        icon: 'home',
      },
    );

    if (item.updatedAt) {
      fields.push({
        id: 'updatedAt',
        label: 'Última actualización',
        value: this.formatDate(item.updatedAt),
        icon: 'calendar',
      });
    }

    return fields;
  });

  constructor() {
    effect(() => {
      const current = this.request();
      const open = this.open();

      if (!open || !current) {
        this.resetLocalState();
        this.boundRequestId = null;
        return;
      }

      // Only reset editable fields when opening another solicitud — not on detail refresh.
      if (this.boundRequestId !== current.id) {
        this.boundRequestId = current.id;
        this.noteControl.setValue('');
        this.motivoControl.setValue('');
        this.observacionControl.setValue('');
        this.motivoError.set('');
        this.observacionError.set('');
        this.confirmOpen.set(false);
        this.pendingAction.set(null);
      }

      if (this.canAct()) {
        this.noteControl.enable({ emitEvent: false });
        this.motivoControl.enable({ emitEvent: false });
        this.observacionControl.enable({ emitEvent: false });
      } else {
        this.noteControl.disable({ emitEvent: false });
        this.motivoControl.disable({ emitEvent: false });
        this.observacionControl.disable({ emitEvent: false });
      }
    });

    this.motivoControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.motivoError() && value.trim()) {
          this.motivoError.set('');
        }
      });

    this.observacionControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.observacionError() && value.trim()) {
          this.observacionError.set('');
        }
      });
  }

  protected hasAction(action: SolicitudAdminAction): boolean {
    return this.actions().includes(action);
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected requestAction(action: PendingConfirmAction): void {
    if (this.submitting() || this.loading()) {
      return;
    }

    if (action === 'reject' || action === 'cancel') {
      const motivo = this.motivoControl.value.trim();
      if (!motivo) {
        this.motivoControl.markAsTouched();
        this.motivoControl.setErrors({ required: true });
        this.motivoError.set(
          action === 'cancel'
            ? 'Indicá el motivo para cancelar la solicitud'
            : 'Indicá el motivo para rechazar la solicitud',
        );
        this.focusMotivoField();
        return;
      }
      this.motivoError.set('');
    }

    this.pendingAction.set(action);
    this.confirmOpen.set(true);
  }

  protected onConfirmCancel(): void {
    this.confirmOpen.set(false);
    this.pendingAction.set(null);
  }

  protected onConfirmAccept(): void {
    const action = this.pendingAction();
    if (!action) {
      this.confirmOpen.set(false);
      return;
    }

    const observacion = this.noteControl.value.trim();
    const motivo = this.motivoControl.value.trim();

    if ((action === 'reject' || action === 'cancel') && !motivo) {
      this.confirmOpen.set(false);
      this.pendingAction.set(null);
      this.motivoError.set(MOTIVO_REQUIRED_MESSAGE);
      this.focusMotivoField();
      return;
    }

    this.confirmOpen.set(false);
    this.pendingAction.set(null);

    switch (action) {
      case 'pass_to_review':
        this.passToReview.emit(observacion);
        break;
      case 'approve':
        this.approve.emit(observacion);
        break;
      case 'reject':
        this.reject.emit({ motivo, observacion });
        break;
      case 'cancel':
        this.cancelRequest.emit({ motivo, observacion });
        break;
      case 'reopen':
        this.reopen.emit(observacion);
        break;
    }
  }

  protected onObserve(): void {
    if (this.submitting() || this.loading()) {
      return;
    }
    const text = this.observacionControl.value.trim();
    if (!text) {
      this.observacionControl.markAsTouched();
      this.observacionControl.setErrors({ required: true });
      this.observacionError.set('La observación no puede estar vacía');
      return;
    }
    this.observacionError.set('');
    this.observe.emit(text);
    this.observacionControl.reset('');
  }

  private resetLocalState(): void {
    this.noteControl.reset('');
    this.motivoControl.reset('');
    this.observacionControl.reset('');
    this.motivoError.set('');
    this.observacionError.set('');
    this.confirmOpen.set(false);
    this.pendingAction.set(null);
  }

  private focusMotivoField(): void {
    queueMicrotask(() => {
      const section = this.motivoSection()?.nativeElement;
      if (!section) {
        return;
      }
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const field = section.querySelector('textarea');
      field?.focus();
    });
  }

  protected onDownload(path: string): void {
    if (this.submitting() || this.loading()) {
      return;
    }
    this.downloadFile.emit(path);
  }

  protected formatHistorialDate(value: string): string {
    return this.formatDate(value);
  }

  private valueOrPlaceholder(value: string | null | undefined): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || trimmed === NOT_PROVIDED) {
      return NOT_PROVIDED;
    }
    return trimmed;
  }

  private formatDate(value: string): string {
    if (!value) {
      return NOT_PROVIDED;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return NOT_PROVIDED;
    }
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
