import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { DateEsPipe } from '../../../shared/pipes';
import { MerchantService } from '../../../core/services/merchant.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  Merchant,
  MerchantCategoryOption,
} from '../../../core/interfaces/merchant.interface';
import { MerchantStatus } from '../../../shared/enums';
import { merchantStatusBadge } from '../utils/admin-labels';
import { resolveMerchantCategoryIcon } from '../../../shared/utils';
import { MerchantFormModal, MerchantFormSave } from './merchant-form-modal/merchant-form-modal';

type MerchantsViewState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [
    AppPageHeader,
    AppButton,
    AppBadge,
    AppIcon,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppConfirmDialog,
    DateEsPipe,
    MerchantFormModal,
  ],
  templateUrl: './merchants.html',
  styleUrl: './merchants.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsPage {
  private readonly merchantService = inject(MerchantService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly categories = signal<MerchantCategoryOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Merchant | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly merchantToDelete = signal<Merchant | null>(null);

  protected readonly activeCount = computed(
    () => this.merchants().filter((item) => item.status === MerchantStatus.Activo).length,
  );

  protected readonly subtitle = computed(
    () => `${this.activeCount()} activos de ${this.merchants().length}`,
  );

  protected readonly selected = computed(() => {
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

  protected readonly merchantStatusBadge = merchantStatusBadge;
  protected readonly MerchantStatus = MerchantStatus;
  protected readonly categoryIcon = resolveMerchantCategoryIcon;

  constructor() {
    this.load();
  }

  protected selectMerchant(merchant: Merchant): void {
    this.selectedId.set(merchant.id);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(merchant: Merchant, event?: Event): void {
    event?.stopPropagation();
    this.editing.set(merchant);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected retry(): void {
    this.load();
  }

  protected toggleStatus(merchant: Merchant, event: Event): void {
    event.stopPropagation();
    this.submitting.set(true);

    const request$ =
      merchant.status === MerchantStatus.Activo
        ? this.merchantService.deactivateMerchant(merchant.id)
        : this.merchantService.activateMerchant(merchant.id);

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.notifications.success(
            updated.status === MerchantStatus.Activo
              ? 'Comercio activado'
              : 'Comercio desactivado',
          );
          this.load(updated.id);
        },
        error: () => {
          this.notifications.error('No se pudo actualizar el estado del comercio');
        },
      });
  }

  protected askDelete(merchant: Merchant, event: Event): void {
    event.stopPropagation();
    this.merchantToDelete.set(merchant);
    this.confirmOpen.set(true);
  }

  protected cancelDelete(): void {
    this.confirmOpen.set(false);
    this.merchantToDelete.set(null);
  }

  protected confirmDelete(): void {
    const merchant = this.merchantToDelete();
    if (!merchant) {
      return;
    }

    this.submitting.set(true);
    this.merchantService
      .deleteMerchant(merchant.id)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirmOpen.set(false);
          this.merchantToDelete.set(null);
          if (this.selectedId() === merchant.id) {
            this.selectedId.set(null);
          }
          this.notifications.success('Comercio eliminado');
          this.load();
        },
        error: () => {
          this.notifications.error('No se pudo eliminar el comercio');
        },
      });
  }

  protected saveMerchant(event: MerchantFormSave): void {
    this.submitting.set(true);
    const request$ =
      event.mode === 'create'
        ? this.merchantService.createMerchant(event.payload)
        : this.merchantService.updateMerchant(event.id, event.payload);

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (merchant) => {
          this.closeForm();
          this.notifications.success(
            event.mode === 'create' ? 'Comercio creado' : 'Comercio actualizado',
          );
          this.load(merchant.id);
        },
        error: () => {
          this.notifications.error(
            event.mode === 'create'
              ? 'No se pudo crear el comercio'
              : 'No se pudo actualizar el comercio',
          );
        },
      });
  }

  private load(selectId?: string): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.merchantService
      .getMerchants()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (merchants) => {
          this.merchants.set(merchants);
          if (selectId) {
            this.selectedId.set(selectId);
          }
        },
        error: () => {
          this.loadError.set(true);
          this.notifications.error('No se pudieron cargar los comercios');
        },
      });

    this.merchantService
      .getMerchantCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
      });
  }
}
