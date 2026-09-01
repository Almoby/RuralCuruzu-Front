import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  EMPTY,
  Subject,
  catchError,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FeeService } from '../../../core/services/fee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserIdentityService } from '../../../core/services/user-identity.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  BankDetailRow,
  SocioPaymentsReceiptItem,
  SocioPaymentsViewModel,
} from '../../../core/interfaces/socio-payments.interface';
import {
  buildSocioBankDetailRows,
  mapSocioPaymentsBundleToViewModel,
  todayLocalDateIso,
} from '../../../core/mappers/socio-payments.mapper';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppTextarea,
} from '../../../shared/components';
import { CurrencyArsPipe } from '../../../shared/pipes';

type TransferStep = 1 | 2 | 3;
type ViewState = 'loading' | 'success' | 'error';

const ACCEPTED_RECEIPT_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
] as const;

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const EMPTY_PAYMENTS: SocioPaymentsViewModel = {
  currentCuota: null,
  previousCuotas: [],
  receipts: [],
  bank: null,
  memberCode: '',
  memberName: 'Socio',
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
  selector: 'app-socio-payments',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppButton,
    AppModal,
    AppTextarea,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppIcon,
    CurrencyArsPipe,
  ],
  templateUrl: './socio-payments.html',
  styleUrl: './socio-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioPayments {
  private readonly auth = inject(AuthService);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly feeService = inject(FeeService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyPipe = new CurrencyArsPipe();
  private readonly reload$ = new Subject<void>();

  private readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>('receiptFileInput');

  readonly viewState = signal<ViewState>('loading');
  readonly submitting = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly data = signal<SocioPaymentsViewModel>(EMPTY_PAYMENTS);
  readonly errorMessage = signal(
    'No pudimos cargar tus pagos. Reintentá en unos segundos.',
  );
  readonly reportModalOpen = signal(false);
  readonly transferStep = signal<TransferStep>(1);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal('');
  readonly copiedKey = signal<string | null>(null);
  readonly successMessage = signal(
    'El equipo administrativo revisará y aprobará tu pago. Recibirás una notificación por email.',
  );

  readonly reportForm = this.fb.nonNullable.group({
    notes: [''],
  });

  readonly currentFee = computed(() => this.data().currentCuota);
  readonly receipts = computed(() => this.data().receipts);

  readonly memberCode = computed(() => {
    const fromData = this.data().memberCode;
    return fromData || this.userIdentity.socioNumero() || '';
  });

  readonly transferModalSubtitle = computed(() => {
    switch (this.transferStep()) {
      case 1:
        return 'Datos para acreditar el pago';
      case 2:
        return 'Adjuntá el comprobante';
      case 3:
        return 'Pago informado';
      default:
        return 'Datos para acreditar el pago';
    }
  });

  readonly bankRows = computed((): BankDetailRow[] => {
    const fee = this.currentFee();
    if (!fee) {
      return [];
    }
    return buildSocioBankDetailRows(
      this.data().bank,
      this.currencyPipe.transform(fee.amount),
      this.memberCode(),
    );
  });

  readonly canPayCurrent = computed(() => this.currentFee()?.canReportPayment === true);

  readonly hasPendingOnlinePayment = computed(
    () => this.currentFee()?.hasPendingOnlinePayment === true,
  );

  readonly paymentBlockedMessage = computed(() => {
    const fee = this.currentFee();
    if (!fee || fee.canReportPayment) {
      return '';
    }
    if (fee.hasPendingOnlinePayment) {
      return 'Tenés un pago online en proceso. Todavía no está confirmado: el sistema espera la notificación del proveedor de pagos. Mientras tanto no se puede informar una transferencia.';
    }
    if (fee.estado === 'PAGADA') {
      return 'Esta cuota figura como pagada según el sistema.';
    }
    return `Esta cuota está en estado “${fee.estadoLabel}” y no admite un nuevo pago por ahora.`;
  });

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          if (this.viewState() !== 'success') {
            this.viewState.set('loading');
          }
        }),
        switchMap(() =>
          forkJoin({
            cuotas: this.feeService.getSocioCuotas(),
            pagos: this.feeService.getSocioPayments(),
            bank: this.feeService.getSocioBankDetails().pipe(
              catchError(() => of(null)),
            ),
          }).pipe(
            map((bundle) =>
              mapSocioPaymentsBundleToViewModel(bundle, {
                memberCode: this.userIdentity.socioNumero() ?? undefined,
                displayName: this.auth.currentUser()?.fullName,
              }),
            ),
            catchError((error: unknown) => {
              this.data.set(EMPTY_PAYMENTS);
              this.viewState.set('error');
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No pudimos cargar tus pagos. Reintentá en unos segundos.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.data.set(payload);
        this.viewState.set('success');
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  openReportModal(): void {
    const fee = this.currentFee();
    if (!fee?.canReportPayment) {
      this.notifications.error(
        'Esta cuota no admite informar un pago en su estado actual.',
      );
      return;
    }
    if (!this.data().bank) {
      this.notifications.error(
        'Todavía no hay datos bancarios configurados. Consultá en la cooperativa.',
      );
      return;
    }
    this.resetTransferForm();
    this.transferStep.set(1);
    this.reportModalOpen.set(true);
  }

  closeReportModal(): void {
    if (this.submitting()) {
      return;
    }
    this.reportModalOpen.set(false);
    this.resetTransferForm();
    this.transferStep.set(1);
  }

  goToTransferStep(step: TransferStep): void {
    this.transferStep.set(step);
  }

  copyBankValue(row: BankDetailRow): void {
    if (!row.copyable) {
      return;
    }

    void navigator.clipboard.writeText(row.value).then(
      () => {
        this.copiedKey.set(row.key);
        window.setTimeout(() => {
          if (this.copiedKey() === row.key) {
            this.copiedKey.set(null);
          }
        }, 1600);
      },
      () => this.notifications.error('No se pudo copiar'),
    );
  }

  openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.applySelectedFile(file);
  }

  onReceiptDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.applySelectedFile(file);
  }

  onReceiptDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  submitReport(): void {
    if (this.submitting()) {
      return;
    }

    const file = this.selectedFile();
    if (!file) {
      this.fileError.set('Adjuntá una imagen o un PDF del comprobante.');
      return;
    }

    const validationError = this.validateReceiptFile(file);
    if (validationError) {
      this.fileError.set(validationError);
      return;
    }

    const fee = this.currentFee();
    if (!fee?.canReportPayment) {
      this.notifications.error(
        'Esta cuota no admite informar un pago en su estado actual.',
      );
      return;
    }

    const notes = this.reportForm.controls.notes.getRawValue().trim();
    const datos = {
      fecha: todayLocalDateIso(),
      importe: fee.amount,
      medioPago: 'TRANSFERENCIA' as const,
      ...(notes ? { observacion: notes } : {}),
    };

    this.submitting.set(true);
    this.feeService
      .reportSocioTransferPayment(fee.id, datos, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          const message = response.mensaje?.trim();
          if (message) {
            this.successMessage.set(message);
            this.notifications.success(message);
          } else {
            this.successMessage.set(
              'El equipo administrativo revisará y aprobará tu pago. Recibirás una notificación por email.',
            );
          }
          this.transferStep.set(3);
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo informar el pago.',
          );
        },
      });
  }

  downloadReceipt(item: SocioPaymentsReceiptItem): void {
    if (!item.canDownload || this.downloadingId()) {
      return;
    }

    this.downloadingId.set(item.id);
    this.feeService
      .downloadSocioPaymentReceipt(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          this.downloadingId.set(null);
          const url = URL.createObjectURL(file.blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = file.fileName;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => {
          this.downloadingId.set(null);
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo descargar el comprobante.',
          );
        },
      });
  }

  private applySelectedFile(file: File | null): void {
    if (!file) {
      this.selectedFile.set(null);
      this.fileError.set('Adjuntá una imagen o un PDF del comprobante.');
      return;
    }

    const error = this.validateReceiptFile(file);
    if (error) {
      this.selectedFile.set(null);
      this.fileError.set(error);
      const input = this.fileInput()?.nativeElement;
      if (input) {
        input.value = '';
      }
      return;
    }

    this.selectedFile.set(file);
    this.fileError.set('');
  }

  private validateReceiptFile(file: File): string {
    if (!(ACCEPTED_RECEIPT_TYPES as readonly string[]).includes(file.type)) {
      return 'El archivo debe ser PNG, JPG o PDF.';
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      return 'El archivo no puede superar los 5 MB.';
    }
    return '';
  }

  private resetTransferForm(): void {
    this.reportForm.reset({ notes: '' });
    this.selectedFile.set(null);
    this.fileError.set('');
    this.copiedKey.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }
}
