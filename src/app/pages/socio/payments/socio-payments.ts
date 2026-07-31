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
import { forkJoin, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FeeService } from '../../../core/services/fee.service';
import { MemberService } from '../../../core/services/member.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  BankDetailRow,
  BankTransferDetails,
  FeePayment,
} from '../../../core/interfaces/fee.interface';
import { PaymentMethod, PaymentStatus } from '../../../shared/enums';
import {
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppTextarea,
} from '../../../shared/components';
import { CurrencyArsPipe, DateEsPipe } from '../../../shared/pipes';
import { formatFeePeriodTitle, formatPeriodLabel } from '../../../shared/utils';

type TransferStep = 1 | 2 | 3;

const ACCEPTED_RECEIPT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

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
    AppIcon,
    CurrencyArsPipe,
    DateEsPipe,
  ],
  templateUrl: './socio-payments.html',
  styleUrl: './socio-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioPayments {
  private readonly auth = inject(AuthService);
  private readonly feeService = inject(FeeService);
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currencyPipe = new CurrencyArsPipe();

  private readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>('receiptFileInput');

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly fees = signal<FeePayment[]>([]);
  readonly memberId = signal<string | null>(null);
  readonly bankTransfer = signal<BankTransferDetails | null>(null);
  readonly linkModalOpen = signal(false);
  readonly reportModalOpen = signal(false);
  readonly transferStep = signal<TransferStep>(1);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal('');
  readonly copiedKey = signal<string | null>(null);

  readonly reportForm = this.fb.nonNullable.group({
    notes: [''],
  });

  readonly currentFee = computed(() => {
    const list = this.fees();
    return list.length > 0 ? list[0] : null;
  });

  readonly previousFees = computed(() => this.fees().slice(1));

  readonly memberCode = computed(
    () => this.auth.currentUser()?.memberCode ?? this.currentFee()?.memberCode ?? '',
  );

  readonly memberName = computed(
    () => this.auth.currentUser()?.fullName ?? this.currentFee()?.memberName ?? 'Socio',
  );

  readonly memberSummary = computed(() => {
    const code = this.memberCode();
    const name = this.memberName();
    return code ? `Socio ${code} — ${name}` : `Socio — ${name}`;
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
    const details = this.bankTransfer();
    const fee = this.currentFee();
    const code = this.memberCode();
    if (!details || !fee) {
      return [];
    }

    return [
      { key: 'bank', label: 'Banco', value: details.bank, copyable: false },
      { key: 'cbu', label: 'CBU', value: details.cbu, copyable: true },
      { key: 'alias', label: 'Alias', value: details.alias, copyable: true },
      { key: 'holder', label: 'Titular', value: details.holder, copyable: false },
      { key: 'cuit', label: 'CUIT', value: details.cuit, copyable: false },
      {
        key: 'amount',
        label: 'Monto',
        value: this.currencyPipe.transform(fee.amount),
        copyable: false,
      },
      {
        key: 'concept',
        label: 'Concepto / Referencia',
        value: code,
        copyable: true,
      },
    ];
  });

  constructor() {
    this.load();
  }

  feeTitle(period: string): string {
    return formatFeePeriodTitle(period);
  }

  receiptTitle(period: string): string {
    return `Cuota ${formatPeriodLabel(period)}`;
  }

  feeBadgeVariant(status: PaymentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case PaymentStatus.Aprobado:
        return 'success';
      case PaymentStatus.Pendiente:
        return 'warning';
      case PaymentStatus.Rechazado:
        return 'danger';
      default:
        return 'neutral';
    }
  }

  feeStatusLabel(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.Aprobado:
        return 'Al día';
      case PaymentStatus.Pendiente:
        return 'Pendiente';
      case PaymentStatus.Rechazado:
        return 'Rechazado';
      default:
        return status;
    }
  }

  openLinkModal(): void {
    this.linkModalOpen.set(true);
  }

  closeLinkModal(): void {
    this.linkModalOpen.set(false);
  }

  openReportModal(): void {
    this.resetTransferForm();
    this.transferStep.set(1);
    this.reportModalOpen.set(true);
  }

  closeReportModal(): void {
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
    const memberId = this.memberId();
    if (!fee || !memberId) {
      this.notifications.error('No se pudo identificar la cuota actual.');
      return;
    }

    const notes = this.reportForm.controls.notes.getRawValue().trim();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('notes', notes);
    formData.append('period', fee.period);
    formData.append('memberId', memberId);
    formData.append('feeId', fee.id);
    formData.append('amount', String(fee.amount));
    formData.append('paymentMethod', PaymentMethod.Transferencia);

    this.submitting.set(true);
    this.feeService
      .reportTransferPayment(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.transferStep.set(3);
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo informar el pago.');
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
      return 'El archivo debe ser PNG, JPG, WEBP o PDF.';
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

  private load(): void {
    this.loading.set(true);
    const code = this.auth.currentUser()?.memberCode;

    forkJoin({
      fees: this.feeService.list(),
      members: this.memberService.list().pipe(take(1)),
      bank: this.feeService.getBankTransferDetails().pipe(take(1)),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ fees, members, bank }) => {
          const member = members.find((item) => item.memberCode === code);
          this.memberId.set(member?.id ?? null);
          this.bankTransfer.set(bank);

          const memberFees = (
            code ? fees.filter((fee) => fee.memberCode === code) : fees
          ).sort((a, b) => b.period.localeCompare(a.period));

          this.fees.set(memberFees);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
