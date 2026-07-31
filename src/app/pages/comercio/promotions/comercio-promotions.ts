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
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { Promotion } from '../../../core/interfaces/promotion.interface';
import { PromotionStatus, PromotionType } from '../../../shared/enums';
import {
  AppButton,
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
    AppIcon,
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
  readonly togglingId = signal<string | null>(null);
  readonly promotions = signal<Promotion[]>([]);
  readonly modalOpen = signal(false);
  readonly editing = signal<Promotion | null>(null);

  readonly activeCount = computed(
    () => this.promotions().filter((promo) => promo.status === PromotionStatus.Activa).length,
  );

  readonly activeSubtitle = computed(() => {
    const count = this.activeCount();
    return `${count} ${count === 1 ? 'activa' : 'activas'}`;
  });

  readonly typeOptions: SelectOption[] = [
    { value: PromotionType.Descuento, label: 'Descuento' },
    { value: PromotionType.Promocion, label: 'Promoción' },
    { value: PromotionType.DosPorUno, label: '2×1' },
    { value: PromotionType.Gratis, label: 'Gratis' },
  ];

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(8)]],
      type: [PromotionType.Descuento, [Validators.required]],
      value: ['', [Validators.required]],
      validFrom: ['', [Validators.required]],
      validTo: ['', [Validators.required]],
    },
    { validators: dateRangeValidator },
  );

  constructor() {
    this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      type: PromotionType.Descuento,
      value: '',
      validFrom: '',
      validTo: '',
    });
    this.modalOpen.set(true);
  }

  openEdit(promo: Promotion): void {
    this.editing.set(promo);
    this.form.reset({
      title: promo.title,
      description: promo.description,
      type: (promo.type as PromotionType) || PromotionType.Descuento,
      value: promo.discountLabel,
      validFrom: promo.validFrom,
      validTo: promo.validTo,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      type: PromotionType.Descuento,
      value: '',
      validFrom: '',
      validTo: '',
    });
  }

  promoIcon(promo: Promotion): string {
    return this.isPercentPromo(promo) ? 'percent' : 'local_offer';
  }

  promoIconTone(promo: Promotion): 'primary' | 'gold' {
    return this.isPercentPromo(promo) ? 'primary' : 'gold';
  }

  valueBadgeTone(promo: Promotion): 'primary' | 'brown' {
    return this.isPercentPromo(promo) ? 'primary' : 'brown';
  }

  formatUntil(date: string): string {
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) {
      return date;
    }
    return `Hasta ${Number(day)}/${Number(month)}/${year}`;
  }

  fieldError(controlName: 'title' | 'description' | 'type' | 'value' | 'validFrom' | 'validTo'): string {
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

  toggleStatus(promo: Promotion): void {
    if (this.togglingId()) {
      return;
    }

    this.togglingId.set(promo.id);
    this.promotionService
      .toggleStatus(promo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.promotions.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.togglingId.set(null);
          this.notifications.success(
            updated.status === PromotionStatus.Activa
              ? 'Promoción activada'
              : 'Promoción desactivada',
          );
        },
        error: () => {
          this.togglingId.set(null);
          this.notifications.error('No se pudo actualizar el estado.');
        },
      });
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
    const discountPercent = this.extractPercent(raw.value);
    this.saving.set(true);

    const editing = this.editing();
    const request$ = editing
      ? this.promotionService.update(editing.id, {
          title: raw.title.trim(),
          description: raw.description.trim(),
          type: raw.type,
          discountLabel: raw.value.trim(),
          discountPercent,
          validFrom: raw.validFrom,
          validTo: raw.validTo,
        })
      : this.promotionService.create({
          merchantId,
          title: raw.title.trim(),
          description: raw.description.trim(),
          type: raw.type,
          discountLabel: raw.value.trim(),
          discountPercent,
          validFrom: raw.validFrom,
          validTo: raw.validTo,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.promotions.update((list) => {
          const exists = list.some((item) => item.id === saved.id);
          if (exists) {
            return list.map((item) => (item.id === saved.id ? saved : item));
          }
          return [saved, ...list];
        });
        this.closeModal();
        this.notifications.success(
          editing ? 'Promoción actualizada' : 'Promoción creada correctamente',
        );
      },
      error: () => {
        this.saving.set(false);
        this.notifications.error('No se pudo guardar la promoción.');
      },
    });
  }

  private isPercentPromo(promo: Promotion): boolean {
    const type = String(promo.type ?? '');
    if (type === PromotionType.Descuento || promo.discountLabel.includes('%')) {
      return true;
    }
    return false;
  }

  private extractPercent(value: string): number | undefined {
    const match = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) {
      return undefined;
    }
    const parsed = Number(match[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
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
