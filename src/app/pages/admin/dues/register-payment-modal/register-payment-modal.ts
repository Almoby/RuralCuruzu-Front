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
  EMPTY,
  Subject,
  catchError,
  finalize,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppModal,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../../shared/components';
import {
  AdminCuotaListItem,
  MedioPagoCuota,
  RegisterAdminPagoFormValue,
} from '../../../../core/interfaces/admin-cuota.interface';
import { FeeService } from '../../../../core/services/fee.service';
import {
  canRegisterPayment,
  formatCuotaImporte,
  formatCuotaOptionLabel,
  medioPagoIcon,
} from '../../../../core/mappers/admin-cuota.mapper';
import { formatPeriodLabel } from '../../../../shared/utils';

interface MethodChoice {
  value: MedioPagoCuota;
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
    AppEmptyState,
    AppAlert,
  ],
  templateUrl: './register-payment-modal.html',
  styleUrl: './register-payment-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPaymentModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feeService = inject(FeeService);
  private readonly cuotaSelected$ = new Subject<string>();

  readonly open = input(false);
  /** Eligible cuotas only (PENDIENTE | VENCIDA). */
  readonly cuotas = input<AdminCuotaListItem[]>([]);
  readonly preselectedCuotaId = input<string | null>(null);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<RegisterAdminPagoFormValue>();

  protected readonly methodChoices: MethodChoice[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: medioPagoIcon('EFECTIVO') },
    { value: 'VENTANILLA', label: 'Ventanilla', icon: medioPagoIcon('VENTANILLA') },
    { value: 'TRANSFERENCIA', label: 'Transferencia', icon: medioPagoIcon('TRANSFERENCIA') },
    { value: 'DEBITO', label: 'Débito', icon: medioPagoIcon('DEBITO') },
    { value: 'LINK_DE_PAGO', label: 'Link de pago', icon: medioPagoIcon('LINK_DE_PAGO') },
  ];

  protected readonly selectedMethod = signal<MedioPagoCuota>('EFECTIVO');
  protected readonly resolvingSocio = signal(false);
  protected readonly resolveError = signal('');
  protected readonly resolvedSocioId = signal('');
  private resolvedPeriod = '';
  private readonly selectedCuotaId = signal('');

  protected readonly form = this.fb.nonNullable.group({
    cuotaId: ['', Validators.required],
    paymentMethod: ['EFECTIVO' as MedioPagoCuota, Validators.required],
    amountDisplay: [{ value: '—', disabled: true }],
    periodDisplay: [{ value: '—', disabled: true }],
    estadoDisplay: [{ value: '—', disabled: true }],
    paidAt: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  protected readonly cuotaOptions = computed<SelectOption[]>(() =>
    this.cuotas()
      .filter((cuota) => canRegisterPayment(cuota))
      .map((cuota) => ({
        value: cuota.id,
        label: formatCuotaOptionLabel(cuota),
      })),
  );

  protected readonly hasEligibleCuotas = computed(() => this.cuotaOptions().length > 0);

  protected readonly isCash = computed(
    () => this.selectedMethod() === 'EFECTIVO' || this.selectedMethod() === 'VENTANILLA',
  );

  protected readonly cashNote =
    'El pago en efectivo o ventanilla se registrará como aprobado directamente sin necesidad de revisión.';

  protected readonly submitDisabled = computed(
    () =>
      this.submitting() ||
      this.resolvingSocio() ||
      !this.hasEligibleCuotas() ||
      !this.selectedCuotaId() ||
      !this.resolvedSocioId(),
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      const preselected = this.preselectedCuotaId();
      const options = this.cuotaOptions();
      const initialCuotaId =
        preselected && options.some((option) => option.value === preselected)
          ? preselected
          : '';

      this.selectedMethod.set('EFECTIVO');
      this.resolveError.set('');
      this.resolvedSocioId.set('');
      this.resolvedPeriod = '';
      this.selectedCuotaId.set(initialCuotaId);
      this.form.reset({
        cuotaId: initialCuotaId,
        paymentMethod: 'EFECTIVO',
        amountDisplay: '—',
        periodDisplay: '—',
        estadoDisplay: '—',
        paidAt: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      this.form.controls.amountDisplay.disable({ emitEvent: false });
      this.form.controls.periodDisplay.disable({ emitEvent: false });
      this.form.controls.estadoDisplay.disable({ emitEvent: false });

      if (initialCuotaId) {
        this.cuotaSelected$.next(initialCuotaId);
      }
    });

    this.form.controls.cuotaId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cuotaId) => {
        this.selectedCuotaId.set(cuotaId);
        this.cuotaSelected$.next(cuotaId);
      });

    this.form.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method) => {
        this.selectedMethod.set(method as MedioPagoCuota);
      });

    this.cuotaSelected$
      .pipe(
        tap((cuotaId) => this.prepareLocalCuotaFields(cuotaId)),
        switchMap((cuotaId) => {
          if (!cuotaId) {
            this.resolvingSocio.set(false);
            return EMPTY;
          }

          const cuota = this.cuotas().find((item) => item.id === cuotaId);
          if (!cuota || !canRegisterPayment(cuota)) {
            this.resolveError.set(
              'La cuota seleccionada no es elegible para registrar un pago.',
            );
            this.resolvingSocio.set(false);
            return EMPTY;
          }

          this.resolvingSocio.set(true);
          this.resolveError.set('');

          return this.feeService.getAdminCuotaById(cuotaId).pipe(
            finalize(() => this.resolvingSocio.set(false)),
            catchError(() => {
              this.resolvedSocioId.set('');
              this.resolvedPeriod = '';
              this.resolveError.set(
                'No se pudo obtener el detalle de la cuota seleccionada.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        if (!detail) {
          return;
        }

        if (!canRegisterPayment(detail) || !detail.socioId || !detail.period) {
          this.resolvedSocioId.set('');
          this.resolvedPeriod = '';
          this.resolveError.set(
            'La cuota ya no admite registro de pago. Actualizá el listado e intentá de nuevo.',
          );
          return;
        }

        this.resolvedSocioId.set(detail.socioId);
        this.resolvedPeriod = detail.period;
        this.form.controls.amountDisplay.setValue(detail.amountLabel, { emitEvent: false });
        this.form.controls.periodDisplay.setValue(formatPeriodLabel(detail.period), {
          emitEvent: false,
        });
        this.form.controls.estadoDisplay.setValue(detail.estadoLabel, { emitEvent: false });
      });
  }

  protected selectMethod(method: MedioPagoCuota): void {
    this.form.controls.paymentMethod.setValue(method);
    this.selectedMethod.set(method);
  }

  protected onMethodKeydown(event: KeyboardEvent, method: MedioPagoCuota): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectMethod(method);
    }
  }

  protected onClose(): void {
    if (this.submitting()) {
      return;
    }
    this.close.emit();
  }

  protected onSubmit(): void {
    if (this.submitDisabled()) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const cuota = this.cuotas().find((item) => item.id === value.cuotaId);
    const socioId = this.resolvedSocioId();
    if (!cuota || !canRegisterPayment(cuota) || !socioId || !this.resolvedPeriod) {
      this.resolveError.set(
        'La cuota seleccionada ya no admite registro de pago. Actualizá el listado e intentá de nuevo.',
      );
      return;
    }

    this.save.emit({
      cuotaId: cuota.id,
      socioId,
      periodos: [this.resolvedPeriod],
      fecha: value.paidAt,
      medioPago: value.paymentMethod as MedioPagoCuota,
      observacion: value.notes.trim() || undefined,
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

  private prepareLocalCuotaFields(cuotaId: string): void {
    this.resolvedSocioId.set('');
    this.resolvedPeriod = '';
    this.resolveError.set('');

    if (!cuotaId) {
      this.form.controls.amountDisplay.setValue('—', { emitEvent: false });
      this.form.controls.periodDisplay.setValue('—', { emitEvent: false });
      this.form.controls.estadoDisplay.setValue('—', { emitEvent: false });
      return;
    }

    const cuota = this.cuotas().find((item) => item.id === cuotaId);
    if (!cuota || !canRegisterPayment(cuota)) {
      this.form.controls.amountDisplay.setValue('—', { emitEvent: false });
      this.form.controls.periodDisplay.setValue('—', { emitEvent: false });
      this.form.controls.estadoDisplay.setValue('—', { emitEvent: false });
      return;
    }

    this.form.controls.amountDisplay.setValue(formatCuotaImporte(cuota.amount), {
      emitEvent: false,
    });
    this.form.controls.periodDisplay.setValue(
      cuota.period ? formatPeriodLabel(cuota.period) : 'Sin datos',
      { emitEvent: false },
    );
    this.form.controls.estadoDisplay.setValue(cuota.estadoLabel, { emitEvent: false });
  }
}
