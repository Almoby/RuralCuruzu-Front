/**
 * DTOs / ViewModels for benefit-type catalog.
 *
 * Comercio (active only):
 * - GET /api/tipos-beneficio
 *
 * Admin (all):
 * - GET/POST /api/admin/tipos-beneficio
 * - GET/PATCH/DELETE /api/admin/tipos-beneficio/{id}
 */

/** Swagger `TipoBeneficioResponse` */
export interface TipoBeneficioResponseDto {
  id?: string | null;
  codigo?: string | null;
  nombre?: string | null;
  activo?: boolean | null;
  fechaCreacion?: string | null;
  fechaActualizacion?: string | null;
}

/** Swagger `CrearTipoBeneficioRequest` */
export interface CrearTipoBeneficioRequestDto {
  codigo: string;
  nombre: string;
}

/** Swagger `ActualizarTipoBeneficioRequest` — partial; código not editable. */
export interface ActualizarTipoBeneficioRequestDto {
  nombre?: string;
  activo?: boolean;
}

/** Swagger `TipoBeneficioCreadoResponse` */
export interface TipoBeneficioCreadoResponseDto {
  mensaje?: string | null;
  tipoBeneficio?: TipoBeneficioResponseDto | null;
}

/** Swagger `TipoBeneficioActualizadoResponse` */
export interface TipoBeneficioActualizadoResponseDto {
  mensaje?: string | null;
  tipoBeneficio?: TipoBeneficioResponseDto | null;
}

/** Swagger `MensajeResponse` (delete). */
export interface TipoBeneficioMensajeResponseDto {
  mensaje?: string | null;
}

/** Option for Comercio Mis Promociones type select. */
export interface BenefitTypeOptionViewModel {
  id: string;
  codigo: string;
  nombre: string;
  /** Select `value` (= id). */
  value: string;
  /** Select `label` (= nombre). */
  label: string;
}

/** Admin list/form ViewModel (includes inactive). */
export interface AdminBenefitTypeViewModel {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  statusLabel: 'Activo' | 'Inactivo';
  statusBadge: 'success' | 'neutral';
}
