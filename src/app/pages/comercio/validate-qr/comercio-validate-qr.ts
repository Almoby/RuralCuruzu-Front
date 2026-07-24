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
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { RedemptionService } from '../../../core/services/redemption.service';
import { QrValidationResponse } from '../../../core/interfaces/qr-validation.interface';
import { PromotionStatus } from '../../../shared/enums';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppLoading,
  AppPageHeader,
  AppSelect,
  SelectOption,
} from '../../../shared/components';

type ValidationView = 'scan' | 'success' | 'rejected';

@Component({
  selector: 'app-comercio-validate-qr',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppCard,
    AppSelect,
    AppButton,
    AppBadge,
    AppLoading,
  ],
  templateUrl: './comercio-validate-qr.html',
  styleUrl: './comercio-validate-qr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioValidateQr {
  private readonly auth = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly redemptionService = inject(RedemptionService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadingPromos = signal(true);
  readonly validating = signal(false);
  readonly view = signal<ValidationView>('scan');
  readonly result = signal<QrValidationResponse | null>(null);
  readonly benefitOptions = signal<SelectOption[]>([]);

  readonly form = this.fb.nonNullable.group({
    promotionId: ['', Validators.required],
  });

  readonly selectedBenefitLabel = computed(() => {
    const id = this.form.controls.promotionId.value;
    return this.benefitOptions().find((option) => option.value === id)?.label ?? '';
  });

  constructor() {
    const merchantId = this.auth.currentUser()?.merchantId;

    this.promotionService
      .list(merchantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          const active = promotions.filter((promo) => promo.status === PromotionStatus.Activa);
          this.benefitOptions.set(
            active.map((promo) => ({
              value: promo.id,
              label: `${promo.title} (${promo.discountLabel})`,
            })),
          );
          if (active.length > 0) {
            this.form.controls.promotionId.setValue(active[0].id);
          }
          this.loadingPromos.set(false);
        },
        error: () => this.loadingPromos.set(false),
      });
  }

  simulateValid(): void {
    this.validateToken('QR-S0001-VALID');
  }

  simulateExpired(): void {
    this.validateToken('QR-S0004-EXPIRED');
  }

  resetScanner(): void {
    this.view.set('scan');
    this.result.set(null);
  }

  private validateToken(qrToken: string): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Seleccioná el beneficio a validar.');
      return;
    }

    const merchantId = this.auth.currentUser()?.merchantId;
    if (!merchantId) {
      this.notifications.error('No se identificó el comercio.');
      return;
    }

    this.validating.set(true);
    this.redemptionService
      .validateQr({
        qrToken,
        merchantId,
        promotionId: this.form.controls.promotionId.value,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.validating.set(false);
          this.result.set(response);
          this.view.set(response.valid ? 'success' : 'rejected');
        },
        error: () => {
          this.validating.set(false);
          this.notifications.error('No se pudo validar el QR.');
        },
      });
  }
}
