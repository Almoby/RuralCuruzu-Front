/**
 * Socio Mis Pagos — contracts from Swagger:
 * - GET  /api/socio/cuotas → CuotaResumenResponse
 * - GET  /api/socio/cuotas/pagos → PagoResponse
 * - GET  /api/socio/cuotas/datos-bancarios → DatosBancariosResponse
 * - POST /api/socio/cuotas/{cuotaId}/informar-pago (multipart: datos + comprobante)
 * - POST /api/socio/cuotas/{cuotaId}/link-de-pago
 * - GET  /api/socio/cuotas/pagos/{pagoId}/comprobante
 *
 * Response item shapes match the shared CuotaResumenResponse / PagoResponse /
 * DatosBancariosResponse schemas (also used by Admin).
 */

import {
  CuotaEstado,
  CuotaResponseDto,
  CuotaResumenResponseDto,
  DatosBancariosResponseDto,
  MedioPagoCuota,
  PagoEstado,
  PagoResponseDto,
} from './admin-cuota.interface';
import { BankDetailRow } from './fee.interface';

/** multipart part `datos` — InformarPagoCuotaRequest */
export interface InformarPagoCuotaRequestDto {
  fecha: string;
  importe: number;
  medioPago: MedioPagoCuota;
  observacion?: string;
}

/** POST /socio/cuotas/{cuotaId}/informar-pago */
export interface InformarPagoResponseDto {
  mensaje?: string;
  cuota?: CuotaResponseDto;
}

/** POST /socio/cuotas/{cuotaId}/link-de-pago */
export interface LinkDePagoResponseDto {
  mensaje?: string;
  pagoId?: string;
  linkDePago?: string;
}

export interface SocioPaymentReceiptDownload {
  blob: Blob;
  fileName: string;
}

export interface SocioPaymentsRawBundle {
  cuotas: CuotaResumenResponseDto[];
  pagos: PagoResponseDto[];
  bank: DatosBancariosResponseDto | null;
}

export interface SocioPaymentsCuotaItem {
  id: string;
  period: string;
  /** "Cuota de Junio 2026" */
  periodTitle: string;
  /** "Cuota Junio 2026" — link modal / receipts style */
  receiptTitle: string;
  amount: number;
  dueDate: string;
  dueDateLabel: string;
  estado: CuotaEstado | null;
  estadoLabel: string;
  memberCode: string;
  memberName: string;
  /**
   * Swagger: informar-pago / link-de-pago only for PENDIENTE | VENCIDA | RECHAZADA.
   * Derived solely from `estado` — never from opening a Mercado Pago URL.
   */
  canReportPayment: boolean;
  canPayWithLink: boolean;
  pagoVigenteId: string | null;
  pagoVigenteEstado: PagoEstado | null;
  pagoVigenteMedio: MedioPagoCuota | null;
  /**
   * True when the cuota is blocked by an in-flight online payment attempt
   * (not yet APROBADO). Does not mean the payment is confirmed.
   */
  hasPendingOnlinePayment: boolean;
}

export interface SocioPaymentsReceiptItem {
  id: string;
  period: string;
  receiptTitle: string;
  amount: number;
  paymentMethodLabel: string | null;
  dateLabel: string;
  estado: PagoEstado | null;
  estadoLabel: string;
  canDownload: boolean;
}

export interface SocioPaymentsBankDetails {
  banco: string;
  cbu: string;
  alias: string;
  titular: string;
  cuit: string;
}

export interface SocioPaymentsViewModel {
  currentCuota: SocioPaymentsCuotaItem | null;
  previousCuotas: SocioPaymentsCuotaItem[];
  receipts: SocioPaymentsReceiptItem[];
  bank: SocioPaymentsBankDetails | null;
  memberCode: string;
  memberName: string;
}

export type { BankDetailRow };
