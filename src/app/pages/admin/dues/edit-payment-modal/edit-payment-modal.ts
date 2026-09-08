import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, of, take } from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppInput,
  AppLoading,
  AppModal,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../../shared/components';
import {
  EditAdminPagoContext,
  EditarPagoCuotaRequest,
  MedioPagoCuota,
} from '../../../../core/interfaces/admin-cuota.interface';
import { MemberService } from '../../../../core/services/member.service';

export interface EditPaymentSave {
  pagoId: string;
  payload: EditarPagoCuotaRequest;
}

@Component({
  selector: 'app-edit-payment-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppModal,
    AppButton,
    AppSelect,
    AppInput,
    AppTextarea,
    AppAlert,
    AppLoading,
  ],
  templateUrl: './edit-payment-modal.html',
  styleUrl: './edit-payment-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPaymentModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly memberService = inject(MemberService);

  readonly open = input(false);
  readonly context = input<EditAdminPagoContext | null>(null);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<EditPaymentSave>();

  protected readonly sociosLoading = signal(false);
  protected readonly sociosError = signal('');
  protected readonly socioOptions = signal<SelectOption[]>([]);
  protected readonly formError = signal('');

  private original: EditAdminPagoContext | null = null;

  protected readonly methodOptions: SelectOption[] = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'VENTANILLA', label: 'Ventanilla' },
    { value: 'TRANSFERENCIA', label: 'Transferencia' },
    { value: 'DEBITO', label: 'Débito' },
    { value: 'LINK_DE_PAGO', label: 'Link de pago' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    socioId: ['', Validators.required],
    paidAt: ['', Validators.required],
    paymentMethod: ['EFECTIVO' as MedioPagoCuota, Validators.required],
    notes: [''],
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.original = null;
        this.formError.set('');
        this.sociosError.set('');
        return;
      }

      const ctx = this.context();
      if (!ctx) {
        return;
      }

      this.original = ctx;
      this.formError.set('');
      this.form.reset({
        socioId: ctx.socioId,
        paidAt: ctx.fecha,
        paymentMethod: ctx.medioPago,
        notes: ctx.observacion,
      });
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.loadSocios(ctx.socioId);
    });
  }

  protected onClose(): void {
    if (this.submitting()) {
      return;
    }
    this.close.emit();
  }

  protected onSubmit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const original = this.original;
    if (!original) {
      return;
    }

    const value = this.form.getRawValue();
    const payload = this.buildChangedPayload(original, value);
    if (Object.keys(payload).length === 0) {
      this.formError.set('No hay cambios para guardar.');
      return;
    }

    this.formError.set('');
    this.save.emit({
      pagoId: original.pagoId,
      payload,
    });
  }

  protected fieldError(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'Campo obligatorio';
    }
    return 'Valor inválido';
  }

  private buildChangedPayload(
    original: EditAdminPagoContext,
    value: {
      socioId: string;
      paidAt: string;
      paymentMethod: MedioPagoCuota;
      notes: string;
    },
  ): EditarPagoCuotaRequest {
    const payload: EditarPagoCuotaRequest = {};
    if (value.socioId !== original.socioId) {
      payload.socioId = value.socioId;
    }
    if (value.paidAt !== original.fecha) {
      payload.fecha = value.paidAt;
    }
    if (value.paymentMethod !== original.medioPago) {
      payload.medioPago = value.paymentMethod;
    }
    const notes = value.notes.trim();
    if (notes !== original.observacion.trim()) {
      payload.observacion = notes;
    }
    return payload;
  }

  private loadSocios(preferredSocioId: string): void {
    this.sociosLoading.set(true);
    this.sociosError.set('');
    this.memberService
      .getAdminSocios()
      .pipe(
        take(1),
        finalize(() => this.sociosLoading.set(false)),
        catchError(() => {
          this.sociosError.set('No se pudieron cargar los socios.');
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((members) => {
        const options = members.map((member) => ({
          value: member.id,
          label: `${member.memberCode} · ${member.fullName}`,
        }));
        this.socioOptions.set(options);
        if (
          preferredSocioId &&
          !options.some((option) => option.value === preferredSocioId)
        ) {
          this.form.controls.socioId.setValue(preferredSocioId);
        }
      });
  }
}
