/**
 * DTOs for Socio “Mi panel” — composed from Swagger:
 * - GET /api/socio/cuotas → CuotaResumenResponse
 * - GET /api/socio/cuotas/pagos → PagoResponse
 * - GET /api/socio/beneficios → BeneficioResumenResponse
 * - GET /api/socio/beneficios/historial-beneficios → HistorialBeneficioResponse
 *
 * There is no dedicated `/api/socio/dashboard` or `/api/socio/perfil` (except mi-qr).
 */

import {
  CuotaResumenResponseDto,
  PagoResponseDto,
} from './admin-cuota.interface';

export type BeneficioTipoDto =
  | 'DESCUENTO_PORCENTAJE'
  | 'DOS_POR_UNO'
  | 'TRES_POR_DOS'
  | 'GRATIS'
  | 'OTRO';

/** GET /api/socio/beneficios item (Swagger BeneficioResumenResponse). */
export interface SocioBeneficioResumenDto {
  id?: string;
  comercioId?: string;
  comercioNombre?: string;
  comercioRubro?: string;
  titulo?: string;
  descripcion?: string;
  tipo?: BeneficioTipoDto;
  valor?: string;
  fechaFinVigencia?: string;
}

/** GET /api/socio/beneficios/historial-beneficios item. */
export interface SocioHistorialBeneficioDto {
  id?: string;
  comercioNombre?: string;
  beneficioTitulo?: string;
  tipo?: BeneficioTipoDto;
  valor?: string;
  montoAhorro?: number;
  estado?: 'USADO' | 'ANULADO';
  fechaUso?: string;
}

/** Session fields needed to compose the greeting (LoginResponse.nombre). */
export interface SocioPanelSessionContext {
  displayName: string;
}

/** Raw bundle before mapping to Mi panel ViewModel. */
export interface SocioPanelRawBundle {
  cuotas: CuotaResumenResponseDto[];
  pagos: PagoResponseDto[];
  beneficios: SocioBeneficioResumenDto[];
  historial: SocioHistorialBeneficioDto[];
  session: SocioPanelSessionContext;
}
