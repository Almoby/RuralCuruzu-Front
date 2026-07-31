/**
 * Backend DTOs for GET /api/admin/dashboard (Swagger DashboardPrincipalResponse).
 */

export interface IndicadoresPrincipalesDto {
  totalSocios?: number;
  sociosNuevosEsteMes?: number;
  sociosConCuotaAlDia?: number;
  porcentajeAlDiaDelTotal?: number;
  sociosConCuotaPendiente?: number;
  sociosConCuotaVencida?: number;
  comerciosActivos?: number;
  promocionesActivas?: number;
  facturacionMensual?: number;
  variacionPorcentualFacturacionVsMesAnterior?: number;
  deudaAcumulada?: number;
  sociosEnMora?: number;
  beneficiosUtilizados?: number;
  beneficiosUtilizadosHistoricoTotal?: number;
}

export interface CobranzaMensualDto {
  periodo?: string;
  mes?: string;
  cobrado?: number;
  pendiente?: number;
}

export interface EstadoSociosDto {
  alDia?: number;
  pendientes?: number;
  vencidos?: number;
  inactivos?: number;
}

export interface UsoPeriodoDto {
  periodo?: string;
  cantidad?: number;
}

export interface UsoBeneficioPorComercioDto {
  comercioId?: string;
  comercioNombre?: string;
  cantidadBeneficiosUtilizados?: number;
  cantidadBeneficiosUtilizadosEsteMes?: number;
  cantidadSociosUnicos?: number;
  promocionMasUtilizada?: string;
  usoPorPeriodo?: UsoPeriodoDto[];
}

export interface BeneficioMasUtilizadoDto {
  beneficioId?: string;
  beneficioTitulo?: string;
  comercioNombre?: string;
  usosEsteMes?: number;
}

export interface AdminDashboardDto {
  indicadoresPrincipales?: IndicadoresPrincipalesDto | null;
  cobranzaMensual?: CobranzaMensualDto[] | null;
  estadoSocios?: EstadoSociosDto | null;
  usoBeneficiosPorComercio?: UsoBeneficioPorComercioDto[] | null;
  beneficiosMasUtilizados?: BeneficioMasUtilizadoDto[] | null;
}

/** Optional query params for GET /api/admin/dashboard */
export interface AdminDashboardQueryParams {
  año?: number;
  categoria?: 'ACTIVO' | 'ADHERENTE';
  tipoPersona?: 'FISICA' | 'JURIDICA';
}

export interface AdminDashboardExportFile {
  blob: Blob;
  fileName: string;
}
