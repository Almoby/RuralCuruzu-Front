import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { Promotion } from '../../../core/interfaces/promotion.interface';
import { PromotionStatus } from '../../../shared/enums';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../shared/components';
import { DateEsPipe } from '../../../shared/pipes';

@Component({
  selector: 'app-comercio-promotions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppCard,
    AppBadge,
    AppButton,
    AppModal,
    AppInput,
    AppTextarea,
    AppSelect,
    AppLoading,
    AppEmptyState,
    DateEsPipe,
  ],
  templateUrl: './comercio-promotions.html',
  styleUrl: './comercio-promotions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioPromotions {
  private readonly auth = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly promotions = signal<Promotion[]>([]);
  readonly modalOpen = signal(false);
  readonly editing = signal<Promotion | null>(null);

  readonly statusOptions: SelectOption[] = [
    { value: PromotionStatus.Activa, label: 'Activa' },
    { value: PromotionStatus.Inactiva, label: 'Inactiva' },
    { value: PromotionStatus.Vencida, label: 'Vencida' },
  ];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(8)]],
    discountLabel: ['', [Validators.required]],
    discountPercent: [''],
    validFrom: ['', [Validators.required]],
    validTo: ['', [Validators.required]],
    status: [PromotionStatus.Activa, [Validators.required]],
    terms: [''],
  });

  constructor() {
    this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      discountLabel: '',
      discountPercent: '',
      validFrom: '',
      validTo: '',
      status: PromotionStatus.Activa,
      terms: '',
    });
    this.modalOpen.set(true);
  }

  openEdit(promo: Promotion): void {
    this.editing.set(promo);
    this.form.reset({
      title: promo.title,
      description: promo.description,
      discountLabel: promo.discountLabel,
      discountPercent:
        promo.discountPercent !== undefined ? String(promo.discountPercent) : '',
      validFrom: promo.validFrom,
      validTo: promo.validTo,
      status: promo.status,
      terms: promo.terms ?? '',
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  statusVariant(status: PromotionStatus): 'success' | 'warning' | 'neutral' | 'danger' {
    switch (status) {
      case PromotionStatus.Activa:
        return 'success';
      case PromotionStatus.Vencida:
        return 'danger';
      case PromotionStatus.Inactiva:
        return 'neutral';
      default:
        return 'warning';
    }
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const merchantId = this.auth.currentUser()?.merchantId;
    if (!merchantId) {
      this.notifications.error('No se identificó el comercio.');
      return;
    }

    const raw = this.form.getRawValue();
    const discountPercent = raw.discountPercent
      ? Number(raw.discountPercent)
      : undefined;
    this.saving.set(true);

    const editing = this.editing();
    const request$ = editing
      ? this.promotionService.update(editing.id, {
          title: raw.title,
          description: raw.description,
          discountLabel: raw.discountLabel,
          discountPercent,
          validFrom: raw.validFrom,
          validTo: raw.validTo,
          status: raw.status as PromotionStatus,
          terms: raw.terms || undefined,
        })
      : this.promotionService.create({
          merchantId,
          title: raw.title,
          description: raw.description,
          discountLabel: raw.discountLabel,
          discountPercent,
          validFrom: raw.validFrom,
          validTo: raw.validTo,
          terms: raw.terms || undefined,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notifications.success(
          editing ? 'Promoción actualizada' : 'Promoción creada correctamente',
        );
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.notifications.error('No se pudo guardar la promoción.');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    const merchantId = this.auth.currentUser()?.merchantId;

    this.promotionService
      .list(merchantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.promotions.set(promotions);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
