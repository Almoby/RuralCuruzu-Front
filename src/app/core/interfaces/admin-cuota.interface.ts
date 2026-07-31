import { BadgeVariant } from '../../shared/components';

/** Backend cuota estados (Swagger CuotaResumenResponse.estado). */
export type CuotaEstado =
  | 'PENDIENTE'
  | 'INFORMADA'
  | 'EN_REVISION'
  | 'PAGADA'
  | 'VENCIDA'
  | 'RECHAZADA'
  | 'ANULADA';

/** Backend pago estados (Swagger PagoResponse.estado). */
export type PagoEstado = 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';

/** Backend medios de pago (Swagger PagoResponse.medioPago). */
export type MedioPagoCuota =
  | 'EFECTIVO'
  | 'VENTANILLA'
  | 'TRANSFERENCIA'
  | 'DEBITO'
  | 'LINK_DE_PAGO';

export type SocioCategoriaCuota = 'ACTIVO' | 'ADHERENTE';

export type GeneracionCuotasOrigen = 'AUTOMATICA' | 'MANUAL';

/** UI tabs aligned with ResumenCuotasResponse counts. */
export type AdminCuotaFilter = 'all' | 'pending' | 'approved' | 'rejected';

/** GET /admin/cuotas query */
export interface ListarCuotasAdminParams {
  estado?: CuotaEstado;
  socioId?: string;
  periodo?: string;
}

/** Nested payment on cuota responses. */
export interface PagoResponseDto {
  id: string;
  cuotaId?: string;
  socioNumeroSocio?: string;
  socioNombre?: string;
  periodo?: string;
  importe?: number;
  medioPago?: MedioPagoCuota;
  estado?: PagoEstado;
  fechaPago?: string;
  comprobanteRuta?: string;
  observacion?: string;
  informadoPorSocio?: boolean;
  registradoPorAdminNombre?: string;
  motivoRechazo?: string;
  fechaCreacion?: string;
}

/** GET /admin/cuotas item */
export interface CuotaResumenResponseDto {
  id: string;
  socioNumeroSocio?: string;
  socioNombre?: string;
  periodo?: string;
  importe?: number;
  estado?: CuotaEstado;
  fechaVencimiento?: string;
  pagoVigente?: PagoResponseDto | null;
}

/** GET /admin/cuotas/{id} */
export interface CuotaResponseDto {
  id: string;
  socioId?: string;
  socioNumeroSocio?: string;
  socioNombre?: string;
  tipoCuotaNombre?: string;
  categoria?: SocioCategoriaCuota;
  periodo?: string;
  importe?: number;
  fechaVencimiento?: string;
  estado?: CuotaEstado;
  pagoVigente?: PagoResponseDto | null;
  motivoRechazo?: string;
  motivoAnulacion?: string;
  fechaGeneracion?: string;
  fechaActualizacion?: string;
}

/** GET /admin/cuotas/resumen */
export interface ResumenCuotasResponseDto {
  totalCobrado?: number;
  totalEnRevision?: number;
  totalCobradoEnEfectivo?: number;
  cantidadTodas?: number;
  cantidadPendientes?: number;
  cantidadAprobadas?: number;
  cantidadRechazadas?: number;
}

/** POST /admin/cuotas/pagos body */
export interface RegistrarPagoCuotaRequest {
  socioId: string;
  periodos: string[];
  fecha: string;
  medioPago: MedioPagoCuota;
  comprobante?: string;
  observacion?: string;
}

export interface RegistrarPagoResponseDto {
  mensaje?: string;
  montoTotal?: number;
  cuotas?: CuotaResponseDto[];
}

/** POST /admin/cuotas/generar response */
export interface GeneracionCuotasResponseDto {
  mensaje?: string;
  periodo?: string;
  origen?: GeneracionCuotasOrigen;
  cantidadSociosActivos?: number;
  cantidadCuotasGeneradas?: number;
  cantidadSociosOmitidos?: number;
  fechaEjecucion?: string;
}

/** PATCH /admin/cuotas/{id}/revision body */
export interface RevisarPagoInformadoRequest {
  aprobar: boolean;
  motivoRechazo?: string;
}

export interface RevisarPagoInformadoResponseDto {
  mensaje?: string;
  cuota?: CuotaResponseDto;
}

/** PATCH /admin/cuotas/{id}/anular body */
export interface AnularCuotaRequest {
  motivo: string;
}

export interface ReglaCuotaResponseDto {
  id?: string;
  categoriaAplicable?: SocioCategoriaCuota;
  nombre?: string;
  importe?: number;
  diaVencimiento?: number;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface ActualizarReglaCuotaRequest {
  nombre: string;
  importe: number;
  diaVencimiento: number;
}

export interface ReglaCuotaActualizadaResponseDto {
  mensaje?: string;
  regla?: ReglaCuotaResponseDto;
}

export interface DatosBancariosResponseDto {
  banco?: string;
  cbu?: string;
  alias?: string;
  titular?: string;
  cuit?: string;
  fechaActualizacion?: string;
}

export interface ActualizarDatosBancariosRequest {
  banco: string;
  cbu: string;
  alias: string;
  titular: string;
  cuit: string;
}

export interface DatosBancariosActualizadosResponseDto {
  mensaje?: string;
  datosBancarios?: DatosBancariosResponseDto;
}

export interface EstadoCuentaSocioResponseDto {
  socioId?: string;
  socioNumeroSocio?: string;
  socioNombre?: string;
  deudaTotal?: number;
  cuotas?: CuotaResumenResponseDto[];
}

/** ViewModel: list card */
export interface AdminCuotaListItem {
  id: string;
  memberCode: string;
  memberName: string;
  period: string;
  amount: number;
  amountLabel: string;
  estado: CuotaEstado;
  estadoLabel: string;
  estadoBadge: BadgeVariant;
  dueDate: string;
  dueDateLabel: string;
  paidAt?: string;
  paidAtLabel: string;
  dateLabel: string;
  paymentMethod?: MedioPagoCuota;
  paymentMethodLabel: string;
  paymentMethodIcon: string;
  notes?: string;
  canReview: boolean;
  canRegisterPayment: boolean;
  canAnular: boolean;
  filterBucket: AdminCuotaFilter | 'other';
}

/** ViewModel: detail */
export interface AdminCuotaDetail extends AdminCuotaListItem {
  socioId: string;
  tipoCuotaNombre: string;
  categoriaLabel: string;
  motivoRechazo: string;
  motivoAnulacion: string;
  fechaGeneracionLabel: string;
  fechaActualizacionLabel: string;
  pago?: AdminPagoViewModel;
}

export interface AdminPagoViewModel {
  id: string;
  importeLabel: string;
  medioPagoLabel: string;
  estadoLabel: string;
  fechaPagoLabel: string;
  observacion: string;
  motivoRechazo: string;
  informadoPorSocio: boolean;
  registradoPorAdminNombre: string;
  hasComprobantePath: boolean;
}

/** ViewModel: summary cards + tab counts */
export interface AdminCuotasResumenViewModel {
  collectedAmount: number;
  inReviewAmount: number;
  cashCollectedAmount: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface AdminReglaCuotaViewModel {
  id: string;
  categoria: SocioCategoriaCuota;
  categoriaLabel: string;
  nombre: string;
  importe: number;
  importeLabel: string;
  diaVencimiento: number;
  fechaActualizacionLabel: string;
}

export interface AdminDatosBancariosViewModel {
  banco: string;
  cbu: string;
  alias: string;
  titular: string;
  cuit: string;
  fechaActualizacionLabel: string;
}

/**
 * Form emit from register-payment modal.
 * API body uses socioId + periodos (Swagger RegistrarPagoCuotaRequest);
 * cuotaId is kept for defensive eligibility checks before POST.
 */
export interface RegisterAdminPagoFormValue {
  cuotaId: string;
  socioId: string;
  periodos: string[];
  fecha: string;
  medioPago: MedioPagoCuota;
  observacion?: string;
  comprobante?: string;
}

export interface AdminFeePeriodOption {
  value: string;
  label: string;
}
