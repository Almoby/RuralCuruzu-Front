import { BadgeVariant } from '../../shared/components';
import { formatPeriodLabel } from '../../shared/utils';
import {
  AdminCobranzaPorCategoriaViewModel,
  AdminCuotaDetail,
  AdminCuotaFilter,
  AdminCuotaListItem,
  AdminCuotasResumenViewModel,
  AdminDatosBancariosViewModel,
  AdminEjecucionGeneracionViewModel,
  AdminEstadoCuentaPeriodoOption,
  AdminEstadoCuentaViewModel,
  AdminFeePeriodOption,
  AdminPagoViewModel,
  AdminReglaCuotaViewModel,
  CuotaEstado,
  CuotaResponseDto,
  CuotaResumenResponseDto,
  DatosBancariosResponseDto,
  EstadoCuentaSocioResponseDto,
  GeneracionCuotasOrigen,
  GeneracionCuotasResponseDto,
  MedioPagoCuota,
  PagoEstado,
  PagoResponseDto,
  ReglaCuotaResponseDto,
  ResumenCuotasResponseDto,
  SocioCategoriaCuota,
} from '../interfaces/admin-cuota.interface';

const NOT_PROVIDED = 'No informado';
const NO_DATA = 'Sin datos';

function display(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : NOT_PROVIDED;
}

function optional(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Format currency without altering the numeric value. */
export function formatCuotaImporte(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

/**
 * Format LocalDate / date-time without UTC day shift for date-only strings.
 */
export function formatCuotaDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = match[1];
    const month = Number(match[2]);
    const day = Number(match[3]);
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function cuotaEstadoLabel(estado: CuotaEstado): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'Pendiente';
    case 'INFORMADA':
      return 'Informada';
    case 'EN_REVISION':
      return 'En revisión';
    case 'PAGADA':
      return 'Pagada';
    case 'VENCIDA':
      return 'Vencida';
    case 'RECHAZADA':
      return 'Rechazada';
    case 'ANULADA':
      return 'Anulada';
    default:
      return estado;
  }
}

export function cuotaEstadoBadge(estado: CuotaEstado): BadgeVariant {
  switch (estado) {
    case 'PAGADA':
      return 'success';
    case 'PENDIENTE':
    case 'INFORMADA':
    case 'EN_REVISION':
      return 'warning';
    case 'VENCIDA':
    case 'RECHAZADA':
    case 'ANULADA':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function medioPagoLabel(medio: MedioPagoCuota | undefined): string {
  switch (medio) {
    case 'EFECTIVO':
      return 'Efectivo';
    case 'VENTANILLA':
      return 'Ventanilla';
    case 'TRANSFERENCIA':
      return 'Transferencia';
    case 'DEBITO':
      return 'Débito';
    case 'LINK_DE_PAGO':
      return 'Link de pago';
    default:
      return '—';
  }
}

export function medioPagoIcon(medio: MedioPagoCuota | undefined): string {
  switch (medio) {
    case 'EFECTIVO':
    case 'VENTANILLA':
      return 'banknote';
    case 'TRANSFERENCIA':
      return 'payments';
    case 'DEBITO':
      return 'credit_card';
    case 'LINK_DE_PAGO':
      return 'link';
    default:
      return 'payments';
  }
}

export function pagoEstadoLabel(estado: PagoEstado | undefined): string {
  switch (estado) {
    case 'APROBADO':
      return 'Aprobado';
    case 'EN_REVISION':
      return 'En revisión';
    case 'RECHAZADO':
      return 'Rechazado';
    default:
      return NOT_PROVIDED;
  }
}

export function categoriaCuotaLabel(categoria: SocioCategoriaCuota | undefined): string {
  switch (categoria) {
    case 'ACTIVO':
      return 'Activo';
    case 'ADHERENTE':
      return 'Adherente';
    default:
      return NOT_PROVIDED;
  }
}

/**
 * Pending tab matches resumen description:
 * pendientes incluye vencidas y en revisión (+ informada).
 */
export function cuotaFilterBucket(estado: CuotaEstado): AdminCuotaFilter | 'other' {
  switch (estado) {
    case 'PENDIENTE':
    case 'VENCIDA':
    case 'EN_REVISION':
    case 'INFORMADA':
      return 'pending';
    case 'PAGADA':
      return 'approved';
    case 'RECHAZADA':
      return 'rejected';
    default:
      return 'other';
  }
}

export function matchesAdminCuotaFilter(
  item: AdminCuotaListItem,
  filter: AdminCuotaFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }
  return item.filterBucket === filter;
}

/**
 * Admin POST /admin/cuotas/pagos eligibility.
 * Swagger admin: “alguna cuota no admite un pago en su estado actual”.
 * Align with socio autoservicio RN-17: PENDIENTE | VENCIDA | RECHAZADA.
 * Excludes EN_REVISION / INFORMADA (payment in flight) and PAGADA / ANULADA.
 */
export function canRegisterPayment(
  cuota: Pick<AdminCuotaListItem, 'estado'> | { estado: CuotaEstado },
): boolean {
  return (
    cuota.estado === 'PENDIENTE' ||
    cuota.estado === 'VENCIDA' ||
    cuota.estado === 'RECHAZADA'
  );
}

/**
 * Admin GET /admin/cuotas/pagos/{pagoId}/comprobante:
 * real file if attached, or generated PDF constancia when pago is APROBADO.
 */
export function canDownloadAdminComprobante(
  pago:
    | Pick<AdminPagoViewModel, 'id' | 'hasComprobantePath' | 'estado'>
    | Pick<PagoResponseDto, 'id' | 'comprobanteRuta' | 'estado'>
    | null
    | undefined,
): boolean {
  if (!pago?.id) {
    return false;
  }
  const hasPath =
    'hasComprobantePath' in pago
      ? pago.hasComprobantePath === true
      : Boolean(optional(pago.comprobanteRuta));
  return hasPath || pago.estado === 'APROBADO';
}

export function generacionOrigenLabel(origen: GeneracionCuotasOrigen | undefined): string {
  switch (origen) {
    case 'AUTOMATICA':
      return 'Automática';
    case 'MANUAL':
      return 'Manual';
    default:
      return '—';
  }
}

export function formatCuotaOptionLabel(cuota: AdminCuotaListItem): string {
  const period = cuota.period ? formatPeriodLabel(cuota.period) : 'Sin período';
  return `${cuota.memberName} · ${period} · ${cuota.amountLabel} · ${cuota.estadoLabel}`;
}

function resolveEstado(estado: CuotaEstado | undefined): CuotaEstado {
  return estado ?? 'PENDIENTE';
}

function mapPagoDtoToViewModel(dto: PagoResponseDto | null | undefined): AdminPagoViewModel | undefined {
  if (!dto?.id) {
    return undefined;
  }

  const hasComprobantePath = Boolean(optional(dto.comprobanteRuta));

  return {
    id: dto.id,
    estado: dto.estado,
    importeLabel: formatCuotaImporte(asNumber(dto.importe)),
    medioPagoLabel: medioPagoLabel(dto.medioPago),
    estadoLabel: pagoEstadoLabel(dto.estado),
    fechaPagoLabel: formatCuotaDate(dto.fechaPago),
    observacion: display(dto.observacion),
    motivoRechazo: display(dto.motivoRechazo),
    informadoPorSocio: dto.informadoPorSocio === true,
    registradoPorAdminNombre: display(dto.registradoPorAdminNombre),
    hasComprobantePath,
    canDownloadComprobante: canDownloadAdminComprobante({
      id: dto.id,
      hasComprobantePath,
      estado: dto.estado,
    }),
  };
}

export function mapCuotaResumenDtoToViewModel(dto: CuotaResumenResponseDto): AdminCuotaListItem {
  const estado = resolveEstado(dto.estado);
  const amount = asNumber(dto.importe);
  const dueDate = optional(dto.fechaVencimiento) ?? '';
  const paidAt = optional(dto.pagoVigente?.fechaPago);
  const paymentMethod = dto.pagoVigente?.medioPago;
  const notes = optional(dto.pagoVigente?.observacion);
  const pagoId = optional(dto.pagoVigente?.id);

  return {
    id: dto.id,
    memberCode: display(dto.socioNumeroSocio),
    memberName: display(dto.socioNombre),
    period: optional(dto.periodo) ?? '',
    amount,
    amountLabel: formatCuotaImporte(amount),
    estado,
    estadoLabel: cuotaEstadoLabel(estado),
    estadoBadge: cuotaEstadoBadge(estado),
    dueDate,
    dueDateLabel: formatCuotaDate(dueDate),
    paidAt,
    paidAtLabel: formatCuotaDate(paidAt),
    dateLabel: formatCuotaDate(paidAt ?? dueDate),
    paymentMethod,
    paymentMethodLabel: medioPagoLabel(paymentMethod),
    paymentMethodIcon: medioPagoIcon(paymentMethod),
    notes,
    pagoId,
    canReview: estado === 'EN_REVISION',
    canRegisterPayment: canRegisterPayment({ estado }),
    canAnular: estado !== 'ANULADA' && estado !== 'PAGADA',
    canDownloadComprobante: canDownloadAdminComprobante(dto.pagoVigente),
    filterBucket: cuotaFilterBucket(estado),
  };
}

export function mapCuotaDtoToViewModel(dto: CuotaResponseDto): AdminCuotaDetail {
  const base = mapCuotaResumenDtoToViewModel({
    id: dto.id,
    socioNumeroSocio: dto.socioNumeroSocio,
    socioNombre: dto.socioNombre,
    periodo: dto.periodo,
    importe: dto.importe,
    estado: dto.estado,
    fechaVencimiento: dto.fechaVencimiento,
    pagoVigente: dto.pagoVigente,
  });

  return {
    ...base,
    socioId: optional(dto.socioId) ?? '',
    tipoCuotaNombre: display(dto.tipoCuotaNombre),
    categoriaLabel: categoriaCuotaLabel(dto.categoria),
    motivoRechazo: display(dto.motivoRechazo),
    motivoAnulacion: display(dto.motivoAnulacion),
    fechaGeneracionLabel: formatCuotaDate(dto.fechaGeneracion),
    fechaActualizacionLabel: formatCuotaDate(dto.fechaActualizacion),
    pago: mapPagoDtoToViewModel(dto.pagoVigente),
  };
}

export function mapPagoDtoToListHints(dto: PagoResponseDto): AdminPagoViewModel {
  return (
    mapPagoDtoToViewModel(dto) ?? {
      id: '',
      importeLabel: formatCuotaImporte(0),
      medioPagoLabel: '—',
      estadoLabel: NOT_PROVIDED,
      fechaPagoLabel: '—',
      observacion: NOT_PROVIDED,
      motivoRechazo: NOT_PROVIDED,
      informadoPorSocio: false,
      registradoPorAdminNombre: NOT_PROVIDED,
      hasComprobantePath: false,
      canDownloadComprobante: false,
    }
  );
}

function mapCobranzaPorCategoria(
  items: ResumenCuotasResponseDto['cobranzaPorCategoria'],
): AdminCobranzaPorCategoriaViewModel[] {
  return (items ?? [])
    .filter(
      (item): item is NonNullable<typeof item> & { categoria: SocioCategoriaCuota } =>
        item?.categoria === 'ACTIVO' || item?.categoria === 'ADHERENTE',
    )
    .map((item) => {
      const totalCobrado = asNumber(item.totalCobrado);
      return {
        categoria: item.categoria,
        categoriaLabel: categoriaCuotaLabel(item.categoria),
        totalCobrado,
        totalCobradoLabel: formatCuotaImporte(totalCobrado),
        cantidadCuotas: asNumber(item.cantidadCuotas),
      };
    });
}

export function mapResumenCuotasDtoToViewModel(
  dto: ResumenCuotasResponseDto,
): AdminCuotasResumenViewModel {
  return {
    collectedAmount: asNumber(dto.totalCobrado),
    inReviewAmount: asNumber(dto.totalEnRevision),
    cashCollectedAmount: asNumber(dto.totalCobradoEnEfectivo),
    totalCount: asNumber(dto.cantidadTodas),
    pendingCount: asNumber(dto.cantidadPendientes),
    approvedCount: asNumber(dto.cantidadAprobadas),
    rejectedCount: asNumber(dto.cantidadRechazadas),
    cobranzaPorCategoria: mapCobranzaPorCategoria(dto.cobranzaPorCategoria),
  };
}

export function mapEjecucionGeneracionDtoToViewModel(
  dto: GeneracionCuotasResponseDto,
): AdminEjecucionGeneracionViewModel {
  const periodo = optional(dto.periodo) ?? '';
  const origen = dto.origen ?? 'MANUAL';

  return {
    periodo,
    periodoLabel: periodo ? formatPeriodLabel(periodo) : NO_DATA,
    origen,
    origenLabel: generacionOrigenLabel(origen),
    cantidadSociosActivos: asNumber(dto.cantidadSociosActivos),
    cantidadCuotasGeneradas: asNumber(dto.cantidadCuotasGeneradas),
    cantidadSociosOmitidos: asNumber(dto.cantidadSociosOmitidos),
    fechaEjecucion: optional(dto.fechaEjecucion) ?? '',
    fechaEjecucionLabel: formatCuotaDate(dto.fechaEjecucion),
    mensaje: display(dto.mensaje),
  };
}

export function mapEstadoCuentaSocioDtoToViewModel(
  dto: EstadoCuentaSocioResponseDto,
): AdminEstadoCuentaViewModel {
  const cuotas = (dto.cuotas ?? []).map(mapCuotaResumenDtoToViewModel);
  const periodosPagables: AdminEstadoCuentaPeriodoOption[] = cuotas
    .filter((item) => canRegisterPayment(item) && item.period.length > 0)
    .map((item) => ({
      cuotaId: item.id,
      periodo: item.period,
      periodoLabel: formatPeriodLabel(item.period),
      importe: item.amount,
      importeLabel: item.amountLabel,
      estado: item.estado,
      estadoLabel: item.estadoLabel,
      dueDateLabel: item.dueDateLabel,
    }));

  const deudaTotal = asNumber(dto.deudaTotal);

  return {
    socioId: optional(dto.socioId) ?? '',
    socioNumeroSocio: display(dto.socioNumeroSocio),
    socioNombre: display(dto.socioNombre),
    deudaTotal,
    deudaTotalLabel: formatCuotaImporte(deudaTotal),
    cuotas,
    periodosPagables,
  };
}

export function mapReglaCuotaDtoToViewModel(
  dto: ReglaCuotaResponseDto,
): AdminReglaCuotaViewModel | null {
  // Do not default missing categoria to ACTIVO — that crossed ACTIVO/ADHERENTE in the form.
  if (dto.categoriaAplicable !== 'ACTIVO' && dto.categoriaAplicable !== 'ADHERENTE') {
    return null;
  }

  const categoria: SocioCategoriaCuota = dto.categoriaAplicable;
  const importe = asNumber(dto.importe);

  return {
    id: optional(dto.id) ?? '',
    categoria,
    categoriaLabel: categoriaCuotaLabel(categoria),
    nombre: display(dto.nombre),
    importe,
    importeLabel: formatCuotaImporte(importe),
    diaVencimiento: typeof dto.diaVencimiento === 'number' ? dto.diaVencimiento : 1,
    fechaActualizacionLabel: formatCuotaDate(dto.fechaActualizacion),
  };
}

export function mapDatosBancariosDtoToViewModel(
  dto: DatosBancariosResponseDto,
): AdminDatosBancariosViewModel {
  return {
    banco: display(dto.banco),
    cbu: display(dto.cbu),
    alias: display(dto.alias),
    titular: display(dto.titular),
    cuit: display(dto.cuit),
    fechaActualizacionLabel: formatCuotaDate(dto.fechaActualizacion),
  };
}

export function buildAdminPeriodOptions(count = 8): AdminFeePeriodOption[] {
  const options: AdminFeePeriodOption[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatPeriodLabel(value) });
  }
  return options;
}

export function currentAdminPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export { NOT_PROVIDED, NO_DATA };
