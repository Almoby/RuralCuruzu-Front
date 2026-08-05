/**
 * DTOs and ViewModel for Comercio → Inicio.
 * Swagger:
 * - GET /api/comercio/dashboard → InicioComercioResponse
 * - GET /api/comercio/beneficios → BeneficioResponse[] (featured promo + nombre comercial)
 */

export type ComercioBeneficioEstadoDto = 'ACTIVO' | 'INACTIVO';

export type UsoDiaSemanaDto =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** Swagger `IndicadoresComercioResponse` */
export interface IndicadoresComercioResponseDto {
  usosEsteMes?: number | null;
  promocionesActivas?: number | null;
  sociosAlcanzados?: number | null;
  validacionesHoy?: number | null;
}

/** Swagger `UsoDiaSemanaResponse` */
export interface UsoDiaSemanaResponseDto {
  dia?: UsoDiaSemanaDto | string | null;
  cantidad?: number | null;
}

/** Swagger `InicioComercioResponse` */
export interface InicioComercioResponseDto {
  indicadores?: IndicadoresComercioResponseDto | null;
  usosPorDia?: UsoDiaSemanaResponseDto[] | null;
}

/** Swagger `BeneficioResponse` (subset used by Inicio) */
export interface BeneficioComercioResponseDto {
  id?: string | null;
  comercioId?: string | null;
  comercioNombre?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  estado?: ComercioBeneficioEstadoDto | string | null;
  usosEsteMes?: number | null;
  fechaInicioVigencia?: string | null;
  fechaFinVigencia?: string | null;
}

export interface ComercioInicioTrendPoint {
  label: string;
  value: number;
  day: UsoDiaSemanaDto;
}

export interface ComercioInicioFeaturedPromotion {
  id: string;
  title: string;
  usesThisMonth: number;
  status: string;
  statusRaw: ComercioBeneficioEstadoDto | string;
}

/** Mapped payload for Inicio Comercio UI. */
export interface ComercioInicioViewModel {
  /** Commercial name from beneficios when present; otherwise null (session fallback). */
  merchantName: string | null;
  usesThisMonth: number;
  activePromotions: number;
  reachedMembers: number;
  validationsToday: number;
  weeklyTrend: ComercioInicioTrendPoint[];
  featuredPromotion: ComercioInicioFeaturedPromotion | null;
}
