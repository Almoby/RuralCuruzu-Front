import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppButton,
  AppIcon,
  AppInput,
  AppModal,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../../shared/components';
import { Member } from '../../../../core/interfaces/member.interface';
import {
  FeePeriodOption,
  RegisterPaymentRequest,
} from '../../../../core/interfaces/fee.interface';
import { PaymentMethod } from '../../../../shared/enums';
import { currentPeriod, paymentMethodIcon } from '../../utils/admin-labels';

interface MethodChoice {
  value: PaymentMethod;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-register-payment-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppModal,
    AppButton,
    AppSelect,
    AppInput,
    AppTextarea,
    AppIcon,
  ],
  templateUrl: './register-payment-modal.html',
  styleUrl: './register-payment-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPaymentModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly members = input<Member[]>([]);
  readonly periodOptions = input<FeePeriodOption[]>([]);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<RegisterPaymentRequest>();

  protected readonly methodChoices: MethodChoice[] = [
    {
      value: PaymentMethod.Efectivo,
      label: 'Efectivo',
      icon: paymentMethodIcon(PaymentMethod.Efectivo),
    },
    {
      value: PaymentMethod.Transferencia,
      label: 'Transferencia',
      icon: paymentMethodIcon(PaymentMethod.Transferencia),
    },
    {
      value: PaymentMethod.Debito,
      label: 'Débito',
      icon: paymentMethodIcon(PaymentMethod.Debito),
    },
    {
      value: PaymentMethod.LinkPago,
      label: 'Link de pago',
      icon: paymentMethodIcon(PaymentMethod.LinkPago),
    },
    {
      value: PaymentMethod.BilleteraVirtual,
      label: 'Billetera virtual',
      icon: paymentMethodIcon(PaymentMethod.BilleteraVirtual),
    },
  ];

  protected readonly selectedMethod = signal<PaymentMethod>(PaymentMethod.Efectivo);

  protected readonly form = this.fb.nonNullable.group({
    memberId: ['', Validators.required],
    paymentMethod: [PaymentMethod.Efectivo as string, Validators.required],
    amount: ['', [Validators.required, Validators.min(1)]],
    paidAt: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
    period: [currentPeriod(), Validators.required],
  });

  protected readonly memberOptions = computed<SelectOption[]>(() =>
    this.members().map((member) => ({
      value: member.id,
      label: `${member.fullName} (${member.memberCode})`,
    })),
  );

  protected readonly periodSelectOptions = computed<SelectOption[]>(() =>
    this.periodOptions().map((option) => ({
      value: option.value,
      label: option.label,
    })),
  );

  protected readonly isCash = computed(
    () => this.selectedMethod() === PaymentMethod.Efectivo,
  );

  protected readonly cashNote =
    'El pago en efectivo se registrará como aprobado directamente sin necesidad de revisión.';

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      const periods = this.periodOptions();
      const defaultPeriod = periods[0]?.value ?? currentPeriod();

      this.selectedMethod.set(PaymentMethod.Efectivo);
      this.form.reset({
        memberId: '',
        paymentMethod: PaymentMethod.Efectivo,
        amount: '',
        paidAt: new Date().toISOString().slice(0, 10),
        notes: '',
        period: defaultPeriod,
      });
    });

    this.form.controls.memberId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((memberId) => {
        const member = this.members().find((item) => item.id === memberId);
        if (!member) {
          return;
        }
        this.form.controls.amount.setValue(String(member.monthlyFee));
      });

    this.form.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method) => {
        this.selectedMethod.set(method as PaymentMethod);
      });
  }

  protected selectMethod(method: PaymentMethod): void {
    this.form.controls.paymentMethod.setValue(method);
    this.selectedMethod.set(method);
  }

  protected onMethodKeydown(event: KeyboardEvent, method: PaymentMethod): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectMethod(method);
    }
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const amount = Number(value.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      this.form.controls.amount.setErrors({ min: true });
      this.form.controls.amount.markAsTouched();
      return;
    }

    this.save.emit({
      memberId: value.memberId,
      period: value.period,
      amount,
      paymentMethod: value.paymentMethod as PaymentMethod,
      paidAt: new Date(`${value.paidAt}T12:00:00`).toISOString(),
      notes: value.notes.trim() || undefined,
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
    if (control.errors['min']) {
      return 'El monto debe ser mayor a cero';
    }
    return 'Valor inválido';
  }
}
