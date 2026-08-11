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

/** GET /api/socio/beneficios item (Swagger BeneficioResumenResponse). */
export interface SocioBeneficioResumenDto {
  id?: string;
  comercioId?: string;
  comercioNombre?: string;
  comercioRubro?: string;
  titulo?: string;
  descripcion?: string;
  tipoBeneficioId?: string;
  tipoBeneficioNombre?: string;
  valor?: string;
  fechaFinVigencia?: string;
  /** Max uses per member forever. 0 = unlimited. Omitted/null → treat as default 1 when needed. */
  limiteUsosPorSocio?: number | null;
  /** Times this authenticated member already used the benefit. */
  usosDelSocio?: number | null;
  /** Remaining uses for this member. null = unlimited. */
  usosRestantes?: number | null;
}

/** GET /api/socio/beneficios/historial-beneficios item (Swagger HistorialBeneficioResponse). */
export interface SocioHistorialBeneficioDto {
  id?: string;
  comercioNombre?: string;
  beneficioTitulo?: string;
  tipoBeneficioNombre?: string;
  valor?: string;
  montoAhorro?: number;
  estado?: 'USADO' | 'ANULADO';
  fechaUso?: string;
}

/** Session fields needed to compose the greeting / identity (LoginResponse). */
export interface SocioPanelSessionContext {
  displayName: string;
  /** From LoginResponse.numeroSocio when available. */
  numeroSocio?: string | null;
  /** From LoginResponse.categoria (ACTIVO | ADHERENTE). */
  memberCategory?: 'ACTIVO' | 'ADHERENTE' | null;
}

/** Raw bundle before mapping to Mi panel ViewModel. */
export interface SocioPanelRawBundle {
  cuotas: CuotaResumenResponseDto[];
  pagos: PagoResponseDto[];
  beneficios: SocioBeneficioResumenDto[];
  historial: SocioHistorialBeneficioDto[];
  session: SocioPanelSessionContext;
}
