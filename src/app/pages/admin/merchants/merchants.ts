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
import {
  EMPTY,
  Subject,
  catchError,
  finalize,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppTextarea,
} from '../../../shared/components';
import { MerchantService } from '../../../core/services/merchant.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  AdminMerchant,
  AdminMerchantCategoryOption,
  AdminMerchantDetail,
} from '../../../core/interfaces/admin-comercio.interface';
import {
  mapAdminFormToAltaRequest,
  mapAdminFormToUpdateRequest,
} from '../../../core/mappers/admin-comercio.mapper';
import { resolveMerchantCategoryIcon } from '../../../shared/utils';
import { MerchantFormModal, MerchantFormSave } from './merchant-form-modal/merchant-form-modal';
import { BenefitTypesAdminModal } from './benefit-types-admin-modal/benefit-types-admin-modal';
import { DeletedMerchantsModal } from './deleted-merchants-modal/deleted-merchants-modal';

type MerchantsViewState = 'loading' | 'success' | 'empty' | 'error';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

function mapComercioFieldErrors(error: ApiError): Readonly<Record<string, string>> {
  const mapped: Record<string, string> = {};
  for (const item of error.fieldErrors ?? []) {
    const field = item.field?.trim().toLowerCase();
    const message = item.message.trim();
    if (!field || !message) {
      continue;
    }

    if (field === 'cuit' || field.includes('cuit')) {
      mapped['cuit'] = message;
      continue;
    }
    if (
      field === 'correoelectronico' ||
      field === 'correo_electronico' ||
      field === 'email'
    ) {
      mapped['email'] = message;
      continue;
    }
    if (field === 'nombrecomercial' || field === 'nombre_comercial') {
      mapped['tradeName'] = message;
      continue;
    }
    if (field === 'razonsocial' || field === 'razon_social') {
      mapped['name'] = message;
      continue;
    }
    if (field === 'telefono') {
      mapped['phone'] = message;
      continue;
    }
    if (field === 'direccion') {
      mapped['address'] = message;
      continue;
    }
    if (field === 'rubro') {
      mapped['category'] = message;
    }
  }

  // Backend often returns CUIT format issues only in `message`.
  if (!mapped['cuit'] && /cuit|cuil/i.test(error.message)) {
    mapped['cuit'] = error.message;
  }

  return mapped;
}

@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppButton,
    AppBadge,
    AppIcon,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppConfirmDialog,
    AppModal,
    AppTextarea,
    MerchantFormModal,
    BenefitTypesAdminModal,
    DeletedMerchantsModal,
  ],
  templateUrl: './merchants.html',
  styleUrl: './merchants.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsPage {
  private readonly merchantService = inject(MerchantService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly reload$ = new Subject<void>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly merchants = signal<AdminMerchant[]>([]);
  protected readonly categories = signal<AdminMerchantCategoryOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedDetail = signal<AdminMerchantDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly benefitTypesOpen = signal(false);
  protected readonly deletedMerchantsOpen = signal(false);
  protected readonly deletedMerchantsRefreshToken = signal(0);
  protected readonly editing = signal<AdminMerchant | null>(null);
  protected readonly formServerErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly confirmOpen = signal(false);
  protected readonly merchantToDelete = signal<AdminMerchant | null>(null);
  protected readonly deleteMotivoOpen = signal(false);
  protected readonly deleteForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(1)]],
  });

  protected readonly activeCount = computed(
    () => this.merchants().filter((item) => item.status === 'ACTIVO').length,
  );

  protected readonly subtitle = computed(
    () => `${this.activeCount()} activos de ${this.merchants().length}`,
  );

  protected readonly selected = computed(() => {
    const detail = this.selectedDetail();
    if (detail && detail.id === this.selectedId()) {
      return detail;
    }
    const id = this.selectedId();
    if (!id) {
      return null;
    }
    return this.merchants().find((item) => item.id === id) ?? null;
  });

  protected readonly viewState = computed<MerchantsViewState>(() => {
    if (this.loading()) {
      return 'loading';
    }
    if (this.loadError()) {
      return 'error';
    }
    if (this.merchants().length === 0) {
      return 'empty';
    }
    return 'success';
  });

  protected readonly categoryIcon = resolveMerchantCategoryIcon;

  constructor() {
    this.categories.set(this.merchantService.getAdminRubroOptions());

    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(false);
        }),
        switchMap(() =>
          this.merchantService.getAdminMerchants().pipe(
            catchError((error: unknown) => {
              this.loadError.set(true);
              this.loading.set(false);
              if (this.merchants().length === 0) {
                this.merchants.set([]);
              }
              this.notifications.error(
                isApiError(error) ? error.message : 'No se pudieron cargar los comercios',
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((merchants) => {
        this.merchants.set(merchants);
        this.loading.set(false);
        this.loadError.set(false);

        const selectedId = this.selectedId();
        if (selectedId && !merchants.some((item) => item.id === selectedId)) {
          this.selectedId.set(null);
          this.selectedDetail.set(null);
        } else if (selectedId) {
          this.loadDetail(selectedId);
        }
      });
  }

  protected selectMerchant(merchant: AdminMerchant): void {
    this.selectedId.set(merchant.id);
    this.loadDetail(merchant.id);
  }

  protected openBenefitTypes(): void {
    this.benefitTypesOpen.set(true);
  }

  protected closeBenefitTypes(): void {
    this.benefitTypesOpen.set(false);
  }

  protected openDeletedMerchants(): void {
    this.deletedMerchantsOpen.set(true);
  }

  protected closeDeletedMerchants(): void {
    this.deletedMerchantsOpen.set(false);
  }

  protected openCreate(): void {
    this.formServerErrors.set({});
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(merchant: AdminMerchant, event?: Event): void {
    event?.stopPropagation();
    this.formServerErrors.set({});
    this.editing.set(merchant);
    this.formOpen.set(true);
  }

  protected closeForm(options?: { force?: boolean }): void {
    if (this.submitting() && !options?.force) {
      return;
    }
    this.formOpen.set(false);
    this.editing.set(null);
    this.formServerErrors.set({});
    this.submitting.set(false);
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected toggleStatus(merchant: AdminMerchant, event: Event): void {
    event.stopPropagation();
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const request$ =
      merchant.status === 'ACTIVO'
        ? this.merchantService.deactivateAdminMerchant(merchant.id)
        : this.merchantService.activateAdminMerchant(merchant.id);

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.notifications.success(
            result.mensaje?.trim() ||
              (result.estado === 'ACTIVO' ? 'Comercio activado' : 'Comercio desactivado'),
          );
          this.selectedId.set(merchant.id);
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo actualizar el estado del comercio',
          );
        },
      });
  }

  protected askDelete(merchant: AdminMerchant, event: Event): void {
    event.stopPropagation();
    this.merchantToDelete.set(merchant);
    this.deleteForm.reset({ motivo: '' });
    this.deleteMotivoOpen.set(true);
  }

  protected cancelDelete(): void {
    if (this.submitting()) {
      return;
    }
    this.confirmOpen.set(false);
    this.deleteMotivoOpen.set(false);
    this.merchantToDelete.set(null);
    this.deleteForm.reset({ motivo: '' });
    this.deleteForm.markAsPristine();
    this.deleteForm.markAsUntouched();
  }

  protected continueDelete(): void {
    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }
    this.deleteMotivoOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected confirmDelete(): void {
    const merchant = this.merchantToDelete();
    if (!merchant || this.submitting()) {
      return;
    }

    const motivo = this.deleteForm.controls.motivo.value.trim();
    if (!motivo) {
      this.notifications.error('El motivo es obligatorio para eliminar el comercio');
      this.confirmOpen.set(false);
      this.deleteMotivoOpen.set(true);
      return;
    }

    this.submitting.set(true);
    this.merchantService
      .deleteAdminMerchant(merchant.id, { motivo })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.confirmOpen.set(false);
          this.deleteMotivoOpen.set(false);
          this.merchantToDelete.set(null);
          this.deleteForm.reset({ motivo: '' });
          this.deleteForm.markAsPristine();
          this.deleteForm.markAsUntouched();
          if (this.selectedId() === merchant.id) {
            this.selectedId.set(null);
            this.selectedDetail.set(null);
          }
          this.notifications.success(
            result.mensaje?.trim() || 'Comercio eliminado',
          );
          this.reload$.next();
          if (this.deletedMerchantsOpen()) {
            this.deletedMerchantsRefreshToken.update((token) => token + 1);
          }
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo eliminar el comercio',
          );
        },
      });
  }

  protected saveMerchant(event: MerchantFormSave): void {
    if (this.submitting()) {
      return;
    }

    this.formServerErrors.set({});
    this.submitting.set(true);
    const request$ =
      event.mode === 'create'
        ? this.merchantService.createAdminMerchant(mapAdminFormToAltaRequest(event.payload))
        : this.merchantService.updateAdminMerchant(
            event.id,
            mapAdminFormToUpdateRequest(event.payload),
          );

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (merchant) => {
          this.notifications.success(
            event.mode === 'create' ? 'Comercio creado' : 'Comercio actualizado',
          );
          // Force-close: submitting is still true until finalize runs.
          this.closeForm({ force: true });
          this.selectedId.set(merchant.id);
          this.reload$.next();
        },
        error: (error: unknown) => {
          if (isApiError(error)) {
            this.formServerErrors.set(mapComercioFieldErrors(error));
            this.notifications.error(error.message);
            return;
          }
          this.notifications.error(
            event.mode === 'create'
              ? 'No se pudo crear el comercio'
              : 'No se pudo actualizar el comercio',
          );
        },
      });
  }

  protected deleteMotivoError(): string {
    const control = this.deleteForm.controls.motivo;
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required'] || control.errors['minlength']) {
      return 'El motivo es obligatorio';
    }
    return 'Valor inválido';
  }

  private loadDetail(id: string): void {
    const listItem = this.merchants().find((item) => item.id === id);
    this.detailLoading.set(true);

    this.merchantService
      .getAdminMerchantById(id, {
        consumptions: listItem?.consumptions ?? 0,
        activePromotionsCount: listItem?.activePromotionsCount ?? 0,
      })
      .pipe(
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          if (this.selectedId() === id) {
            this.selectedDetail.set(detail);
          }
        },
        error: (error: unknown) => {
          if (this.selectedId() === id) {
            this.selectedDetail.set(null);
          }
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo cargar el detalle del comercio',
          );
        },
      });
  }
}
