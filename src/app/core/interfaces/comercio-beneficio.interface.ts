/**
 * DTOs and ViewModels for Comercio → Mis Promociones.
 * Swagger Beneficios (Comercio):
 * - GET/POST /api/comercio/beneficios
 * - GET/PUT /api/comercio/beneficios/{id}
 * - PATCH /api/comercio/beneficios/{id}/estado
 */

export type BeneficioEstadoDto = 'ACTIVO' | 'INACTIVO';

/** Swagger `BeneficioResponse` */
export interface BeneficioResponseDto {
  id?: string | null;
  comercioId?: string | null;
  comercioNombre?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  tipoBeneficioId?: string | null;
  tipoBeneficioNombre?: string | null;
  valor?: string | null;
  fechaInicioVigencia?: string | null;
  fechaFinVigencia?: string | null;
  estado?: BeneficioEstadoDto | string | null;
  usosEsteMes?: number | null;
  fechaCreacion?: string | null;
  fechaActualizacion?: string | null;
}

/** Swagger `CrearBeneficioRequest` */
export interface CrearBeneficioRequestDto {
  titulo: string;
  descripcion?: string;
  tipoBeneficioId: string;
  valor: string;
  fechaInicioVigencia?: string | null;
  fechaFinVigencia?: string | null;
}

/** Swagger `ActualizarBeneficioRequest` */
export interface ActualizarBeneficioRequestDto {
  titulo: string;
  descripcion?: string;
  tipoBeneficioId: string;
  valor: string;
  fechaInicioVigencia?: string | null;
  fechaFinVigencia?: string | null;
}

/** Swagger `CambiarEstadoBeneficioRequest` */
export interface CambiarEstadoBeneficioRequestDto {
  nuevoEstado: BeneficioEstadoDto;
}

/** Swagger `BeneficioCreadoResponse` */
export interface BeneficioCreadoResponseDto {
  mensaje?: string | null;
  beneficio?: BeneficioResponseDto | null;
}

/** Form values for create/edit modal (UI). */
export interface ComercioBeneficioFormValue {
  title: string;
  description: string;
  /** Selected catalog id (`tipoBeneficioId`). */
  typeId: string;
  value: string;
  validFrom: string;
  validTo: string;
}

/** Card / list ViewModel for Mis Promociones. */
export interface ComercioBeneficioViewModel {
  id: string;
  title: string;
  description: string;
  tipoBeneficioId: string;
  tipoBeneficioNombre: string;
  /** Display label for cards (= tipoBeneficioNombre or neutral fallback). */
  typeLabel: string;
  valueLabel: string;
  isPercent: boolean;
  status: BeneficioEstadoDto;
  /** UI label matching current design (“Activa” / “Inactiva”). */
  statusLabel: 'Activa' | 'Inactiva';
  isActive: boolean;
  validFrom: string;
  validTo: string;
  validToLabel: string;
  usesThisMonth: number;
  merchantName: string;
}
