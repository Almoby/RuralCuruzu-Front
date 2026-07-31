import { MemberCategory } from '../../shared/enums';
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

/** GET /admin/socios/{id} */
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
  nombreEstablecimiento: string;
  direccionEstablecimiento: string;
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

export interface AdminMemberDetail extends AdminMember {
  notes?: string;
}
