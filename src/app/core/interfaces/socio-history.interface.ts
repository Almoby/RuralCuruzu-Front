/**
 * Socio Historial — DTOs already live in:
 * - SocioHistorialBeneficioDto (socio-panel.interface) ← HistorialBeneficioResponse
 * - PagoResponseDto (admin-cuota.interface) ← PagoResponse
 *
 * Endpoints:
 * - GET /api/socio/beneficios/historial-beneficios
 * - GET /api/socio/cuotas/pagos
 */

import {
  PagoEstado,
  PagoResponseDto,
} from './admin-cuota.interface';
import { SocioHistorialBeneficioDto } from './socio-panel.interface';

export type SocioHistoryBenefitEstado = 'USADO' | 'ANULADO';

/** Raw bundle before mapping to the Historial ViewModel. */
export interface SocioHistoryRawBundle {
  historial: SocioHistorialBeneficioDto[];
  pagos: PagoResponseDto[];
}

export interface SocioHistoryBenefitItem {
  id: string;
  benefitTitle: string;
  merchantName: string;
  /** Real catalog name from `tipoBeneficioNombre` (empty when absent). */
  typeName: string;
  /** Prefomatted local datetime for the list (`d/m/yyyy a las HH:mm`). */
  usedAtLabel: string;
  savingsAmount: number;
  estado: SocioHistoryBenefitEstado | null;
  /** Epoch ms for sorting; `Number.NEGATIVE_INFINITY` when fechaUso is missing. */
  sortTime: number;
}

export interface SocioHistoryPaymentItem {
  id: string;
  periodTitle: string;
  amount: number;
  /** Null when medioPago is absent — template omits the method segment. */
  paymentMethodLabel: string | null;
  dateLabel: string;
  estado: PagoEstado | null;
  statusLabel: string;
  isApproved: boolean;
  /** Epoch ms for sorting; `Number.NEGATIVE_INFINITY` when dates are missing. */
  sortTime: number;
}

export interface SocioHistoryViewModel {
  /** Sum of `montoAhorro` for items with estado USADO. */
  savingsTotal: number;
  /** Count of historial items with estado USADO. */
  usedBenefitsCount: number;
  /** Count of pagos with estado APROBADO. */
  approvedPaymentsCount: number;
  benefits: SocioHistoryBenefitItem[];
  payments: SocioHistoryPaymentItem[];
}
