/** Backend enums for public membership request (Swagger). */
export type TipoPersonaSolicitud = 'FISICA' | 'JURIDICA';
export type CategoriaSolicitudSocio = 'ACTIVO' | 'ADHERENTE';

/**
 * POST /api/solicitudes-socio request body (Swagger SolicitudSocioRequest).
 * Flat payload — no nested objects.
 */
export interface SolicitudSocioRequest {
  categoriaSolicitada: CategoriaSolicitudSocio;
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
  aceptaTerminosYCondiciones: boolean;
}

export interface SolicitudSocioResponse {
  numeroSolicitud: string;
  estado: string;
  categoriaSolicitada: CategoriaSolicitudSocio;
  tipoPersona: TipoPersonaSolicitud;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface SolicitudSocioCreadaResponse {
  mensaje: string;
  solicitud: SolicitudSocioResponse;
}

/** Form view-model used by the public “Quiero ser socio” screen. */
export interface SolicitudSocioFormValue {
  membershipType: 'Activo' | 'Adherente';
  personType: TipoPersonaSolicitud | '';
  fullNameOrBusinessName: string;
  postalAddress: string;
  portalPisoDepartamento: string;
  birthDate: string;
  documentNumber: string;
  phone: string;
  email: string;
  cuit: string;
  establishmentName: string;
  establishmentAddress: string;
  responsableName: string;
  responsableDocument: string;
  acceptTerms: boolean;
}
