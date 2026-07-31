import { MemberCategory } from '../../shared/enums';
import {
  AdminMember,
  AdminMemberDetail,
  AdminSocioCreateFormValue,
  AltaManualSocioRequest,
  SocioCategoria,
  SocioDetalleDto,
  SocioEstado,
  SocioResumenDto,
} from '../interfaces/admin-socio.interface';

const NOT_PROVIDED = 'No informado';
const NO_DATA = 'Sin datos';

function display(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : NOT_PROVIDED;
}

function optional(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapCategoria(categoria: SocioCategoria | undefined): MemberCategory {
  return categoria === 'ADHERENTE' ? MemberCategory.Adherente : MemberCategory.Activo;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function socioEstadoLabel(estado: SocioEstado): string {
  switch (estado) {
    case 'ACTIVO':
      return 'Activo';
    case 'INACTIVO':
      return 'Inactivo';
    case 'DADO_DE_BAJA':
      return 'Dado de baja';
    default:
      return estado;
  }
}

function emptyFeeLabels(): Pick<
  AdminMember,
  'feeStatusLabel' | 'monthlyFeeLabel' | 'nextDueDateLabel'
> {
  return {
    feeStatusLabel: NO_DATA,
    monthlyFeeLabel: NO_DATA,
    nextDueDateLabel: NO_DATA,
  };
}

export function mapSocioListItemDtoToViewModel(dto: SocioResumenDto): AdminMember {
  const fullName = display(dto.nombre);
  const { firstName, lastName } = splitName(fullName === NOT_PROVIDED ? '' : fullName);
  const estado = dto.estado ?? 'ACTIVO';

  return {
    id: dto.id,
    memberCode: display(dto.numeroSocio),
    fullName,
    firstName,
    lastName,
    email: display(dto.correoElectronico),
    documentNumber: NOT_PROVIDED,
    phone: NOT_PROVIDED,
    category: mapCategoria(dto.categoria),
    membershipStatus: estado,
    personType: dto.tipoPersona ?? 'FISICA',
    isActive: estado === 'ACTIVO',
    joinDate: '',
    ...emptyFeeLabels(),
  };
}

export function mapSocioDetalleDtoToViewModel(dto: SocioDetalleDto): AdminMemberDetail {
  const estado = dto.estado ?? 'ACTIVO';
  const nombre = display(dto.nombre);
  const names = splitName(nombre === NOT_PROVIDED ? '' : nombre);

  const base: AdminMemberDetail = {
    id: dto.id,
    memberCode: display(dto.numeroSocio),
    fullName: nombre,
    firstName: names.firstName,
    lastName: names.lastName,
    email: NOT_PROVIDED,
    documentNumber: NOT_PROVIDED,
    phone: NOT_PROVIDED,
    category: mapCategoria(dto.categoria),
    membershipStatus: estado,
    personType: dto.tipoPersona ?? 'FISICA',
    isActive: estado === 'ACTIVO',
    joinDate: optional(dto.fechaAlta) ?? '',
    updatedAt: optional(dto.fechaActualizacion),
    originRequestNumber: optional(dto.numeroSolicitudOrigen),
    ...emptyFeeLabels(),
  };

  if (dto.tipoPersona === 'FISICA' && dto.datosPersonaFisica) {
    const pf = dto.datosPersonaFisica;
    const fullName = display(pf.apellidoYNombre ?? dto.nombre);
    const split = splitName(fullName === NOT_PROVIDED ? '' : fullName);
    return {
      ...base,
      fullName,
      firstName: split.firstName,
      lastName: split.lastName,
      documentNumber: display(pf.dni),
      birthDate: optional(pf.fechaNacimiento),
      cuit: optional(pf.cuitCuil),
      address: optional(pf.direccion),
      portalFloor: optional(pf.portalPisoDepartamento),
      phone: display(pf.telefono),
      email: display(pf.correoElectronico),
      establishmentName: optional(pf.nombreEstablecimiento),
      establishmentAddress: optional(pf.direccionEstablecimiento),
    };
  }

  if (dto.tipoPersona === 'JURIDICA' && dto.datosPersonaJuridica) {
    const pj = dto.datosPersonaJuridica;
    const fullName = display(pj.razonSocial ?? dto.nombre);
    return {
      ...base,
      fullName,
      firstName: fullName === NOT_PROVIDED ? '' : fullName,
      lastName: '',
      cuit: optional(pj.cuit),
      address: optional(pj.direccion),
      portalFloor: optional(pj.portalPisoDepartamento),
      phone: display(pj.telefono),
      email: display(pj.correoElectronico),
      establishmentName: optional(pj.nombreEstablecimiento),
      establishmentAddress: optional(pj.direccionEstablecimiento),
      responsableName: optional(pj.nombreResponsable),
      responsableDocument: optional(pj.dniResponsable),
    };
  }

  return base;
}

function trimRequired(value: string): string {
  return value.trim();
}

function trimOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function mapFormToAltaManualSocioRequest(
  form: AdminSocioCreateFormValue,
): AltaManualSocioRequest {
  const tipoPersona = form.personType;
  const payload: AltaManualSocioRequest = {
    categoria: form.category === MemberCategory.Adherente ? 'ADHERENTE' : 'ACTIVO',
    tipoPersona,
    apellidoYNombre: trimRequired(form.fullName),
    cuit: trimRequired(form.cuit).replace(/\s/g, ''),
    direccion: trimRequired(form.address),
    telefono: trimRequired(form.phone),
    email: trimRequired(form.email).toLowerCase(),
    nombreEstablecimiento: trimRequired(form.establishmentName),
    direccionEstablecimiento: trimRequired(form.establishmentAddress),
    estado: form.membershipStatus,
  };

  const portal = trimOptional(form.portalFloor);
  if (portal) {
    payload.portalPisoDepartamento = portal;
  }

  if (tipoPersona === 'FISICA') {
    const documento = trimOptional(form.documentNumber);
    const fechaNacimiento = trimOptional(form.birthDate);
    if (documento) {
      payload.documento = documento;
    }
    if (fechaNacimiento) {
      payload.fechaNacimiento = fechaNacimiento;
    }
  }

  if (tipoPersona === 'JURIDICA') {
    const nombreResponsable = trimOptional(form.responsableName);
    const dniResponsable = trimOptional(form.responsableDocument);
    if (nombreResponsable) {
      payload.nombreResponsable = nombreResponsable;
    }
    if (dniResponsable) {
      payload.dniResponsable = dniResponsable;
    }
  }

  return payload;
}
