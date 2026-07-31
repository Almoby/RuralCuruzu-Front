import { MemberCategory, RequestStatus } from '../../shared/enums';
import {
  CambioEstadoDto,
  DatosPersonaFisicaDto,
  DatosPersonaJuridicaDto,
  SolicitudSocioDetalleDto,
  SolicitudSocioResumenDto,
} from '../interfaces/admin-solicitud-socio.interface';
import {
  MembershipRequest,
  MembershipRequestAttachment,
  MembershipRequestHistorialItem,
  PersonType,
} from '../interfaces/member-request.interface';
import { CategoriaSolicitudSocio, TipoPersonaSolicitud } from '../interfaces/solicitud-socio.interface';

const NOT_PROVIDED = 'No informado';

function displayValue(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : NOT_PROVIDED;
}

function optionalValue(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapCategoria(categoria: CategoriaSolicitudSocio | undefined): MemberCategory {
  return categoria === 'ADHERENTE' ? MemberCategory.Adherente : MemberCategory.Activo;
}

function mapPersonType(tipo: TipoPersonaSolicitud | undefined): PersonType | undefined {
  if (tipo === 'FISICA' || tipo === 'JURIDICA') {
    return tipo;
  }
  return undefined;
}

function fileNameFromPath(ruta: string): string {
  const normalized = ruta.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? ruta;
}

function mapAttachments(rutas: string[] | undefined): MembershipRequestAttachment[] {
  if (!rutas?.length) {
    return [];
  }
  return rutas
    .map((ruta) => ruta.trim())
    .filter((ruta) => ruta.length > 0)
    .map((path) => ({ path, fileName: fileNameFromPath(path) }));
}

export function mapObservacionDtoToViewModel(
  entry: CambioEstadoDto,
  index: number,
): MembershipRequestHistorialItem {
  return {
    id: `hist-${index}-${entry.fechaHora ?? index}`,
    previousStatus: entry.estadoAnterior,
    newStatus: entry.estadoNuevo,
    dateTime: entry.fechaHora ?? '',
    adminName: displayValue(entry.adminResponsableNombre),
    observation: optionalValue(entry.observacion),
    reason: optionalValue(entry.motivo),
    attachments: mapAttachments(entry.archivosAdjuntos),
  };
}

export function mapArchivoDtoToViewModel(ruta: string): MembershipRequestAttachment {
  return {
    path: ruta,
    fileName: fileNameFromPath(ruta),
  };
}

export function mapSolicitudListItemDtoToViewModel(
  dto: SolicitudSocioResumenDto,
): MembershipRequest {
  return {
    id: dto.numeroSolicitud,
    fullName: displayValue(dto.nombreParaMostrar),
    email: displayValue(dto.email),
    documentNumber: NOT_PROVIDED,
    phone: NOT_PROVIDED,
    category: mapCategoria(dto.categoriaSolicitada),
    personType: mapPersonType(dto.tipoPersona),
    status: dto.estado,
    submittedAt: dto.fechaCreacion ?? '',
  };
}

function mapFromPersonaFisica(pf: DatosPersonaFisicaDto): Partial<MembershipRequest> {
  return {
    fullName: displayValue(pf.apellidoYNombre),
    documentNumber: displayValue(pf.dni),
    birthDate: optionalValue(pf.fechaNacimiento),
    cuit: optionalValue(pf.cuitCuil),
    address: optionalValue(pf.direccion),
    portalFloor: optionalValue(pf.portalPisoDepartamento),
    phone: displayValue(pf.telefono),
    email: displayValue(pf.correoElectronico),
    establishmentName: optionalValue(pf.nombreEstablecimiento),
    establishmentAddress: optionalValue(pf.direccionEstablecimiento),
  };
}

function mapFromPersonaJuridica(pj: DatosPersonaJuridicaDto): Partial<MembershipRequest> {
  return {
    fullName: displayValue(pj.razonSocial),
    documentNumber: NOT_PROVIDED,
    cuit: optionalValue(pj.cuit),
    address: optionalValue(pj.direccion),
    portalFloor: optionalValue(pj.portalPisoDepartamento),
    phone: displayValue(pj.telefono),
    email: displayValue(pj.correoElectronico),
    establishmentName: optionalValue(pj.nombreEstablecimiento),
    establishmentAddress: optionalValue(pj.direccionEstablecimiento),
    responsableName: optionalValue(pj.nombreResponsable),
    responsableDocument: optionalValue(pj.dniResponsable),
  };
}

function extractRejectionReason(historial: MembershipRequestHistorialItem[]): string | undefined {
  const rejected = [...historial]
    .reverse()
    .find((item) => item.newStatus === RequestStatus.Rechazada && item.reason);
  return rejected?.reason;
}

function extractCancelReason(historial: MembershipRequestHistorialItem[]): string | undefined {
  const cancelled = [...historial]
    .reverse()
    .find((item) => item.newStatus === RequestStatus.Cancelada && item.reason);
  return cancelled?.reason;
}

function extractLastReview(
  historial: MembershipRequestHistorialItem[],
): Pick<MembershipRequest, 'reviewedAt' | 'reviewedBy' | 'notes'> {
  const last = historial.length > 0 ? historial[historial.length - 1] : undefined;
  if (!last) {
    return {};
  }
  return {
    reviewedAt: optionalValue(last.dateTime),
    reviewedBy: last.adminName !== NOT_PROVIDED ? last.adminName : undefined,
    notes: last.observation,
  };
}

export function mapSolicitudDetalleDtoToViewModel(
  dto: SolicitudSocioDetalleDto,
): MembershipRequest {
  const historial = (dto.historial ?? []).map((entry, index) =>
    mapObservacionDtoToViewModel(entry, index),
  );

  const base: MembershipRequest = {
    id: dto.numeroSolicitud,
    fullName: NOT_PROVIDED,
    email: NOT_PROVIDED,
    documentNumber: NOT_PROVIDED,
    phone: NOT_PROVIDED,
    category: mapCategoria(dto.categoriaSolicitada),
    personType: mapPersonType(dto.tipoPersona),
    status: dto.estado,
    submittedAt: dto.fechaCreacion ?? '',
    updatedAt: optionalValue(dto.fechaActualizacion),
    historial,
    rejectionReason: extractRejectionReason(historial),
    cancelReason: extractCancelReason(historial),
    ...extractLastReview(historial),
  };

  if (dto.tipoPersona === 'FISICA' && dto.datosPersonaFisica) {
    return { ...base, ...mapFromPersonaFisica(dto.datosPersonaFisica) };
  }

  if (dto.tipoPersona === 'JURIDICA' && dto.datosPersonaJuridica) {
    return { ...base, ...mapFromPersonaJuridica(dto.datosPersonaJuridica) };
  }

  return base;
}

export function parseContentDispositionFileName(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utfMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utfMatch[1].trim().replace(/^"|"$/g, '');
    }
  }

  const plainMatch = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  if (plainMatch?.[2]) {
    return plainMatch[2].trim();
  }

  return null;
}
