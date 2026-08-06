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
  take,
  tap,
} from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppLoading,
  AppModal,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../../shared/components';
import {
  AdminEstadoCuentaPeriodoOption,
  AdminEstadoCuentaViewModel,
  MedioPagoCuota,
  RegisterAdminPagoFormValue,
} from '../../../../core/interfaces/admin-cuota.interface';
import { FeeService } from '../../../../core/services/fee.service';
import { MemberService } from '../../../../core/services/member.service';
import { formatCuotaImporte, medioPagoIcon } from '../../../../core/mappers/admin-cuota.mapper';

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
    AppLoading,
  ],
  templateUrl: './register-payment-modal.html',
  styleUrl: './register-payment-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPaymentModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly feeService = inject(FeeService);
  private readonly memberService = inject(MemberService);
  private readonly socioSelected$ = new Subject<string>();

  readonly open = input(false);
  /** Optional cuota id to resolve socio + preselect its period. */
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
  protected readonly sociosLoading = signal(false);
  protected readonly sociosError = signal('');
  protected readonly socioOptions = signal<SelectOption[]>([]);
  protected readonly accountLoading = signal(false);
  protected readonly accountError = signal('');
  protected readonly account = signal<AdminEstadoCuentaViewModel | null>(null);
  protected readonly selectedPeriodos = signal<string[]>([]);
  protected readonly selectedSocioId = signal('');
  private preselectedPeriod = '';

  protected readonly form = this.fb.nonNullable.group({
    socioId: ['', Validators.required],
    paymentMethod: ['EFECTIVO' as MedioPagoCuota, Validators.required],
    paidAt: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  });

  protected readonly periodosPagables = computed(
    () => this.account()?.periodosPagables ?? [],
  );

  protected readonly hasPagables = computed(() => this.periodosPagables().length > 0);

  protected readonly selectedTotalLabel = computed(() => {
    const selected = new Set(this.selectedPeriodos());
    const total = this.periodosPagables()
      .filter((item) => selected.has(item.periodo))
      .reduce((sum, item) => sum + item.importe, 0);
    return formatCuotaImporte(total);
  });

  protected readonly isCash = computed(
    () => this.selectedMethod() === 'EFECTIVO' || this.selectedMethod() === 'VENTANILLA',
  );

  protected readonly cashNote =
    'El pago en efectivo o ventanilla se registrará como aprobado directamente sin necesidad de revisión.';

  protected readonly submitDisabled = computed(
    () =>
      this.submitting() ||
      this.sociosLoading() ||
      this.accountLoading() ||
      !this.selectedSocioId() ||
      this.selectedPeriodos().length === 0 ||
      !!this.accountError() ||
      !this.hasPagables(),
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.resetModalState();
      this.loadSociosAndMaybePreselect();
    });

    this.form.controls.socioId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((socioId) => {
        this.selectedSocioId.set(socioId);
        this.selectedPeriodos.set([]);
        this.socioSelected$.next(socioId);
      });

    this.form.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method) => {
        this.selectedMethod.set(method as MedioPagoCuota);
      });

    this.socioSelected$
      .pipe(
        tap(() => {
          this.account.set(null);
          this.accountError.set('');
        }),
        switchMap((socioId) => {
          if (!socioId) {
            this.accountLoading.set(false);
            return EMPTY;
          }

          this.accountLoading.set(true);
          return this.feeService.getAdminEstadoCuenta(socioId).pipe(
            finalize(() => this.accountLoading.set(false)),
            catchError(() => {
              this.accountError.set(
                'No se pudo cargar el estado de cuenta del socio seleccionado.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((account) => {
        if (!account) {
          return;
        }

        this.account.set(account);

        if (
          this.preselectedPeriod &&
          account.periodosPagables.some((item) => item.periodo === this.preselectedPeriod)
        ) {
          this.selectedPeriodos.set([this.preselectedPeriod]);
        }
      });
  }

  protected togglePeriodo(option: AdminEstadoCuentaPeriodoOption): void {
    const current = this.selectedPeriodos();
    if (current.includes(option.periodo)) {
      this.selectedPeriodos.set(current.filter((item) => item !== option.periodo));
      return;
    }
    this.selectedPeriodos.set([...current, option.periodo].sort());
  }

  protected isPeriodoSelected(periodo: string): boolean {
    return this.selectedPeriodos().includes(periodo);
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
    const periodos = this.selectedPeriodos();
    if (!value.socioId || periodos.length === 0) {
      this.accountError.set('Seleccioná al menos un período pagable.');
      return;
    }

    this.save.emit({
      socioId: value.socioId,
      periodos,
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

  private resetModalState(): void {
    this.selectedMethod.set('EFECTIVO');
    this.sociosError.set('');
    this.accountError.set('');
    this.account.set(null);
    this.selectedPeriodos.set([]);
    this.selectedSocioId.set('');
    this.preselectedPeriod = '';
    this.form.reset({
      socioId: '',
      paymentMethod: 'EFECTIVO',
      paidAt: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  }

  private loadSociosAndMaybePreselect(): void {
    this.sociosLoading.set(true);
    this.sociosError.set('');

    this.memberService
      .getAdminSocios()
      .pipe(
        take(1),
        finalize(() => this.sociosLoading.set(false)),
        catchError(() => {
          this.sociosError.set('No se pudieron cargar los socios.');
          this.socioOptions.set([]);
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((socios) => {
        if (!this.open()) {
          return;
        }

        this.socioOptions.set(
          socios.map((socio) => ({
            value: socio.id,
            label: `${socio.memberCode} · ${socio.fullName}`,
          })),
        );

        const preselectedCuotaId = this.preselectedCuotaId();
        if (!preselectedCuotaId) {
          return;
        }

        this.feeService
          .getAdminCuotaById(preselectedCuotaId)
          .pipe(
            take(1),
            catchError(() => {
              this.accountError.set(
                'No se pudo precargar la cuota seleccionada. Elegí el socio manualmente.',
              );
              return of(null);
            }),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe((detail) => {
            if (!this.open() || !detail?.socioId) {
              return;
            }
            this.preselectedPeriod = detail.period;
            this.form.controls.socioId.setValue(detail.socioId);
          });
      });
  }
}
