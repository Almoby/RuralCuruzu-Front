import {
  CategoriaSolicitudSocio,
  SolicitudSocioFormValue,
  SolicitudSocioRequest,
  TipoPersonaSolicitud,
} from '../interfaces/solicitud-socio.interface';

function trimText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const trimmed = trimText(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapCategoria(value: SolicitudSocioFormValue['membershipType']): CategoriaSolicitudSocio {
  return value === 'Adherente' ? 'ADHERENTE' : 'ACTIVO';
}

/**
 * Maps the public form view-model to the flat Swagger DTO.
 * Omits PF-only / PJ-only fields according to `tipoPersona`.
 */
export function mapFormToSolicitudSocioRequest(
  form: SolicitudSocioFormValue,
): SolicitudSocioRequest {
  const tipoPersona = form.personType as TipoPersonaSolicitud;

  const payload: SolicitudSocioRequest = {
    categoriaSolicitada: mapCategoria(form.membershipType),
    tipoPersona,
    apellidoYNombre: trimText(form.fullNameOrBusinessName),
    cuit: trimText(form.cuit).replace(/\s/g, ''),
    direccion: trimText(form.postalAddress),
    telefono: trimText(form.phone),
    email: trimText(form.email).toLowerCase(),
    nombreEstablecimiento: trimText(form.establishmentName),
    direccionEstablecimiento: trimText(form.establishmentAddress),
    aceptaTerminosYCondiciones: form.acceptTerms === true,
  };

  const portal = normalizeOptional(form.portalPisoDepartamento);
  if (portal) {
    payload.portalPisoDepartamento = portal;
  }

  if (tipoPersona === 'FISICA') {
    const documento = normalizeOptional(form.documentNumber);
    const fechaNacimiento = normalizeOptional(form.birthDate);
    if (documento) {
      payload.documento = documento;
    }
    if (fechaNacimiento) {
      payload.fechaNacimiento = fechaNacimiento;
    }
  }

  if (tipoPersona === 'JURIDICA') {
    const nombreResponsable = normalizeOptional(form.responsableName);
    const dniResponsable = normalizeOptional(form.responsableDocument);
    if (nombreResponsable) {
      payload.nombreResponsable = nombreResponsable;
    }
    if (dniResponsable) {
      payload.dniResponsable = dniResponsable;
    }
  }

  return payload;
}

/** Maps Swagger `CampoError.campo` names to form control names. */
export function mapBackendFieldToFormControl(campo: string | undefined): string | null {
  if (!campo) {
    return null;
  }

  const normalized = campo.trim().toLowerCase();
  const map: Record<string, string> = {
    categorasolicitada: 'membershipType',
    categoriasolicitada: 'membershipType',
    tipopersona: 'personType',
    apellidoynombre: 'fullNameOrBusinessName',
    documento: 'documentNumber',
    cuit: 'cuit',
    fechanacimiento: 'birthDate',
    direccion: 'postalAddress',
    portalpisodepartamento: 'portalPisoDepartamento',
    telefono: 'phone',
    email: 'email',
    nombreestablecimiento: 'establishmentName',
    direccionestablecimiento: 'establishmentAddress',
    nombreresponsable: 'responsableName',
    dniresponsable: 'responsableDocument',
    aceptaterminosycondiciones: 'acceptTerms',
  };

  return map[normalized.replace(/[^a-z]/g, '')] ?? null;
}
