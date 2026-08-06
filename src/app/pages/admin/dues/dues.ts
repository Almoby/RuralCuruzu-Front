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
import {
  EMPTY,
  Subject,
  catchError,
  finalize,
  forkJoin,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppSelect,
  AppTextarea,
  SelectOption,
} from '../../../shared/components';
import { FeeService } from '../../../core/services/fee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  AdminCuotaDetail,
  AdminCuotaFilter,
  AdminCuotaListItem,
  AdminCuotasResumenViewModel,
  AdminDatosBancariosViewModel,
  AdminEjecucionGeneracionViewModel,
  AdminReglaCuotaViewModel,
  RegisterAdminPagoFormValue,
  SocioCategoriaCuota,
} from '../../../core/interfaces/admin-cuota.interface';
import {
  currentAdminPeriod,
  formatCuotaImporte,
  mapReglaCuotaDtoToViewModel,
  matchesAdminCuotaFilter,
} from '../../../core/mappers/admin-cuota.mapper';
import { formatPeriodLabel } from '../../../shared/utils';
import { PaymentCard } from './payment-card/payment-card';
import { RegisterPaymentModal } from './register-payment-modal/register-payment-modal';

type DuesViewState = 'loading' | 'success' | 'empty' | 'error';
type ConfirmAction = 'generate' | 'approve';

interface FilterTab {
  value: AdminCuotaFilter;
  label: string;
  count: number;
}

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  tone: 'success' | 'warning' | 'primary';
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

@Component({
  selector: 'app-dues',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppButton,
    AppIcon,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppModal,
    AppInput,
    AppSelect,
    AppTextarea,
    AppConfirmDialog,
    PaymentCard,
    RegisterPaymentModal,
  ],
  templateUrl: './dues.html',
  styleUrl: './dues.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuesPage {
  private readonly feeService = inject(FeeService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly reload$ = new Subject<void>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly actionBusy = signal(false);
  protected readonly cuotas = signal<AdminCuotaListItem[]>([]);
  protected readonly summary = signal<AdminCuotasResumenViewModel | null>(null);
  protected readonly filter = signal<AdminCuotaFilter>('all');
  protected readonly paymentModalOpen = signal(false);
  protected readonly preselectedCuotaId = signal<string | null>(null);

  protected readonly confirmOpen = signal(false);
  protected readonly confirmAction = signal<ConfirmAction>('generate');
  protected readonly approveTarget = signal<AdminCuotaListItem | null>(null);
  protected readonly generatePeriod = signal(currentAdminPeriod());

  protected readonly detailOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detail = signal<AdminCuotaDetail | null>(null);
  protected readonly downloadBusyPagoId = signal<string | null>(null);

  protected readonly ejecucionesOpen = signal(false);
  protected readonly ejecucionesLoading = signal(false);
  protected readonly ejecucionesError = signal(false);
  protected readonly ejecuciones = signal<AdminEjecucionGeneracionViewModel[]>([]);

  protected readonly rejectOpen = signal(false);
  protected readonly rejectTarget = signal<AdminCuotaListItem | null>(null);
  protected readonly rejectForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(1)]],
  });

  protected readonly reglasOpen = signal(false);
  protected readonly reglasLoading = signal(false);
  protected readonly reglasSaving = signal(false);
  protected readonly reglas = signal<AdminReglaCuotaViewModel[]>([]);
  protected readonly reglaForm = this.fb.nonNullable.group({
    categoria: ['ACTIVO' as SocioCategoriaCuota, Validators.required],
    nombre: ['', Validators.required],
    importe: ['', [Validators.required, Validators.min(0.01)]],
    diaVencimiento: ['', [Validators.required, Validators.min(1), Validators.max(31)]],
  });

  protected readonly bankOpen = signal(false);
  protected readonly bankLoading = signal(false);
  protected readonly bankSaving = signal(false);
  protected readonly bankData = signal<AdminDatosBancariosViewModel | null>(null);
  protected readonly bankForm = this.fb.nonNullable.group({
    banco: ['', Validators.required],
    cbu: ['', Validators.required],
    alias: ['', Validators.required],
    titular: ['', Validators.required],
    cuit: ['', Validators.required],
  });

  protected readonly categoriaOptions: SelectOption[] = [
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'ADHERENTE', label: 'Adherente' },
  ];

  protected readonly filterTabs = computed<FilterTab[]>(() => {
    const summary = this.summary();
    return [
      { value: 'all', label: 'Todos', count: summary?.totalCount ?? 0 },
      { value: 'pending', label: 'Pendientes', count: summary?.pendingCount ?? 0 },
      { value: 'approved', label: 'Aprobados', count: summary?.approvedCount ?? 0 },
      { value: 'rejected', label: 'Rechazados', count: summary?.rejectedCount ?? 0 },
    ];
  });

  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const summary = this.summary();
    return [
      {
        label: 'Total cobrado',
        value: formatCuotaImporte(summary?.collectedAmount ?? 0),
        icon: 'banknote',
        tone: 'success',
      },
      {
        label: 'En revisión',
        value: formatCuotaImporte(summary?.inReviewAmount ?? 0),
        icon: 'clock',
        tone: 'warning',
      },
      {
        label: 'Cobrado en efectivo',
        value: formatCuotaImporte(summary?.cashCollectedAmount ?? 0),
        icon: 'check_circle',
        tone: 'primary',
      },
    ];
  });

  protected readonly filteredPayments = computed(() => {
    const filter = this.filter();
    return this.cuotas().filter((item) => matchesAdminCuotaFilter(item, filter));
  });

  protected readonly viewState = computed<DuesViewState>(() => {
    if (this.loading()) {
      return 'loading';
    }
    if (this.loadError()) {
      return 'error';
    }
    if (this.filteredPayments().length === 0) {
      return 'empty';
    }
    return 'success';
  });

  protected readonly confirmTitle = computed(() =>
    this.confirmAction() === 'generate' ? 'Generar cuotas' : 'Aprobar pago',
  );

  protected readonly confirmMessage = computed(() => {
    if (this.confirmAction() === 'generate') {
      return `¿Deseás generar las cuotas correspondientes a ${formatPeriodLabel(this.generatePeriod())}?`;
    }
    const target = this.approveTarget();
    if (!target) {
      return '¿Confirmás aprobar el pago informado?';
    }
    return `¿Aprobar el pago informado de ${target.memberName} (${target.memberCode})?`;
  });

  protected readonly confirmLabel = computed(() => {
    if (this.confirmAction() === 'generate') {
      return this.submitting() ? 'Generando...' : 'Generar cuotas';
    }
    return this.actionBusy() ? 'Aprobando...' : 'Aprobar';
  });

  protected readonly formatPeriodLabel = formatPeriodLabel;

  constructor() {
    this.reglaForm.controls.categoria.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const categoria: SocioCategoriaCuota = value === 'ADHERENTE' ? 'ADHERENTE' : 'ACTIVO';
        this.applyReglaToForm(categoria);
      });

    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(false);
        }),
        switchMap(() =>
          forkJoin({
            cuotas: this.feeService.getAdminCuotas(),
            resumen: this.feeService.getAdminCuotasResumen(),
          }).pipe(
            catchError((error: unknown) => {
              this.loadError.set(true);
              this.loading.set(false);
              if (this.cuotas().length === 0) {
                this.cuotas.set([]);
                this.summary.set(null);
              }
              this.notifications.error(
                isApiError(error) ? error.message : 'No se pudieron cargar las cuotas',
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ cuotas, resumen }) => {
        this.cuotas.set(cuotas);
        this.summary.set(resumen);
        this.loading.set(false);
        this.loadError.set(false);
      });
  }

  protected setFilter(filter: AdminCuotaFilter): void {
    this.filter.set(filter);
  }

  protected openPaymentModal(cuota?: AdminCuotaListItem): void {
    this.preselectedCuotaId.set(cuota?.id ?? null);
    this.paymentModalOpen.set(true);
  }

  protected closePaymentModal(): void {
    if (this.submitting()) {
      return;
    }
    this.paymentModalOpen.set(false);
    this.preselectedCuotaId.set(null);
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected askGenerateFees(): void {
    this.generatePeriod.set(currentAdminPeriod());
    this.confirmAction.set('generate');
    this.confirmOpen.set(true);
  }

  protected onConfirmCancel(): void {
    if (this.submitting() || this.actionBusy()) {
      return;
    }
    this.confirmOpen.set(false);
    this.approveTarget.set(null);
  }

  protected onConfirmAccept(): void {
    if (this.confirmAction() === 'generate') {
      this.executeGenerateFees();
      return;
    }
    this.executeApprovePayment();
  }

  protected registerPayment(payload: RegisterAdminPagoFormValue): void {
    if (this.submitting()) {
      return;
    }

    if (!payload.socioId || payload.periodos.length === 0) {
      this.notifications.error('Seleccioná un socio y al menos un período.');
      return;
    }

    this.submitting.set(true);
    this.feeService
      .registerAdminPago({
        socioId: payload.socioId,
        periodos: payload.periodos,
        fecha: payload.fecha,
        medioPago: payload.medioPago,
        observacion: payload.observacion,
        comprobante: payload.comprobante,
      })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.paymentModalOpen.set(false);
          this.preselectedCuotaId.set(null);
          this.notifications.success(
            result.mensaje?.trim() || 'Pago registrado y marcado como abonado',
          );
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo registrar el pago',
          );
        },
      });
  }

  protected downloadComprobanteFromList(item: AdminCuotaListItem): void {
    const pagoId = item.pagoId;
    if (!pagoId || !item.canDownloadComprobante) {
      return;
    }
    this.downloadComprobante(pagoId);
  }

  protected downloadComprobanteFromDetail(): void {
    const pago = this.detail()?.pago;
    if (!pago?.id || !pago.canDownloadComprobante) {
      return;
    }
    this.downloadComprobante(pago.id);
  }

  protected openEjecuciones(): void {
    this.ejecucionesOpen.set(true);
    this.loadEjecuciones();
  }

  protected closeEjecuciones(): void {
    this.ejecucionesOpen.set(false);
    this.ejecucionesError.set(false);
  }

  protected retryEjecuciones(): void {
    this.loadEjecuciones();
  }

  protected openDetail(item: AdminCuotaListItem): void {
    this.detailOpen.set(true);
    this.detail.set(null);
    this.detailLoading.set(true);

    this.feeService
      .getAdminCuotaById(item.id)
      .pipe(
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => this.detail.set(detail),
        error: (error: unknown) => {
          this.detailOpen.set(false);
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo cargar el detalle de la cuota',
          );
        },
      });
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detail.set(null);
  }

  protected askApprovePayment(item: AdminCuotaListItem): void {
    if (this.actionBusy()) {
      return;
    }
    this.approveTarget.set(item);
    this.confirmAction.set('approve');
    this.confirmOpen.set(true);
  }

  protected openReject(item: AdminCuotaListItem): void {
    this.rejectTarget.set(item);
    this.rejectForm.reset({ motivo: '' });
    this.rejectOpen.set(true);
  }

  protected closeReject(options?: { force?: boolean }): void {
    if (!options?.force && this.actionBusy()) {
      return;
    }
    this.rejectOpen.set(false);
    this.rejectTarget.set(null);
    this.rejectForm.reset({ motivo: '' });
    this.rejectForm.markAsPristine();
    this.rejectForm.markAsUntouched();
  }

  protected confirmReject(): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }

    const target = this.rejectTarget();
    if (!target || this.actionBusy()) {
      return;
    }

    const motivo = this.rejectForm.controls.motivo.value.trim();
    this.actionBusy.set(true);
    this.feeService
      .rejectAdminPago(target.id, motivo)
      .pipe(
        finalize(() => this.actionBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.notifications.success(result.mensaje?.trim() || 'Pago rechazado');
          this.closeReject({ force: true });
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo rechazar el pago',
          );
        },
      });
  }

  protected openReglas(): void {
    this.reglasOpen.set(true);
    this.loadReglas();
  }

  protected closeReglas(): void {
    if (this.reglasSaving()) {
      return;
    }
    this.reglasOpen.set(false);
    this.reglaForm.markAsPristine();
    this.reglaForm.markAsUntouched();
  }

  protected saveRegla(): void {
    if (this.reglaForm.invalid || this.reglasSaving()) {
      this.reglaForm.markAllAsTouched();
      return;
    }

    const value = this.reglaForm.getRawValue();
    const importe = Number(value.importe);
    const diaVencimiento = Number(value.diaVencimiento);
    if (!Number.isFinite(importe) || !Number.isFinite(diaVencimiento)) {
      this.notifications.error('Importe o día de vencimiento inválidos');
      return;
    }

    const categoria: SocioCategoriaCuota =
      value.categoria === 'ADHERENTE' ? 'ADHERENTE' : 'ACTIVO';
    const requestBody = {
      nombre: value.nombre.trim(),
      importe,
      diaVencimiento,
    };

    this.reglasSaving.set(true);
    this.feeService
      .updateAdminReglaCuota(categoria, requestBody)
      .pipe(
        switchMap((putResult) =>
          this.feeService.getAdminReglasCuota().pipe(
            map((reglas) => {
              const fromPut = putResult.regla
                ? mapReglaCuotaDtoToViewModel({
                    ...putResult.regla,
                    categoriaAplicable:
                      putResult.regla.categoriaAplicable ?? categoria,
                  })
                : null;

              let synced = [...reglas];
              if (fromPut) {
                const index = synced.findIndex((item) => item.categoria === fromPut.categoria);
                if (index >= 0) {
                  synced = synced.map((item, i) => (i === index ? fromPut : item));
                } else {
                  synced = [...synced, fromPut];
                }
              }

              return { putResult, requestBody, categoria, synced, fromPut };
            }),
          ),
        ),
        finalize(() => this.reglasSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ putResult, requestBody, categoria, synced, fromPut }) => {
          this.reglas.set(synced);
          this.reglaForm.controls.categoria.setValue(categoria, { emitEvent: false });
          this.applyReglaToForm(categoria);

          const persisted = synced.find((item) => item.categoria === categoria) ?? fromPut;
          const matchesRequest =
            !!persisted &&
            persisted.importe === requestBody.importe &&
            persisted.diaVencimiento === requestBody.diaVencimiento &&
            persisted.nombre === requestBody.nombre;

          if (!matchesRequest) {
            this.notifications.error(
              'El backend no persistió la configuración enviada. Revisá Network: PUT/GET /admin/reglas-cuota.',
            );
            return;
          }

          this.notifications.success(
            putResult.mensaje?.trim() || 'Configuración de cuotas actualizada',
          );
          this.reglasOpen.set(false);
          this.reglaForm.markAsPristine();
          this.reglaForm.markAsUntouched();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo guardar la configuración de cuotas',
          );
        },
      });
  }

  protected openBank(): void {
    this.bankOpen.set(true);
    this.loadBank();
  }

  protected closeBank(options?: { force?: boolean }): void {
    if (!options?.force && this.bankSaving()) {
      return;
    }
    this.bankOpen.set(false);
    this.bankForm.markAsPristine();
    this.bankForm.markAsUntouched();
  }

  protected saveBank(): void {
    if (this.bankForm.invalid || this.bankSaving()) {
      this.bankForm.markAllAsTouched();
      return;
    }

    const value = this.bankForm.getRawValue();
    this.bankSaving.set(true);
    this.feeService
      .updateAdminDatosBancarios({
        banco: value.banco.trim(),
        cbu: value.cbu.trim(),
        alias: value.alias.trim(),
        titular: value.titular.trim(),
        cuit: value.cuit.trim(),
      })
      .pipe(
        finalize(() => this.bankSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.notifications.success(result.mensaje?.trim() || 'Datos bancarios actualizados');
          this.closeBank({ force: true });
          this.loadBank();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudieron guardar los datos bancarios',
          );
        },
      });
  }

  protected fieldError(
    form: 'reject' | 'regla' | 'bank',
    controlName: string,
  ): string {
    let control = null;
    if (form === 'reject') {
      control = this.rejectForm.get(controlName);
    } else if (form === 'regla') {
      control = this.reglaForm.get(controlName);
    } else {
      control = this.bankForm.get(controlName);
    }

    if (!control || !control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'Campo obligatorio';
    }
    if (control.errors['min'] || control.errors['max']) {
      return 'Valor fuera de rango';
    }
    return 'Valor inválido';
  }

  private executeGenerateFees(): void {
    if (this.submitting()) {
      return;
    }

    const periodo = this.generatePeriod();
    this.submitting.set(true);
    this.feeService
      .generateAdminCuotas(periodo)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.confirmOpen.set(false);
          const generated = result.cantidadCuotasGeneradas ?? 0;
          const omitted = result.cantidadSociosOmitidos ?? 0;
          const periodoLabel = formatPeriodLabel(
            result.periodo?.trim() || this.generatePeriod(),
          );

          if (generated > 0) {
            this.notifications.success(
              `Se generaron correctamente ${generated} cuotas para el período ${periodoLabel}.`,
            );
          } else if (omitted === 0) {
            this.notifications.info(
              `No se generaron nuevas cuotas porque las cuotas del período ${periodoLabel} ya habían sido generadas previamente.`,
            );
          } else {
            this.notifications.info(
              `No se generaron nuevas cuotas para el período ${periodoLabel}.`,
            );
          }

          if (omitted > 0) {
            this.notifications.info(
              `${omitted} socios fueron omitidos por falta de configuración o regla de cuota.`,
            );
          }

          this.reload$.next();
          if (this.ejecucionesOpen()) {
            this.loadEjecuciones();
          }
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudieron generar las cuotas',
          );
        },
      });
  }

  private downloadComprobante(pagoId: string): void {
    if (this.downloadBusyPagoId()) {
      return;
    }

    this.downloadBusyPagoId.set(pagoId);
    this.feeService
      .downloadAdminComprobante(pagoId)
      .pipe(
        finalize(() => this.downloadBusyPagoId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file.blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = file.fileName;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo descargar el comprobante',
          );
        },
      });
  }

  private loadEjecuciones(): void {
    this.ejecucionesLoading.set(true);
    this.ejecucionesError.set(false);
    this.feeService
      .getAdminEjecuciones()
      .pipe(
        finalize(() => this.ejecucionesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => this.ejecuciones.set(items),
        error: (error: unknown) => {
          this.ejecucionesError.set(true);
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cargar el historial de generación',
          );
        },
      });
  }

  private executeApprovePayment(): void {
    const target = this.approveTarget();
    if (!target || this.actionBusy()) {
      return;
    }

    this.actionBusy.set(true);
    this.feeService
      .approveAdminPago(target.id)
      .pipe(
        finalize(() => this.actionBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.confirmOpen.set(false);
          this.approveTarget.set(null);
          this.notifications.success(result.mensaje?.trim() || 'Pago aprobado');
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo aprobar el pago',
          );
        },
      });
  }

  private loadReglas(): void {
    this.reglasLoading.set(true);
    this.feeService
      .getAdminReglasCuota()
      .pipe(
        finalize(() => this.reglasLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reglas) => {
          this.reglas.set(reglas);
          const current =
            this.reglaForm.controls.categoria.value === 'ADHERENTE' ? 'ADHERENTE' : 'ACTIVO';
          const hasCurrent = reglas.some((item) => item.categoria === current);
          const categoria = hasCurrent
            ? current
            : (reglas[0]?.categoria ?? 'ACTIVO');
          this.reglaForm.controls.categoria.setValue(categoria, { emitEvent: false });
          this.applyReglaToForm(categoria);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cargar la configuración de cuotas',
          );
        },
      });
  }

  private applyReglaToForm(categoria: SocioCategoriaCuota): void {
    const regla = this.reglas().find((item) => item.categoria === categoria);
    this.reglaForm.patchValue(
      {
        nombre: regla && regla.nombre !== 'No informado' ? regla.nombre : '',
        importe: regla ? String(regla.importe) : '',
        diaVencimiento: regla ? String(regla.diaVencimiento) : '',
      },
      { emitEvent: false },
    );
  }

  private loadBank(): void {
    this.bankLoading.set(true);
    this.feeService
      .getAdminDatosBancarios()
      .pipe(
        finalize(() => this.bankLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.bankData.set(data);
          this.applyBankToForm(data);
        },
        error: (error: unknown) => {
          if (isApiError(error) && error.status === 404) {
            this.bankData.set(null);
            this.bankForm.reset({
              banco: '',
              cbu: '',
              alias: '',
              titular: '',
              cuit: '',
            });
            return;
          }
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudieron cargar los datos bancarios',
          );
        },
      });
  }

  private applyBankToForm(data: AdminDatosBancariosViewModel): void {
    this.bankForm.reset({
      banco: data.banco === 'No informado' ? '' : data.banco,
      cbu: data.cbu === 'No informado' ? '' : data.cbu,
      alias: data.alias === 'No informado' ? '' : data.alias,
      titular: data.titular === 'No informado' ? '' : data.titular,
      cuit: data.cuit === 'No informado' ? '' : data.cuit,
    });
  }
}
