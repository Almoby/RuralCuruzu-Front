import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { map, merge, startWith } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { RedemptionService } from '../../../core/services/redemption.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { ComercioBeneficioViewModel } from '../../../core/interfaces/comercio-beneficio.interface';
import {
  ComercioQrRedemptionRejectedViewModel,
  ComercioQrRedemptionSuccessViewModel,
} from '../../../core/interfaces/comercio-qr-redemption.interface';
import {
  isBeneficioEligibleForRedemption,
  mapApiErrorToRejectedViewModel,
  mapBeneficioToSelectLabel,
  mapValidarBeneficioFormToRequest,
  normalizeManualCodigoQrForRequest,
  formatManualCodigoQrInput,
  parseMontoAhorroInput,
} from '../../../core/mappers/comercio-qr-redemption.mapper';
import {
  AppAlert,
  AppButton,
  AppConfirmDialog,
  AppIcon,
  AppInput,
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

const SCANNER_HINT_SCAN =
  'Apuntá la cámara hacia el código QR del socio.';
const SCANNER_HINT_MANUAL =
  'La lectura automática no está disponible. Ingresá el código manual del socio debajo.';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

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
  selector: 'app-comercio-validate-qr',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppSelect,
    AppInput,
    AppButton,
    AppLoading,
    AppAlert,
    AppIcon,
    AppConfirmDialog,
  ],
  templateUrl: './comercio-validate-qr.html',
  styleUrl: './comercio-validate-qr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercioValidateQr implements AfterViewInit, OnDestroy {
  private readonly promotionService = inject(PromotionService);
  private readonly redemptionService = inject(RedemptionService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');

  private mediaStream: MediaStream | null = null;
  private detectTimer: ReturnType<typeof setInterval> | null = null;
  private barcodeDetector: BarcodeDetectorLike | null = null;
  private zxingReader: BrowserQRCodeReader | null = null;
  private zxingControls: IScannerControls | null = null;
  private lastHandledToken = '';

  readonly loadingPromos = signal(true);
  readonly viewState = signal<QrValidationViewState>('idle');
  readonly successResult = signal<ComercioQrRedemptionSuccessViewModel | null>(
    null,
  );
  readonly rejectedResult =
    signal<ComercioQrRedemptionRejectedViewModel | null>(null);
  readonly benefitOptions = signal<SelectOption[]>([]);
  readonly benefits = signal<ComercioBeneficioViewModel[]>([]);
  readonly scannerActive = signal(false);
  readonly cameraSupported = signal(false);
  readonly cameraError = signal('');
  /** True only while a live MediaStream is attached (not merely a <video> node). */
  readonly cameraStreamActive = signal(false);
  /**
   * True while automatic QR decoding is active
   * (native BarcodeDetector or ZXing fallback).
   */
  readonly autoScanAvailable = signal(false);
  /** In-memory QR token only — never persisted. */
  readonly qrToken = signal('');
  readonly confirmOpen = signal(false);
  readonly loadErrorMessage = signal(
    'No se pudieron cargar los beneficios. Intentá nuevamente.',
  );

  readonly form = this.fb.nonNullable.group({
    promotionId: ['', Validators.required],
    montoAhorro: ['', [Validators.required]],
    codigoManual: [''],
  });

  /**
   * Reactive form snapshot — `computed()` does not track AbstractControl values.
   * Without this, confirmMessage kept showing "Ahorro informado: —".
   */
  private readonly formProbe = toSignal(
    merge(this.form.valueChanges, this.form.statusChanges).pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );

  /**
   * Contextual hint under the viewport:
   * - live stream + auto scan → scan guidance
   * - otherwise → manual paste guidance
   */
  readonly scannerHintMessage = computed(() => {
    const cameraError = this.cameraError();
    if (cameraError) {
      return cameraError;
    }
    if (this.cameraStreamActive() && this.autoScanAvailable()) {
      return SCANNER_HINT_SCAN;
    }
    return SCANNER_HINT_MANUAL;
  });

  readonly selectedBenefit = computed((): ComercioBeneficioViewModel | null => {
    const id = this.formProbe().promotionId;
    return this.benefits().find((item) => item.id === id) ?? null;
  });

  readonly confirmMessage = computed(() => {
    const probe = this.formProbe();
    const benefit = this.selectedBenefit();
    const amount = parseMontoAhorroInput(probe.montoAhorro);
    const title = benefit?.title ?? 'Beneficio';
    const typeLabel = benefit?.typeLabel ?? '';
    const value = benefit?.valueLabel ?? '—';
    const savings =
      amount === null
        ? '—'
        : new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(amount);
    const typePart = typeLabel && typeLabel !== 'Beneficio' ? ` Tipo: ${typeLabel}.` : '';
    return `Beneficio: ${title}.${typePart} Valor: ${value}. Ahorro informado: ${savings}. Se registrará el canje en el sistema.`;
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

    this.form.controls.codigoManual.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((raw) => {
        const formatted = formatManualCodigoQrInput(raw ?? '');
        if (formatted !== raw) {
          this.form.controls.codigoManual.setValue(formatted, {
            emitEvent: false,
          });
        }
      });
  }

  ngAfterViewInit(): void {
    void this.startScanner();
  }

  ngOnDestroy(): void {
    this.teardownCamera();
  }

  startScanner(): void {
    if (this.isValidating()) {
      return;
    }
    this.scannerActive.set(true);
    if (this.viewState() === 'idle' || this.viewState() === 'scanning') {
      this.viewState.set('scanning');
    }
    void this.initCamera();
  }

  stopScanner(): void {
    this.scannerActive.set(false);
    this.teardownCamera();
  }

  submitManualCode(): void {
    const formatted = normalizeManualCodigoQrForRequest(
      this.form.controls.codigoManual.value,
    );
    if (!formatted || formatted.replace(/-/g, '').length < 16) {
      this.notifications.warning(
        'Ingresá el código manual del socio (formato XXXX-XXXX-XXXX-XXXX).',
      );
      return;
    }
    this.form.controls.codigoManual.setValue(formatted, { emitEvent: false });
    this.onQrTokenCaptured(formatted);
  }

  resetScanner(): void {
    this.clearFlow({ keepBenefits: true });
    this.viewState.set('idle');
    this.startScanner();
  }

  retry(): void {
    this.clearFlow({ keepBenefits: false });
    this.viewState.set('idle');
    this.loadBenefits();
    this.startScanner();
  }

  cancelConfirm(): void {
    if (this.isValidating()) {
      return;
    }
    this.confirmOpen.set(false);
    // Keep benefit/amount; allow a new scan with a fresh token.
    this.qrToken.set('');
    this.lastHandledToken = '';
    this.form.controls.codigoManual.setValue('');
    this.startScanner();
  }

  confirmRedeem(): void {
    if (this.isValidating()) {
      return;
    }

    const token = this.qrToken().trim();
    const beneficioId = this.form.controls.promotionId.value.trim();
    const monto = parseMontoAhorroInput(this.form.controls.montoAhorro.value);

    if (!token || !beneficioId || monto === null) {
      this.confirmOpen.set(false);
      this.notifications.warning('Completá beneficio, ahorro y código QR.');
      return;
    }

    this.viewState.set('validating');
    this.stopScanner();

    const body = mapValidarBeneficioFormToRequest({
      codigoQr: token,
      beneficioId,
      montoAhorro: monto,
    });

    this.redemptionService
      .redeemComercioBenefit(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.confirmOpen.set(false);
          this.successResult.set(result);
          this.rejectedResult.set(null);
          this.viewState.set('approved');
          this.clearSensitiveFields();
          this.refreshBenefitsQuietly();
        },
        error: (error: unknown) => {
          this.handleRedeemError(error);
        },
      });
  }

  fieldError(controlName: 'promotionId' | 'montoAhorro'): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (controlName === 'montoAhorro') {
      const parsed = parseMontoAhorroInput(control.value);
      if (parsed === null) {
        return 'Ingresá un monto válido (ej. 450 o 450.50)';
      }
    }
    if (control.hasError('required')) {
      return 'Campo obligatorio';
    }
    return 'Valor inválido';
  }

  private onQrTokenCaptured(rawToken: string): void {
    if (this.isValidating() || this.confirmOpen()) {
      return;
    }

    const token = rawToken.trim();
    if (!token || token === this.lastHandledToken) {
      return;
    }

    if (this.form.controls.promotionId.invalid) {
      this.form.controls.promotionId.markAsTouched();
      this.notifications.warning('Seleccioná el beneficio a validar.');
      return;
    }

    const monto = parseMontoAhorroInput(this.form.controls.montoAhorro.value);
    if (monto === null) {
      this.form.controls.montoAhorro.markAsTouched();
      this.notifications.warning('Ingresá el ahorro real de la compra.');
      return;
    }

    this.lastHandledToken = token;
    this.qrToken.set(token);
    this.form.controls.codigoManual.setValue('');
    this.stopScanner();
    this.confirmOpen.set(true);
  }

  private handleRedeemError(error: unknown): void {
    if (!isApiError(error)) {
      this.confirmOpen.set(false);
      this.rejectedResult.set(null);
      this.successResult.set(null);
      this.viewState.set('error');
      this.loadErrorMessage.set(
        'No se pudo validar el QR por un error técnico. Intentá nuevamente.',
      );
      return;
    }

    const rejected = mapApiErrorToRejectedViewModel(error);
    this.confirmOpen.set(false);
    this.successResult.set(null);
    this.rejectedResult.set(rejected);
    this.viewState.set('rejected');

    if (rejected.clearQrToken) {
      this.qrToken.set('');
      this.lastHandledToken = '';
      this.form.controls.codigoManual.setValue('');
    }

    if (rejected.reloadBenefits) {
      this.refreshBenefitsQuietly();
    }
  }

  private clearSensitiveFields(): void {
    this.qrToken.set('');
    this.lastHandledToken = '';
    this.form.controls.codigoManual.setValue('');
    this.form.controls.montoAhorro.setValue('');
    this.form.controls.montoAhorro.markAsPristine();
    this.form.controls.montoAhorro.markAsUntouched();
  }

  private clearFlow(options: { keepBenefits: boolean }): void {
    this.confirmOpen.set(false);
    this.successResult.set(null);
    this.rejectedResult.set(null);
    this.qrToken.set('');
    this.lastHandledToken = '';
    this.form.controls.codigoManual.setValue('');
    this.form.controls.montoAhorro.setValue('');
    this.form.markAsPristine();
    this.form.markAsUntouched();
    if (!options.keepBenefits) {
      this.benefits.set([]);
      this.benefitOptions.set([]);
      this.form.controls.promotionId.setValue('');
    }
  }

  private loadBenefits(): void {
    this.loadingPromos.set(true);
    this.promotionService
      .getComercioBeneficios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.applyBenefits(items);
          this.loadingPromos.set(false);
        },
        error: (error: unknown) => {
          this.loadingPromos.set(false);
          this.benefits.set([]);
          this.benefitOptions.set([]);
          this.loadErrorMessage.set(
            isApiError(error)
              ? error.message
              : 'No se pudieron cargar los beneficios. Intentá nuevamente.',
          );
          this.viewState.set('error');
        },
      });
  }

  private refreshBenefitsQuietly(): void {
    this.promotionService
      .getComercioBeneficios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.applyBenefits(items),
        error: () => undefined,
      });
  }

  private applyBenefits(items: ComercioBeneficioViewModel[]): void {
    const eligible = items.filter(isBeneficioEligibleForRedemption);
    this.benefits.set(eligible);
    const options = eligible.map((item) => ({
      value: item.id,
      label: mapBeneficioToSelectLabel(item),
    }));
    this.benefitOptions.set(options);

    const current = this.form.controls.promotionId.value;
    if (!options.some((option) => option.value === current)) {
      this.form.controls.promotionId.setValue(options[0]?.value ?? '');
    }
  }

  private async initCamera(): Promise<void> {
    this.teardownCamera();
    this.cameraError.set('');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraSupported.set(false);
      this.cameraStreamActive.set(false);
      this.autoScanAvailable.set(false);
      this.cameraError.set(
        'Este navegador no permite acceso a la cámara. Pegá el código del QR.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      this.mediaStream = stream;
      this.cameraSupported.set(true);
      // Render the <video> branch before attaching the stream.
      this.cameraStreamActive.set(true);
      this.cdr.detectChanges();

      const video = this.videoRef()?.nativeElement;
      if (!video) {
        this.teardownCamera();
        this.cameraSupported.set(false);
        this.cameraError.set(
          'No se pudo inicializar el visor de cámara. Pegá el código del QR.',
        );
        return;
      }

      // iOS Safari/WebKit: keep playback inline (not fullscreen).
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const started = await this.startAutoScan(stream, video);
      this.autoScanAvailable.set(started);
    } catch {
      this.teardownCamera();
      this.cameraSupported.set(false);
      this.cameraError.set(
        'No pudimos acceder a la cámara. Revisá los permisos del navegador.',
      );
    }
  }

  /**
   * Capability-based auto-scan:
   * 1) BarcodeDetector when available (Chrome Android, etc.)
   * 2) ZXing BrowserQRCodeReader fallback (iOS Safari / Chrome iOS)
   */
  private async startAutoScan(
    stream: MediaStream,
    video: HTMLVideoElement,
  ): Promise<boolean> {
    const Detector = (
      globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;

    if (Detector) {
      try {
        this.barcodeDetector = new Detector({ formats: ['qr_code'] });
        this.detectTimer = setInterval(() => {
          void this.detectFromVideo();
        }, 350);
        return true;
      } catch {
        this.barcodeDetector = null;
        // Fall through to ZXing.
      }
    }

    return this.startZxingFallback(stream, video);
  }

  private async startZxingFallback(
    stream: MediaStream,
    video: HTMLVideoElement,
  ): Promise<boolean> {
    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 350,
        delayBetweenScanSuccess: 1500,
      });
      this.zxingReader = reader;

      this.zxingControls = await reader.decodeFromStream(
        stream,
        video,
        (result) => {
          if (!result) {
            return;
          }
          const value = result.getText();
          if (!value) {
            return;
          }
          this.ngZone.run(() => this.onQrTokenCaptured(value));
        },
      );
      return true;
    } catch {
      this.stopZxing();
      return false;
    }
  }

  private async detectFromVideo(): Promise<void> {
    if (
      !this.scannerActive() ||
      this.isValidating() ||
      this.confirmOpen() ||
      !this.barcodeDetector
    ) {
      return;
    }

    const video = this.videoRef()?.nativeElement;
    if (!video || video.readyState < 2) {
      return;
    }

    try {
      const codes = await this.barcodeDetector.detect(video);
      const value = codes.find((item) => item.rawValue?.trim())?.rawValue;
      if (value) {
        this.onQrTokenCaptured(value);
      }
    } catch {
      // Transient detect failures are ignored.
    }
  }

  private stopZxing(): void {
    try {
      this.zxingControls?.stop();
    } catch {
      // Ignore stop errors during teardown.
    }
    this.zxingControls = null;
    this.zxingReader = null;
  }

  private teardownCamera(): void {
    if (this.detectTimer !== null) {
      clearInterval(this.detectTimer);
      this.detectTimer = null;
    }
    this.barcodeDetector = null;
    this.stopZxing();
    this.autoScanAvailable.set(false);

    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    this.cameraStreamActive.set(false);
  }
}
