import { BadgeVariant } from '../../shared/components';

/** Backend comercio estados (Swagger). */
export type ComercioEstado = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';

export type PromocionEstado = 'ACTIVO' | 'INACTIVO';

/** GET /admin/comercios query */
export interface ListarComerciosAdminParams {
  estado?: ComercioEstado;
}

/** GET /admin/comercios item */
export interface ComercioResumenDto {
  id: string;
  nombreComercial?: string;
  razonSocial?: string;
  cuit?: string;
  rubro?: string;
  telefono?: string;
  correoElectronico?: string;
  direccion?: string;
  estado?: ComercioEstado;
  cantidadPromociones?: number;
  consumosTotales?: number;
}

export interface PromocionResumenDto {
  id?: string;
  titulo?: string;
  estado?: PromocionEstado;
  usosEsteMes?: number;
}

/** GET /admin/comercios/{id} */
export interface ComercioDetalleDto {
  id: string;
  nombreComercial?: string;
  razonSocial?: string;
  cuit?: string;
  rubro?: string;
  telefono?: string;
  correoElectronico?: string;
  direccion?: string;
  logo?: string;
  descripcion?: string;
  estado?: ComercioEstado;
  fechaAlta?: string;
  fechaActualizacion?: string;
  promociones?: PromocionResumenDto[];
}

/** POST /admin/comercios body */
export interface AltaComercioRequest {
  nombreComercial: string;
  razonSocial: string;
  cuit: string;
  rubro: string;
  telefono: string;
  correoElectronico: string;
  direccion: string;
  logo?: string;
  descripcion?: string;
  estado?: ComercioEstado;
}

export interface ComercioCreadoResponseDto {
  mensaje?: string;
  comercio?: ComercioDetalleDto;
}

/** PATCH /admin/comercios/{id} body */
export interface ActualizarComercioParcialRequest {
  nombreComercial?: string;
  razonSocial?: string;
  cuit?: string;
  rubro?: string;
  telefono?: string;
  correoElectronico?: string;
  direccion?: string;
  logo?: string;
  descripcion?: string;
}

export interface ComercioActualizadoResponseDto {
  mensaje?: string;
  comercio?: ComercioDetalleDto;
}

/** PATCH /admin/comercios/{id}/estado body */
export interface CambiarEstadoComercioRequest {
  nuevoEstado: ComercioEstado;
}

export interface CambiarEstadoComercioResponseDto {
  id?: string;
  estado?: ComercioEstado;
  mensaje?: string;
}

/** DELETE /admin/comercios/{id} body */
export interface EliminarComercioRequest {
  motivo: string;
}

/** GET /admin/comercios/eliminados item — Swagger `ComercioEliminadoResponse`. */
export interface ComercioEliminadoResponseDto {
  id?: string;
  comercioIdOriginal?: string;
  nombreComercial?: string;
  razonSocial?: string;
  cuit?: string;
  rubro?: string;
  estadoAlEliminar?: ComercioEstado;
  motivo?: string;
  adminResponsableBajaNombre?: string;
  fechaBaja?: string;
}

export interface EliminarComercioResponseDto {
  mensaje?: string;
  comercio?: ComercioEliminadoResponseDto;
}

/** ViewModel: historial de comercios eliminados (solo lectura). */
export interface AdminDeletedMerchantViewModel {
  id: string;
  tradeName: string;
  legalName: string;
  cuit: string;
  category: string;
  statusAtDeletion: ComercioEstado | null;
  statusAtDeletionLabel: string;
  reason: string;
  deletedByAdminName: string;
  deletedAt: string;
  deletedAtLabel: string;
  statusLabel: string;
  statusBadge: BadgeVariant;
}

/** ViewModel: list card + summary fields */
export interface AdminMerchant {
  id: string;
  tradeName: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: ComercioEstado;
  statusLabel: string;
  statusBadge: BadgeVariant;
  isInactiveVisual: boolean;
  cuit: string;
  /** Not provided by Swagger — always “No informado” in UI. */
  contactPerson: string;
  logoUrl?: string;
  joinedAt: string;
  joinedAtLabel: string;
  activePromotionsCount: number;
  consumptions: number;
}

export interface AdminMerchantPromotion {
  id: string;
  title: string;
  statusLabel: string;
  usosEsteMes: number;
}

/** ViewModel: detail panel */
export interface AdminMerchantDetail extends AdminMerchant {
  description: string;
  updatedAtLabel: string;
  promotions: AdminMerchantPromotion[];
}

export interface AdminMerchantFormValue {
  tradeName: string;
  name: string;
  cuit: string;
  category: string;
  phone: string;
  email: string;
  address: string;
}

export interface AdminMerchantCategoryOption {
  value: string;
  label: string;
}
