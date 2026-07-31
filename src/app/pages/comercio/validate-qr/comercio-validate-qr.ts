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
import {
  ApprovedQrValidationResponse,
  QrValidationResponse,
  RejectedQrValidationResponse,
} from '../../../core/interfaces/qr-validation.interface';
import { PromotionStatus } from '../../../shared/enums';
import {
  AppAlert,
  AppButton,
  AppIcon,
  AppLoading,
  AppSelect,
  SelectOption,
} from '../../../shared/components';

/**
 * Exclusive UI states for Validar QR.
 * `scanning` / `validating` share the scanner card with loading overlay.
 */
export type QrValidationViewState =
  | 'idle'
  | 'scanning'
  | 'validating'
  | 'approved'
  | 'rejected'
  | 'error';

@Component({
  selector: 'app-comercio-validate-qr',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppSelect,
    AppButton,
    AppLoading,
    AppAlert,
    AppIcon,
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
  readonly viewState = signal<QrValidationViewState>('idle');
  readonly result = signal<QrValidationResponse | null>(null);
  readonly benefitOptions = signal<SelectOption[]>([]);
  readonly scannerActive = signal(false);

  readonly form = this.fb.nonNullable.group({
    promotionId: ['', Validators.required],
  });

  readonly approvedResult = computed((): ApprovedQrValidationResponse | null => {
    const current = this.result();
    return current?.valid ? current : null;
  });

  readonly rejectedResult = computed((): RejectedQrValidationResponse | null => {
    const current = this.result();
    return current && !current.valid ? current : null;
  });

  readonly showBenefitSelect = computed(() => {
    const state = this.viewState();
    return state === 'idle' || state === 'scanning' || state === 'validating';
  });

  readonly showScanner = computed(() => {
    const state = this.viewState();
    return state === 'idle' || state === 'scanning' || state === 'validating';
  });

  readonly isValidating = computed(() => this.viewState() === 'validating');

  constructor() {
    this.loadBenefits();
    this.startScanner();
  }

  startScanner(): void {
    this.scannerActive.set(true);
    if (this.viewState() === 'idle') {
      this.viewState.set('scanning');
    }
  }

  stopScanner(): void {
    this.scannerActive.set(false);
  }

  handleQrResult(value: string): void {
    this.validateQr(value);
  }

  simulateValid(): void {
    this.handleQrResult('QR-S0001-VALID');
  }

  simulateExpired(): void {
    /** Member with fee overdue — Figma “Cuota vencida” case. */
    this.handleQrResult('QR-S0003-VALID');
  }

  resetScanner(): void {
    this.result.set(null);
    this.viewState.set('idle');
    this.startScanner();
  }

  retry(): void {
    this.result.set(null);
    this.viewState.set('idle');
    this.startScanner();
  }

  formatValidatedAt(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  private validateQr(qrToken: string): void {
    if (this.isValidating()) {
      return;
    }

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

    const benefitId = this.form.controls.promotionId.value;
    this.viewState.set('validating');

    this.redemptionService
      .validateQr({
        qrToken,
        merchantId,
        benefitId,
        promotionId: benefitId,
        validatedAt: new Date().toISOString(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.stopScanner();
          this.result.set(response);
          this.viewState.set(response.valid ? 'approved' : 'rejected');
        },
        error: () => {
          this.stopScanner();
          this.result.set(null);
          this.viewState.set('error');
        },
      });
  }

  private loadBenefits(): void {
    const merchantId = this.auth.currentUser()?.merchantId;

    this.promotionService
      .list(merchantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          const options = promotions
            .filter(
              (promo) =>
                promo.status === PromotionStatus.Activa ||
                promo.status === PromotionStatus.Inactiva,
            )
            .map((promo) => ({
              value: promo.id,
              label: promo.title,
            }));

          this.benefitOptions.set(options);
          if (options.length > 0) {
            this.form.controls.promotionId.setValue(options[0].value);
          }
          this.loadingPromos.set(false);
        },
        error: () => {
          this.loadingPromos.set(false);
          this.viewState.set('error');
        },
      });
  }
}
