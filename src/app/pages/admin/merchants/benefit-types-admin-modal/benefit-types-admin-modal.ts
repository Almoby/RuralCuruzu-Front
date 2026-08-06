import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { AdminBenefitTypeViewModel } from '../../../../core/interfaces/benefit-type.interface';
import { normalizeBenefitTypeCodigo } from '../../../../core/mappers/benefit-type.mapper';
import { BenefitTypeService } from '../../../../core/services/benefit-type.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppLoading,
  AppModal,
} from '../../../../shared/components';

type ModalView = 'list' | 'form';
type ListState = 'loading' | 'success' | 'empty' | 'error';

type ConfirmKind = 'toggle' | 'delete';

interface ConfirmState {
  kind: ConfirmKind;
  item: AdminBenefitTypeViewModel;
}

/** Uppercase alphanumerics with optional underscore-separated segments. */
const CODIGO_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const SUCCESS_CLOSE_DELAY_MS = 1500;

function codigoFormatValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  const normalized = normalizeBenefitTypeCodigo(raw);
  return CODIGO_PATTERN.test(normalized) ? null : { codigoFormat: true };
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

function mapFieldErrors(error: ApiError): Readonly<Record<string, string>> {
  const mapped: Record<string, string> = {};
  for (const item of error.fieldErrors ?? []) {
    const field = item.field?.trim().toLowerCase();
    const message = item.message.trim();
    if (!field || !message) {
      continue;
    }
    if (field === 'codigo' || field.includes('codigo')) {
      mapped['codigo'] = message;
      continue;
    }
    if (field === 'nombre' || field.includes('nombre')) {
      mapped['nombre'] = message;
    }
  }
  return mapped;
}

@Component({
  selector: 'app-benefit-types-admin-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppModal,
    AppButton,
    AppInput,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppBadge,
    AppIcon,
    AppConfirmDialog,
  ],
  templateUrl: './benefit-types-admin-modal.html',
  styleUrl: './benefit-types-admin-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BenefitTypesAdminModal {
  private readonly benefitTypeService = inject(BenefitTypeService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly view = signal<ModalView>('list');
  protected readonly listState = signal<ListState>('loading');
  protected readonly items = signal<AdminBenefitTypeViewModel[]>([]);
  protected readonly listError = signal('No se pudieron cargar los tipos de beneficio.');
  protected readonly formError = signal('');
  protected readonly serverFieldErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly conflictMessage = signal('');
  protected readonly submitting = signal(false);
  protected readonly editing = signal<AdminBenefitTypeViewModel | null>(null);
  protected readonly confirmState = signal<ConfirmState | null>(null);
  protected readonly actionBusy = signal(false);

  private successCloseTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.minLength(1), codigoFormatValidator]],
    nombre: ['', [Validators.required, Validators.minLength(1)]],
  });

  protected readonly modalTitle = computed(() => {
    if (this.view() === 'form') {
      return this.editing() ? 'Editar tipo' : 'Nuevo tipo';
    }
    return 'Tipos de beneficio';
  });

  protected readonly modalSubtitle = computed(() => {
    if (this.view() === 'form') {
      return this.editing()
        ? 'El código no se puede modificar.'
        : 'El tipo nace activo y estará disponible para los comercios.';
    }
    return 'Administrá las opciones disponibles para las promociones.';
  });

  protected readonly confirmOpen = computed(() => this.confirmState() !== null);

  protected readonly confirmTitle = computed(() => {
    const state = this.confirmState();
    if (!state) {
      return '';
    }
    if (state.kind === 'delete') {
      return 'Eliminar tipo de beneficio';
    }
    return state.item.activo ? 'Desactivar tipo' : 'Activar tipo';
  });

  protected readonly confirmMessage = computed(() => {
    const state = this.confirmState();
    if (!state) {
      return '';
    }
    if (state.kind === 'delete') {
      return '¿Querés eliminar este tipo? Esta acción no se puede deshacer.';
    }
    return state.item.activo
      ? `¿Querés desactivar “${state.item.nombre}”? Dejará de aparecer en el alta de promociones.`
      : `¿Querés activar “${state.item.nombre}”? Volverá a estar disponible para los comercios.`;
  });

  protected readonly confirmLabel = computed(() => {
    const state = this.confirmState();
    if (!state) {
      return 'Confirmar';
    }
    if (state.kind === 'delete') {
      return 'Eliminar';
    }
    return state.item.activo ? 'Desactivar' : 'Activar';
  });

  protected readonly confirmDanger = computed(() => {
    const state = this.confirmState();
    return state?.kind === 'delete' || state?.item.activo === true;
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.clearSuccessCloseTimer();
        return;
      }
      this.resetAll();
      this.loadList();
    });

    this.destroyRef.onDestroy(() => this.clearSuccessCloseTimer());

    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.editing()) {
          return;
        }
        const normalized = normalizeBenefitTypeCodigo(value ?? '');
        if (normalized !== (value ?? '')) {
          this.form.controls.codigo.setValue(normalized, { emitEvent: false });
        }
      });
  }

  protected onClose(): void {
    if (this.submitting() || this.actionBusy()) {
      return;
    }
    if (this.view() === 'form') {
      this.backToList();
      return;
    }
    this.close.emit();
  }

  protected retry(): void {
    this.loadList();
  }

  protected openCreate(): void {
    this.conflictMessage.set('');
    this.formError.set('');
    this.serverFieldErrors.set({});
    this.editing.set(null);
    this.form.reset({ codigo: '', nombre: '' });
    this.form.controls.codigo.enable({ emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.view.set('form');
  }

  protected openEdit(item: AdminBenefitTypeViewModel): void {
    this.conflictMessage.set('');
    this.formError.set('');
    this.serverFieldErrors.set({});
    this.editing.set(item);
    this.form.reset({ codigo: item.codigo, nombre: item.nombre });
    this.form.controls.codigo.disable({ emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.view.set('form');
  }

  protected backToList(): void {
    if (this.submitting()) {
      return;
    }
    this.resetFormState();
    this.view.set('list');
  }

  protected fieldError(controlName: 'codigo' | 'nombre'): string {
    const server = this.serverFieldErrors()[controlName];
    if (server) {
      return server;
    }
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (control.hasError('required') || control.hasError('minlength')) {
      return 'Campo obligatorio';
    }
    if (control.hasError('codigoFormat')) {
      return 'Usá solo mayúsculas, números y guion bajo, sin espacios. Ej.: DESCUENTO_PORCENTAJE o 2X1.';
    }
    return 'Valor inválido';
  }

  protected save(): void {
    if (this.submitting()) {
      return;
    }

    this.clearSuccessCloseTimer();
    this.formError.set('');
    this.serverFieldErrors.set({});
    this.form.markAllAsTouched();

    const editing = this.editing();
    if (editing) {
      const nombre = this.form.controls.nombre.value.trim();
      if (!nombre) {
        return;
      }
      this.submitting.set(true);
      this.benefitTypeService
        .updateAdminBenefitType(editing.id, { nombre })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            this.notifications.success(result.mensaje);
            this.scheduleCloseAfterSuccess();
          },
          error: (error: unknown) => {
            this.submitting.set(false);
            this.applyFormError(error);
          },
        });
      return;
    }

    if (this.form.invalid) {
      return;
    }

    const codigo = normalizeBenefitTypeCodigo(this.form.controls.codigo.value);
    const nombre = this.form.controls.nombre.value.trim();
    this.form.controls.codigo.setValue(codigo, { emitEvent: false });

    this.submitting.set(true);
    this.benefitTypeService
      .createAdminBenefitType({ codigo, nombre })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.notifications.success(result.mensaje);
          this.scheduleCloseAfterSuccess();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.applyFormError(error);
        },
      });
  }

  protected requestToggle(item: AdminBenefitTypeViewModel): void {
    this.conflictMessage.set('');
    this.confirmState.set({ kind: 'toggle', item });
  }

  protected requestDelete(item: AdminBenefitTypeViewModel): void {
    this.conflictMessage.set('');
    this.confirmState.set({ kind: 'delete', item });
  }

  protected cancelConfirm(): void {
    if (this.actionBusy()) {
      return;
    }
    this.confirmState.set(null);
  }

  protected confirmAction(): void {
    const state = this.confirmState();
    if (!state || this.actionBusy()) {
      return;
    }

    if (state.kind === 'toggle') {
      this.actionBusy.set(true);
      this.benefitTypeService
        .updateAdminBenefitType(state.item.id, { activo: !state.item.activo })
        .pipe(
          finalize(() => this.actionBusy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (result) => {
            this.confirmState.set(null);
            this.notifications.success(result.mensaje);
            this.loadList();
          },
          error: (error: unknown) => {
            this.confirmState.set(null);
            this.notifications.error(
              isApiError(error)
                ? error.message
                : 'No se pudo actualizar el estado del tipo.',
            );
          },
        });
      return;
    }

    this.actionBusy.set(true);
    this.benefitTypeService
      .deleteAdminBenefitType(state.item.id)
      .pipe(
        finalize(() => this.actionBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (mensaje) => {
          this.confirmState.set(null);
          this.notifications.success(mensaje);
          this.loadList();
        },
        error: (error: unknown) => {
          this.confirmState.set(null);
          if (isApiError(error) && error.status === 409) {
            this.conflictMessage.set(
              'Este tipo está siendo utilizado por uno o más beneficios. Podés desactivarlo en lugar de eliminarlo.',
            );
            return;
          }
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo eliminar el tipo de beneficio.',
          );
        },
      });
  }

  private loadList(): void {
    this.listState.set('loading');
    this.listError.set('No se pudieron cargar los tipos de beneficio.');
    this.conflictMessage.set('');

    this.benefitTypeService
      .getAdminBenefitTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.listState.set(items.length === 0 ? 'empty' : 'success');
        },
        error: (error: unknown) => {
          this.items.set([]);
          this.listState.set('error');
          this.listError.set(
            isApiError(error)
              ? error.message
              : 'No se pudieron cargar los tipos de beneficio.',
          );
        },
      });
  }

  private scheduleCloseAfterSuccess(): void {
    this.clearSuccessCloseTimer();
    this.successCloseTimer = setTimeout(() => {
      this.successCloseTimer = null;
      this.submitting.set(false);
      this.closeFormAfterSuccess();
      this.loadList();
    }, SUCCESS_CLOSE_DELAY_MS);
  }

  private clearSuccessCloseTimer(): void {
    if (this.successCloseTimer !== null) {
      clearTimeout(this.successCloseTimer);
      this.successCloseTimer = null;
    }
  }

  /** Closes create/edit after the success feedback delay. */
  private closeFormAfterSuccess(): void {
    this.resetFormState();
    this.view.set('list');
  }

  private resetFormState(): void {
    this.formError.set('');
    this.serverFieldErrors.set({});
    this.editing.set(null);
    this.form.reset({ codigo: '', nombre: '' });
    this.form.controls.codigo.enable({ emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private applyFormError(error: unknown): void {
    if (!isApiError(error)) {
      this.formError.set('No se pudo guardar el tipo de beneficio.');
      return;
    }

    const fields = mapFieldErrors(error);
    this.serverFieldErrors.set(fields);

    if (error.status === 409) {
      this.formError.set(
        error.message?.trim() ||
          'Ya existe un tipo de beneficio con ese código.',
      );
      return;
    }

    if (!fields['codigo'] && !fields['nombre']) {
      this.formError.set(
        error.message || 'No se pudo guardar el tipo de beneficio.',
      );
    }
  }

  private resetAll(): void {
    this.clearSuccessCloseTimer();
    this.view.set('list');
    this.listState.set('loading');
    this.items.set([]);
    this.listError.set('No se pudieron cargar los tipos de beneficio.');
    this.formError.set('');
    this.serverFieldErrors.set({});
    this.conflictMessage.set('');
    this.submitting.set(false);
    this.actionBusy.set(false);
    this.editing.set(null);
    this.confirmState.set(null);
    this.form.reset({ codigo: '', nombre: '' });
    this.form.controls.codigo.enable({ emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
