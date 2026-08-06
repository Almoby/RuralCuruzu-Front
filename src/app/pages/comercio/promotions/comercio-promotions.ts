import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  EMPTY,
  Subject,
  catchError,
  finalize,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { BenefitTypeOptionViewModel } from '../../../core/interfaces/benefit-type.interface';
import { NotificationService } from '../../../core/services/notification.service';
import { BenefitTypeService } from '../../../core/services/benefit-type.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  BeneficioEstadoDto,
  ComercioBeneficioViewModel,
} from '../../../core/interfaces/comercio-beneficio.interface';
import {
  ensureBenefitTypeOption,
  mapBenefitTypeOptionsToSelectOptions,
} from '../../../core/mappers/benefit-type.mapper';
import {
  mapPromotionFormToCreateRequest,
  mapPromotionFormToUpdateRequest,
  mapPromotionStatusToNextEstado,
} from '../../../core/mappers/comercio-beneficio.mapper';
import {
  AppAlert,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../shared/components';

type PromotionsViewState = 'loading' | 'success' | 'empty' | 'error';
type CatalogState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface StatusConfirmState {
  promo: ComercioBeneficioViewModel;
  nextEstado: BeneficioEstadoDto;
}

const dateRangeValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const from = String(group.get('validFrom')?.value ?? '');
  const to = String(group.get('validTo')?.value ?? '');
  if (!from || !to) {
    return null;
  }
  return to >= from ? null : { dateRange: true };
};

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

@Component({
  selector: 'app-comercio-promotions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppButton,
    AppModal,
    AppInput,
    AppTextarea,
    AppSelect,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppIcon,
    AppConfirmDialog,
  ],
  templateUrl: './comercio-promotions.html',
  styleUrl: './comercio-promotions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioPromotions {
  private readonly promotionService = inject(PromotionService);
  private readonly benefitTypeService = inject(BenefitTypeService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  readonly viewState = signal<PromotionsViewState>('loading');
  readonly saving = signal(false);
  readonly togglingId = signal<string | null>(null);
  readonly promotions = signal<ComercioBeneficioViewModel[]>([]);
  readonly modalOpen = signal(false);
  readonly editing = signal<ComercioBeneficioViewModel | null>(null);
  readonly statusConfirm = signal<StatusConfirmState | null>(null);
  readonly errorMessage = signal(
    'No se pudieron cargar las promociones. Intentá nuevamente.',
  );

  private readonly catalogOptionsSignal = signal<BenefitTypeOptionViewModel[]>([]);
  private readonly catalogStateSignal = signal<CatalogState>('idle');
  private readonly catalogErrorSignal = signal(
    'No se pudieron cargar los tipos de beneficio.',
  );

  readonly catalogState = this.catalogStateSignal.asReadonly();
  readonly catalogError = this.catalogErrorSignal.asReadonly();

  readonly typeOptions = computed<SelectOption[]>(() =>
    mapBenefitTypeOptionsToSelectOptions(this.catalogOptionsSignal()),
  );

  readonly typeSelectDisabled = computed(
    () =>
      this.saving() ||
      this.catalogStateSignal() === 'loading' ||
      this.catalogStateSignal() === 'error' ||
      this.catalogStateSignal() === 'empty',
  );

  readonly typeSelectPlaceholder = computed(() => {
    switch (this.catalogStateSignal()) {
      case 'loading':
        return 'Cargando tipos…';
      case 'empty':
        return 'No hay tipos disponibles';
      case 'error':
        return 'No se pudieron cargar los tipos';
      default:
        return 'Seleccionar tipo…';
    }
  });

  readonly canSubmit = computed(() => {
    const catalogOk = this.catalogStateSignal() === 'success';
    const hasType = !!this.form.controls.typeId.value?.trim();
    return catalogOk && hasType && !this.saving();
  });

  readonly statusConfirmOpen = computed(() => this.statusConfirm() !== null);

  readonly statusConfirmTitle = computed(() =>
    this.statusConfirm()?.nextEstado === 'INACTIVO'
      ? 'Desactivar promoción'
      : 'Activar promoción',
  );

  readonly statusConfirmMessage = computed(() =>
    this.statusConfirm()?.nextEstado === 'INACTIVO'
      ? '¿Querés desactivar esta promoción? Dejará de estar visible para los socios.'
      : '¿Querés activar esta promoción? Volverá a estar disponible para los socios.',
  );

  readonly statusConfirmLabel = computed(() =>
    this.statusConfirm()?.nextEstado === 'INACTIVO' ? 'Desactivar' : 'Activar',
  );

  readonly activeCount = computed(
    () => this.promotions().filter((promo) => promo.isActive).length,
  );

  readonly activeSubtitle = computed(() => {
    const count = this.activeCount();
    return `${count} ${count === 1 ? 'activa' : 'activas'}`;
  });

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
      typeId: ['', [Validators.required]],
      value: ['', [Validators.required, Validators.minLength(1)]],
      validFrom: ['', [Validators.required]],
      validTo: ['', [Validators.required]],
    },
    { validators: dateRangeValidator },
  );

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          if (this.promotions().length === 0) {
            this.viewState.set('loading');
          }
        }),
        switchMap(() =>
          this.promotionService.getComercioBeneficios().pipe(
            catchError((error: unknown) => {
              this.promotions.set([]);
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar las promociones. Intentá nuevamente.',
              );
              this.viewState.set('error');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.promotions.set(items);
        this.viewState.set(items.length === 0 ? 'empty' : 'success');
      });
  }

  retry(): void {
    this.reload$.next();
  }

  openCreate(): void {
    this.editing.set(null);
    this.resetForm();
    this.modalOpen.set(true);
    this.loadCatalog();
  }

  openEdit(promo: ComercioBeneficioViewModel): void {
    this.editing.set(promo);
    this.form.reset({
      title: promo.title,
      description: promo.description,
      typeId: promo.tipoBeneficioId,
      value: promo.valueLabel === '—' ? '' : promo.valueLabel,
      validFrom: promo.validFrom,
      validTo: promo.validTo,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen.set(true);
    this.loadCatalog();
  }

  closeModal(options?: { force?: boolean }): void {
    if (!options?.force && this.saving()) {
      return;
    }
    this.modalOpen.set(false);
    this.editing.set(null);
    this.resetForm();
    this.catalogStateSignal.set('idle');
    this.catalogOptionsSignal.set([]);
    this.catalogErrorSignal.set('No se pudieron cargar los tipos de beneficio.');
  }

  retryCatalog(): void {
    this.loadCatalog({ forceRefresh: true });
  }

  promoIcon(promo: ComercioBeneficioViewModel): string {
    return promo.isPercent ? 'percent' : 'local_offer';
  }

  promoIconTone(promo: ComercioBeneficioViewModel): 'primary' | 'gold' {
    return promo.isPercent ? 'primary' : 'gold';
  }

  valueBadgeTone(promo: ComercioBeneficioViewModel): 'primary' | 'brown' {
    return promo.isPercent ? 'primary' : 'brown';
  }

  fieldError(
    controlName: 'title' | 'description' | 'typeId' | 'value' | 'validFrom' | 'validTo',
  ): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Campo obligatorio';
    }
    if (control.hasError('minlength')) {
      return 'Texto demasiado corto';
    }
    return 'Valor inválido';
  }

  dateRangeError(): string {
    if (!this.form.hasError('dateRange')) {
      return '';
    }
    if (this.form.controls.validFrom.touched || this.form.controls.validTo.touched) {
      return 'La fecha fin debe ser igual o posterior a la fecha inicio';
    }
    return '';
  }

  /** Opens confirmation; PATCH runs only after confirm. */
  requestToggleStatus(promo: ComercioBeneficioViewModel): void {
    if (this.togglingId() === promo.id) {
      return;
    }

    const nextEstado = mapPromotionStatusToNextEstado(promo.status);
    this.statusConfirm.set({ promo, nextEstado });
  }

  cancelStatusConfirm(): void {
    if (this.togglingId()) {
      return;
    }
    this.statusConfirm.set(null);
  }

  confirmStatusChange(): void {
    const pending = this.statusConfirm();
    if (!pending || this.togglingId()) {
      return;
    }

    const { promo, nextEstado } = pending;
    this.togglingId.set(promo.id);

    this.promotionService
      .changeComercioBeneficioEstado(promo.id, nextEstado)
      .pipe(
        finalize(() => this.togglingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.statusConfirm.set(null);
          this.notifications.success(
            updated.isActive ? 'Promoción activada' : 'Promoción desactivada',
          );
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo actualizar el estado.',
          );
        },
      });
  }

  save(): void {
    if (
      this.form.invalid ||
      this.saving() ||
      this.catalogStateSignal() !== 'success'
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const typeId = this.form.controls.typeId.value.trim();
    if (!typeId) {
      this.form.controls.typeId.markAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const formValue = {
      title: raw.title,
      description: raw.description,
      typeId,
      value: raw.value,
      validFrom: raw.validFrom,
      validTo: raw.validTo,
    };

    const editing = this.editing();
    this.saving.set(true);

    const request$ = editing
      ? this.promotionService.updateComercioBeneficio(
          editing.id,
          mapPromotionFormToUpdateRequest(formValue),
        )
      : this.promotionService.createComercioBeneficio(
          mapPromotionFormToCreateRequest(formValue),
        );

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.success(
            editing ? 'Promoción actualizada' : 'Promoción creada correctamente',
          );
          this.closeModal({ force: true });
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo guardar la promoción.',
          );
        },
      });
  }

  private loadCatalog(options?: { forceRefresh?: boolean }): void {
    this.catalogStateSignal.set('loading');
    this.catalogErrorSignal.set('No se pudieron cargar los tipos de beneficio.');

    if (options?.forceRefresh) {
      this.benefitTypeService.clearCache();
    }

    this.benefitTypeService
      .getActiveBenefitTypes({ forceRefresh: options?.forceRefresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          const editing = this.editing();
          const withCurrent = ensureBenefitTypeOption(
            items,
            editing?.tipoBeneficioId,
            editing?.tipoBeneficioNombre,
          );
          this.catalogOptionsSignal.set(withCurrent);

          if (withCurrent.length === 0) {
            this.catalogStateSignal.set('empty');
            this.form.controls.typeId.setValue('');
            return;
          }

          this.catalogStateSignal.set('success');

          const currentId = this.form.controls.typeId.value.trim();
          if (currentId && withCurrent.some((item) => item.id === currentId)) {
            return;
          }
          if (editing?.tipoBeneficioId) {
            this.form.controls.typeId.setValue(editing.tipoBeneficioId);
            return;
          }
          this.form.controls.typeId.setValue('');
        },
        error: (error: unknown) => {
          this.catalogOptionsSignal.set([]);
          this.catalogStateSignal.set('error');
          this.catalogErrorSignal.set(
            isApiError(error)
              ? error.message
              : 'No se pudieron cargar los tipos de beneficio.',
          );
        },
      });
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      description: '',
      typeId: '',
      value: '',
      validFrom: '',
      validTo: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
