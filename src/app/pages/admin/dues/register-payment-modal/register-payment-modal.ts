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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EMPTY,
  Subject,
  catchError,
  finalize,
  of,
  startWith,
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
  AdminReglaCuotaViewModel,
  MedioPagoCuota,
  RegisterAdminPagoFormValue,
} from '../../../../core/interfaces/admin-cuota.interface';
import { AdminMember } from '../../../../core/interfaces/admin-socio.interface';
import { FeeService } from '../../../../core/services/fee.service';
import { MemberService } from '../../../../core/services/member.service';
import {
  collectAvailableAdvancePeriods,
  formatCuotaImporte,
  isValidPeriodoYyyyMm,
  medioPagoIcon,
  nextPeriodoYyyyMm,
} from '../../../../core/mappers/admin-cuota.mapper';
import { formatPeriodLabel } from '../../../../shared/utils';
import { MemberCategory } from '../../../../shared/enums';

interface MethodChoice {
  value: MedioPagoCuota;
  label: string;
  icon: string;
}

interface AdvanceChip {
  periodo: string;
  periodoLabel: string;
}

const ADVANCE_MAX_MONTHS = 12;
const ADVANCE_SCAN_LIMIT = 48;

const ADVANCE_COUNT_OPTIONS: SelectOption[] = Array.from(
  { length: ADVANCE_MAX_MONTHS },
  (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
  },
);

function nextCalendarPeriod(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthsButtonLabel(count: number): string {
  return count === 1 ? 'Agregar 1 mes' : `Agregar ${count} meses`;
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

  protected readonly advanceCountOptions = ADVANCE_COUNT_OPTIONS;

  protected readonly selectedMethod = signal<MedioPagoCuota>('EFECTIVO');
  protected readonly sociosLoading = signal(false);
  protected readonly sociosError = signal('');
  protected readonly socioOptions = signal<SelectOption[]>([]);
  protected readonly sociosById = signal<Map<string, AdminMember>>(new Map());
  protected readonly accountLoading = signal(false);
  protected readonly accountError = signal('');
  protected readonly account = signal<AdminEstadoCuentaViewModel | null>(null);
  protected readonly selectedPeriodos = signal<string[]>([]);
  /** Advance months committed into the selection (shown as chips). */
  protected readonly advancePeriodos = signal<string[]>([]);
  protected readonly selectedSocioId = signal('');
  protected readonly activoRegla = signal<AdminReglaCuotaViewModel | null>(null);
  protected readonly advanceHint = signal('');
  private preselectedPeriod = '';

  protected readonly form = this.fb.nonNullable.group({
    socioId: ['', Validators.required],
    paymentMethod: ['EFECTIVO' as MedioPagoCuota, Validators.required],
    paidAt: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
    advanceCount: ['1'],
  });

  private readonly advanceCountValue = toSignal(
    this.form.controls.advanceCount.valueChanges.pipe(
      startWith(this.form.controls.advanceCount.value),
    ),
    { initialValue: this.form.controls.advanceCount.value },
  );

  protected readonly periodosPagables = computed(
    () => this.account()?.periodosPagables ?? [],
  );

  protected readonly hasPagables = computed(() => this.periodosPagables().length > 0);

  protected readonly selectedSocio = computed(() => {
    const id = this.selectedSocioId();
    return id ? (this.sociosById().get(id) ?? null) : null;
  });

  protected readonly isActivoSocio = computed(
    () => this.selectedSocio()?.category === MemberCategory.Activo,
  );

  protected readonly showAdvanceSection = computed(
    () => !!this.account() && this.isActivoSocio(),
  );

  protected readonly showAdherenteAdvanceHint = computed(
    () => !!this.account() && !this.isActivoSocio() && !!this.selectedSocio(),
  );

  /** Periods that already exist on the account (any state) or are already selected. */
  protected readonly blockedPeriodos = computed(() => {
    const blocked = new Set<string>();
    for (const cuota of this.account()?.cuotas ?? []) {
      const period = cuota.period?.trim() ?? '';
      if (isValidPeriodoYyyyMm(period)) {
        blocked.add(period);
      }
    }
    for (const periodo of this.selectedPeriodos()) {
      blocked.add(periodo);
    }
    return blocked;
  });

  protected readonly requestedAdvanceCount = computed(() => {
    const parsed = this.parseAdvanceCount(this.advanceCountValue());
    return parsed > 0 ? parsed : 1;
  });

  protected readonly addAdvanceLabel = computed(() =>
    addMonthsButtonLabel(this.requestedAdvanceCount()),
  );

  protected readonly canAddAdvanceMonths = computed(() => !this.submitting());

  protected readonly advanceChips = computed((): AdvanceChip[] =>
    [...this.advancePeriodos()]
      .sort((a, b) => a.localeCompare(b))
      .map((periodo) => ({
        periodo,
        periodoLabel: formatPeriodLabel(periodo),
      })),
  );

  protected readonly selectedTotalLabel = computed(() => {
    const selected = new Set(this.selectedPeriodos());
    const pendingTotal = this.periodosPagables()
      .filter((item) => selected.has(item.periodo))
      .reduce((sum, item) => sum + item.importe, 0);

    const advanceCount = this.advancePeriodos().filter((periodo) =>
      selected.has(periodo),
    ).length;
    const reglaImporte = this.activoRegla()?.importe;
    const hasRegla =
      typeof reglaImporte === 'number' && Number.isFinite(reglaImporte) && reglaImporte >= 0;

    if (advanceCount === 0) {
      return formatCuotaImporte(pendingTotal);
    }

    // Advance months use the same vigente rule the POST applies when generating
    // missing periods (Swagger registrarPago). Show the definitive total, not an estimate.
    if (!hasRegla) {
      return pendingTotal > 0
        ? `${formatCuotaImporte(pendingTotal)} + períodos futuros (regla vigente)`
        : 'Períodos futuros (monto según regla vigente)';
    }

    const total = pendingTotal + advanceCount * reglaImporte;
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
      !!this.accountError(),
  );

  protected readonly submitLabel = computed(() => {
    if (this.submitting()) {
      return 'Registrando pago...';
    }
    if (this.accountLoading() || this.sociosLoading()) {
      return 'Cargando...';
    }
    return 'Registrar y marcar como abonado';
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.resetModalState();
      this.loadSociosAndMaybePreselect();
      this.loadActivoRegla();
    });

    effect(() => {
      const busy = this.submitting();
      if (!this.open()) {
        return;
      }
      if (busy) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });

    this.form.controls.socioId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((socioId) => {
        this.selectedSocioId.set(socioId);
        this.selectedPeriodos.set([]);
        this.advancePeriodos.set([]);
        this.advanceHint.set('');
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
    if (this.submitting()) {
      return;
    }
    const current = this.selectedPeriodos();
    if (current.includes(option.periodo)) {
      this.selectedPeriodos.set(current.filter((item) => item !== option.periodo));
      return;
    }
    this.selectedPeriodos.set(
      [...current, option.periodo].sort((a, b) => a.localeCompare(b)),
    );
  }

  protected isPeriodoSelected(periodo: string): boolean {
    return this.selectedPeriodos().includes(periodo);
  }

  protected addAdvanceMonths(): void {
    if (this.submitting()) {
      return;
    }
    if (!this.isActivoSocio()) {
      this.advanceHint.set(
        'Los pagos adelantados de períodos futuros están disponibles para socios activos.',
      );
      return;
    }

    const requested = this.parseAdvanceCount(this.form.controls.advanceCount.value);
    if (requested < 1) {
      this.advanceHint.set('Seleccioná cuántos meses querés adelantar.');
      return;
    }

    const start = this.resolveFirstAdvancePeriod();
    if (!isValidPeriodoYyyyMm(start)) {
      this.advanceHint.set('No hay meses disponibles para agregar.');
      return;
    }

    const generated = collectAvailableAdvancePeriods(
      start,
      requested,
      this.blockedPeriodos(),
      ADVANCE_SCAN_LIMIT,
    );

    if (generated.length === 0) {
      this.advanceHint.set('No hay meses disponibles para agregar.');
      return;
    }

    const nextSelected = [...this.selectedPeriodos(), ...generated].sort((a, b) =>
      a.localeCompare(b),
    );
    const nextAdvance = [...new Set([...this.advancePeriodos(), ...generated])].sort(
      (a, b) => a.localeCompare(b),
    );

    this.selectedPeriodos.set(nextSelected);
    this.advancePeriodos.set(nextAdvance);

    if (generated.length < requested) {
      this.advanceHint.set(
        `Se agregaron ${generated.length} de los ${requested} meses seleccionados porque algunos períodos ya estaban registrados o pagados.`,
      );
    } else {
      this.advanceHint.set('');
    }
  }

  protected removeAdvancePeriod(periodo: string): void {
    if (this.submitting()) {
      return;
    }
    this.advancePeriodos.set(
      this.advancePeriodos().filter((item) => item !== periodo),
    );
    this.selectedPeriodos.set(
      this.selectedPeriodos().filter((item) => item !== periodo),
    );
    this.advanceHint.set('');
  }

  protected selectMethod(method: MedioPagoCuota): void {
    if (this.submitting()) {
      return;
    }
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
    const periodos = [...new Set(this.selectedPeriodos())]
      .filter(isValidPeriodoYyyyMm)
      .sort((a, b) => a.localeCompare(b));

    if (!value.socioId || periodos.length === 0) {
      this.accountError.set('Seleccioná al menos un período.');
      return;
    }

    const advanceOnly = periodos.filter((periodo) =>
      this.advancePeriodos().includes(periodo),
    );
    if (advanceOnly.length > 0 && !this.isActivoSocio()) {
      this.accountError.set(
        'Los pagos adelantados de períodos futuros están disponibles para socios activos.',
      );
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

  /**
   * First future month available to advance:
   * - next month after the latest existing/selected period; or
   * - next calendar month when the account has no cuotas yet;
   * then skip months already paid/registered/selected.
   */
  private resolveFirstAdvancePeriod(): string {
    const account = this.account();
    const knownPeriods: string[] = [];

    for (const cuota of account?.cuotas ?? []) {
      const period = cuota.period?.trim() ?? '';
      if (isValidPeriodoYyyyMm(period)) {
        knownPeriods.push(period);
      }
    }
    for (const periodo of this.selectedPeriodos()) {
      if (isValidPeriodoYyyyMm(periodo)) {
        knownPeriods.push(periodo);
      }
    }

    let candidate =
      knownPeriods.length === 0
        ? nextCalendarPeriod()
        : nextPeriodoYyyyMm(
            [...knownPeriods].sort((a, b) => a.localeCompare(b)).at(-1) ??
              nextCalendarPeriod(),
          );

    const blocked = this.blockedPeriodos();
    for (let i = 0; i < ADVANCE_SCAN_LIMIT; i += 1) {
      if (!blocked.has(candidate)) {
        return candidate;
      }
      candidate = nextPeriodoYyyyMm(candidate);
    }

    return candidate;
  }

  private parseAdvanceCount(raw: string): number {
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 1 || count > ADVANCE_MAX_MONTHS) {
      return 0;
    }
    return count;
  }

  private resetModalState(): void {
    this.selectedMethod.set('EFECTIVO');
    this.sociosError.set('');
    this.accountError.set('');
    this.account.set(null);
    this.selectedPeriodos.set([]);
    this.advancePeriodos.set([]);
    this.advanceHint.set('');
    this.selectedSocioId.set('');
    this.preselectedPeriod = '';
    this.form.reset({
      socioId: '',
      paymentMethod: 'EFECTIVO',
      paidAt: new Date().toISOString().slice(0, 10),
      notes: '',
      advanceCount: '1',
    });
    this.form.enable({ emitEvent: false });
  }

  private loadActivoRegla(): void {
    this.feeService
      .getAdminReglaCuotaByCategoria('ACTIVO')
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((regla) => {
        this.activoRegla.set(regla);
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
          this.sociosById.set(new Map());
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((socios) => {
        if (!this.open()) {
          return;
        }

        const byId = new Map<string, AdminMember>();
        for (const socio of socios) {
          byId.set(socio.id, socio);
        }
        this.sociosById.set(byId);
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
