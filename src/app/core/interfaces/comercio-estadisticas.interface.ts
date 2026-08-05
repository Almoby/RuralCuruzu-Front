/**
 * DTOs and ViewModel for Comercio → Estadísticas.
 * Swagger: GET /api/comercio/dashboard/estadisticas → EstadisticasComercioResponse
 */

/** Swagger `IndicadoresEstadisticasComercioResponse` */
export interface IndicadoresEstadisticasComercioResponseDto {
  usosHistoricoTotal?: number | null;
  sociosUnicos?: number | null;
  promocionesActivas?: number | null;
  usosEsteMes?: number | null;
}

/** Swagger `UsoMensualResponse` */
export interface UsoMensualResponseDto {
  periodo?: string | null;
  mes?: string | null;
  cantidad?: number | null;
}

/** Swagger `UsoPorPromocionResponse` */
export interface UsoPorPromocionResponseDto {
  beneficioId?: string | null;
  beneficioTitulo?: string | null;
  cantidad?: number | null;
}

/** Swagger `ConsumoRecienteResponse` */
export interface ConsumoRecienteResponseDto {
  socioNombre?: string | null;
  beneficioTitulo?: string | null;
  fechaUso?: string | null;
}

/** Swagger `EstadisticasComercioResponse` */
export interface EstadisticasComercioResponseDto {
  indicadores?: IndicadoresEstadisticasComercioResponseDto | null;
  usosMensuales?: UsoMensualResponseDto[] | null;
  usosPorPromocion?: UsoPorPromocionResponseDto[] | null;
  consumosRecientes?: ConsumoRecienteResponseDto[] | null;
}

export interface ComercioEstadisticasSummaryVm {
  totalHistoricalUses: number;
  uniqueMembers: number;
  activePromotions: number;
  usesThisMonth: number;
}

export interface ComercioEstadisticasMonthlyPointVm {
  month: string;
  usageCount: number;
  periodo: string;
}

export interface ComercioEstadisticasPromotionPointVm {
  promotionId: string;
  promotionName: string;
  usageCount: number;
}

export interface ComercioEstadisticasRecentUsageVm {
  id: string;
  memberName: string;
  benefitName: string;
  usedAt: string;
  usedAtLabel: string;
}

/** Mapped payload for Estadísticas UI. */
export interface ComercioEstadisticasViewModel {
  summary: ComercioEstadisticasSummaryVm;
  monthlyUsage: ComercioEstadisticasMonthlyPointVm[];
  promotionUsage: ComercioEstadisticasPromotionPointVm[];
  recentUsages: ComercioEstadisticasRecentUsageVm[];
}
