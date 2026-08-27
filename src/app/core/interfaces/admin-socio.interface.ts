import { MemberCategory } from '../../shared/enums';
import {
  CuotaResumenResponseDto,
} from './admin-cuota.interface';
import { TipoPersonaSolicitud } from './solicitud-socio.interface';

/** Backend membership status (Swagger SocioResumenResponse.estado). */
export type SocioEstado = 'ACTIVO' | 'INACTIVO' | 'DADO_DE_BAJA';

export type SocioCategoria = 'ACTIVO' | 'ADHERENTE';

/** GET /admin/socios item */
export interface SocioResumenDto {
  id: string;
  numeroSocio: string;
  nombre: string;
  categoria: SocioCategoria;
  tipoPersona: TipoPersonaSolicitud;
  estado: SocioEstado;
  correoElectronico: string;
}

/** Swagger `EstadoCuentaSocioResponse` (nested in SocioResponse). */
export interface EstadoCuentaSocioDto {
  socioId?: string | null;
  socioNumeroSocio?: string | null;
  socioNombre?: string | null;
  deudaTotal?: number | null;
  cuotas?: CuotaResumenResponseDto[] | null;
}

/** Swagger `ActualizarSocioParcialRequest` */
export interface ActualizarSocioParcialRequestDto {
  categoria?: SocioCategoria;
  telefono?: string;
  correoElectronico?: string;
  direccion?: string;
  portalPisoDepartamento?: string;
  nombreEstablecimiento?: string;
  direccionEstablecimiento?: string;
}

/** Swagger `SocioActualizadoResponse` */
export interface SocioActualizadoResponseDto {
  mensaje?: string | null;
  socio?: SocioDetalleDto | null;
}

/** Swagger `CambiarEstadoSocioRequest` */
export interface CambiarEstadoSocioRequestDto {
  nuevoEstado: SocioEstado;
}

/** Swagger `CambiarEstadoSocioResponse` */
export interface CambiarEstadoSocioResponseDto {
  id?: string | null;
  estado?: SocioEstado | null;
  mensaje?: string | null;
}

export interface SocioDatosPersonaFisicaDto {
  apellidoYNombre?: string;
  dni?: string;
  fechaNacimiento?: string;
  cuitCuil?: string;
  direccion?: string;
  portalPisoDepartamento?: string;
  telefono?: string;
  correoElectronico?: string;
  nombreEstablecimiento?: string;
  direccionEstablecimiento?: string;
}

export interface SocioDatosPersonaJuridicaDto {
  razonSocial?: string;
  cuit?: string;
  direccion?: string;
  portalPisoDepartamento?: string;
  telefono?: string;
  correoElectronico?: string;
  nombreEstablecimiento?: string;
  nombreResponsable?: string;
  dniResponsable?: string;
  direccionEstablecimiento?: string;
}

/** GET /admin/socios/{id} — Swagger `SocioResponse` */
export interface SocioDetalleDto {
  id: string;
  numeroSocio: string;
  nombre: string;
  categoria: SocioCategoria;
  tipoPersona: TipoPersonaSolicitud;
  datosPersonaFisica?: SocioDatosPersonaFisicaDto | null;
  datosPersonaJuridica?: SocioDatosPersonaJuridicaDto | null;
  estado: SocioEstado;
  numeroSolicitudOrigen?: string;
  fechaAlta?: string;
  fechaActualizacion?: string;
  estadoCuenta?: EstadoCuentaSocioDto | null;
}

/** POST /admin/socios body */
export interface AltaManualSocioRequest {
  categoria: SocioCategoria;
  tipoPersona: TipoPersonaSolicitud;
  apellidoYNombre: string;
  documento?: string;
  cuit: string;
  fechaNacimiento?: string;
  direccion: string;
  portalPisoDepartamento?: string;
  telefono: string;
  email: string;
  /** Optional per Swagger — omit when empty. */
  nombreEstablecimiento?: string;
  /** Optional per Swagger — omit when empty. */
  direccionEstablecimiento?: string;
  nombreResponsable?: string;
  dniResponsable?: string;
  estado?: SocioEstado;
}

export interface SocioCreadoResponse {
  mensaje: string;
  socio: SocioDetalleDto;
}

export interface ListarSociosAdminParams {
  estado?: SocioEstado;
  /** Swagger query: ACTIVO | ADHERENTE. */
  categoria?: SocioCategoria;
}

/** Form view-model for alta manual. */
export interface AdminSocioCreateFormValue {
  personType: TipoPersonaSolicitud;
  fullName: string;
  documentNumber: string;
  birthDate: string;
  email: string;
  phone: string;
  address: string;
  portalFloor: string;
  cuit: string;
  establishmentName: string;
  establishmentAddress: string;
  responsableName: string;
  responsableDocument: string;
  category: MemberCategory;
  membershipStatus: SocioEstado;
}

/**
 * View-model for Admin Gestión de Socios.
 * Fee labels show “Sin datos” when the API does not provide fee fields.
 */
export interface AdminMember {
  id: string;
  memberCode: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  phone: string;
  category: MemberCategory;
  membershipStatus: SocioEstado;
  personType: TipoPersonaSolicitud;
  isActive: boolean;
  address?: string;
  portalFloor?: string;
  birthDate?: string;
  cuit?: string;
  establishmentName?: string;
  establishmentAddress?: string;
  responsableName?: string;
  responsableDocument?: string;
  joinDate: string;
  updatedAt?: string;
  originRequestNumber?: string;
  feeStatusLabel: string;
  monthlyFeeLabel: string;
  nextDueDateLabel: string;
}

/** Editable fields for PATCH /admin/socios/{id} (partial). */
export interface AdminSocioEditFormValue {
  categoria: SocioCategoria;
  telefono: string;
  correoElectronico: string;
  direccion: string;
  portalPisoDepartamento: string;
  nombreEstablecimiento: string;
  direccionEstablecimiento: string;
}

export interface AdminMemberAccountCuota {
  id: string;
  periodo: string;
  periodoLabel: string;
  importe: number;
  importeLabel: string;
  dueDateLabel: string;
  estado: string;
  estadoLabel: string;
  paidAtLabel: string;
}

export interface AdminMemberAccountState {
  deudaTotal: number;
  deudaTotalLabel: string;
  cuotasCount: number;
  cuotas: AdminMemberAccountCuota[];
}

export interface AdminMemberDetail extends AdminMember {
  notes?: string;
  accountState: AdminMemberAccountState | null;
}
