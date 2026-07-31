import { RequestStatus } from '../../shared/enums';
import { CategoriaSolicitudSocio, TipoPersonaSolicitud } from './solicitud-socio.interface';

/** GET /admin/solicitudes-socio — item (Swagger SolicitudSocioResumenResponse). */
export interface SolicitudSocioResumenDto {
  numeroSolicitud: string;
  nombreParaMostrar: string;
  email: string;
  categoriaSolicitada: CategoriaSolicitudSocio;
  tipoPersona: TipoPersonaSolicitud;
  estado: RequestStatus;
  fechaCreacion: string;
}

/** Nested PF data (Swagger DatosPersonaFisica). */
export interface DatosPersonaFisicaDto {
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

/** Nested PJ data (Swagger DatosPersonaJuridica). */
export interface DatosPersonaJuridicaDto {
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

/** Historial entry (Swagger CambioEstadoResponse). */
export interface CambioEstadoDto {
  estadoAnterior?: RequestStatus;
  estadoNuevo?: RequestStatus;
  fechaHora?: string;
  adminResponsableNombre?: string;
  observacion?: string;
  motivo?: string;
  archivosAdjuntos?: string[];
}

/** GET /admin/solicitudes-socio/{numero} (Swagger SolicitudSocioResponse). */
export interface SolicitudSocioDetalleDto {
  numeroSolicitud: string;
  estado: RequestStatus;
  categoriaSolicitada: CategoriaSolicitudSocio;
  tipoPersona: TipoPersonaSolicitud;
  datosPersonaFisica?: DatosPersonaFisicaDto | null;
  datosPersonaJuridica?: DatosPersonaJuridicaDto | null;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  historial?: CambioEstadoDto[];
}

/** PATCH .../estado body (Swagger CambiarEstadoSolicitudRequest). */
export interface CambiarEstadoSolicitudRequest {
  nuevoEstado: RequestStatus;
  observacion?: string;
  motivo?: string;
}

/** PATCH .../estado response. */
export interface CambiarEstadoSolicitudResponse {
  numeroSolicitud: string;
  estado: RequestStatus;
  mensaje: string;
}

/** POST .../observaciones body. */
export interface AgregarObservacionSolicitudRequest {
  observacion: string;
}

/** POST .../observaciones response. */
export interface ObservacionAgregadaResponse {
  numeroSolicitud: string;
  mensaje: string;
}

/** Optional query for listado admin. */
export interface ListarSolicitudesAdminParams {
  estadoSolicitud?: RequestStatus;
}

/** Downloaded attachment payload for the UI. */
export interface SolicitudArchivoDownload {
  blob: Blob;
  fileName: string;
}
