/**
 * DTOs / ViewModels for Comercio → Validar QR.
 * Swagger: POST /api/comercio/beneficios/canjear-beneficio
 */

export type SocioCategoriaQrDto = 'ACTIVO' | 'ADHERENTE';

/** Swagger `ValidarBeneficioRequest` */
export interface ValidarBeneficioRequestDto {
  codigoQr: string;
  beneficioId: string;
  montoAhorro: number;
}

/** Swagger `ValidarBeneficioResponse` */
export interface ValidarBeneficioResponseDto {
  mensaje?: string | null;
  socioNombre?: string | null;
  socioNumeroSocio?: string | null;
  socioCategoria?: SocioCategoriaQrDto | string | null;
  beneficioTitulo?: string | null;
  beneficioTipoNombre?: string | null;
  beneficioValor?: string | null;
  montoAhorro?: number | null;
  fechaUso?: string | null;
  /** Total uses by this member for this benefit (including this redemption). */
  usosDelSocio?: number | null;
  /** 0 = unlimited; positive = max uses; may be absent on older payloads. */
  limiteUsosPorSocio?: number | null;
  /** Remaining uses; `null` when unlimited (Swagger). */
  usosRestantes?: number | null;
}

/** Success screen ViewModel (keeps current result-card bindings). */
export interface ComercioQrRedemptionSuccessViewModel {
  message: string;
  fullName: string;
  initials: string;
  memberNumber: string;
  category: string;
  benefitName: string;
  benefitValue: string;
  benefitTypeLabel: string;
  savingsAmount: number;
  savingsLabel: string;
  validatedAt: string;
  validatedAtLabel: string;
  /** Discrete usage line under savings when backend sends remaining/limit. */
  usosInfoLabel: string;
}

/** Rejection / business-error ViewModel for the existing rejected card. */
export interface ComercioQrRedemptionRejectedViewModel {
  reasonTitle: string;
  reasonDescription: string;
  /** Clear QR token and return to scan (e.g. expired). */
  clearQrToken: boolean;
  /** Reload benefits list (e.g. inactive benefit). */
  reloadBenefits: boolean;
  httpStatus: number;
}
