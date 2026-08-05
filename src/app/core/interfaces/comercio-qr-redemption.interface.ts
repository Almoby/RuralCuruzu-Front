/**
 * DTOs / ViewModels for Comercio → Validar QR.
 * Swagger: POST /api/comercio/beneficios/canjear-beneficio
 */

export type SocioCategoriaQrDto = 'ACTIVO' | 'ADHERENTE';

export type BeneficioTipoQrDto =
  | 'DESCUENTO_PORCENTAJE'
  | 'DOS_POR_UNO'
  | 'TRES_POR_DOS'
  | 'GRATIS'
  | 'OTRO';

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
  beneficioTipo?: BeneficioTipoQrDto | string | null;
  beneficioValor?: string | null;
  montoAhorro?: number | null;
  fechaUso?: string | null;
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
