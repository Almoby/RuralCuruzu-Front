import { BadgeVariant } from '../../shared/components';
import { MerchantCategory } from '../../shared/enums';
import {
  ActualizarComercioParcialRequest,
  AdminMerchant,
  AdminMerchantCategoryOption,
  AdminMerchantDetail,
  AdminMerchantFormValue,
  AdminMerchantPromotion,
  AltaComercioRequest,
  ComercioDetalleDto,
  ComercioEstado,
  ComercioResumenDto,
  PromocionResumenDto,
} from '../interfaces/admin-comercio.interface';

const NOT_PROVIDED = 'No informado';

function display(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : NOT_PROVIDED;
}

function optional(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function asCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function formatComercioDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function comercioEstadoLabel(estado: ComercioEstado): string {
  switch (estado) {
    case 'ACTIVO':
      return 'Activo';
    case 'INACTIVO':
      return 'Inactivo';
    case 'SUSPENDIDO':
      return 'Suspendido';
    case 'DADO_DE_BAJA':
      return 'Dado de baja';
    default:
      return estado;
  }
}

export function comercioEstadoBadge(estado: ComercioEstado): BadgeVariant {
  switch (estado) {
    case 'ACTIVO':
      return 'success';
    case 'SUSPENDIDO':
      return 'warning';
    case 'INACTIVO':
    case 'DADO_DE_BAJA':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function resolveEstado(estado: ComercioEstado | undefined): ComercioEstado {
  return estado ?? 'INACTIVO';
}

function mapPromocion(dto: PromocionResumenDto): AdminMerchantPromotion {
  return {
    id: optional(dto.id) ?? '',
    title: display(dto.titulo),
    statusLabel: dto.estado === 'ACTIVO' ? 'Activa' : 'Inactiva',
    usosEsteMes: asCount(dto.usosEsteMes),
  };
}

function baseFromResumen(dto: ComercioResumenDto): AdminMerchant {
  const estado = resolveEstado(dto.estado);
  const joinedAt = '';

  return {
    id: dto.id,
    tradeName: display(dto.nombreComercial),
    name: display(dto.razonSocial),
    email: display(dto.correoElectronico),
    phone: display(dto.telefono),
    address: display(dto.direccion),
    category: display(dto.rubro),
    status: estado,
    statusLabel: comercioEstadoLabel(estado),
    statusBadge: comercioEstadoBadge(estado),
    isInactiveVisual: estado !== 'ACTIVO',
    cuit: display(dto.cuit),
    contactPerson: NOT_PROVIDED,
    joinedAt,
    joinedAtLabel: '—',
    activePromotionsCount: asCount(dto.cantidadPromociones),
    consumptions: asCount(dto.consumosTotales),
  };
}

export function mapComercioResumenDtoToViewModel(dto: ComercioResumenDto): AdminMerchant {
  return baseFromResumen(dto);
}

export function mapComercioDetalleDtoToViewModel(
  dto: ComercioDetalleDto,
  listHints?: Pick<AdminMerchant, 'consumptions' | 'activePromotionsCount'>,
): AdminMerchantDetail {
  const estado = resolveEstado(dto.estado);
  const promotions = (dto.promociones ?? []).map(mapPromocion);
  const activeFromDetail = promotions.filter((item) => item.statusLabel === 'Activa').length;
  const joinedAt = optional(dto.fechaAlta) ?? '';

  return {
    id: dto.id,
    tradeName: display(dto.nombreComercial),
    name: display(dto.razonSocial),
    email: display(dto.correoElectronico),
    phone: display(dto.telefono),
    address: display(dto.direccion),
    category: display(dto.rubro),
    status: estado,
    statusLabel: comercioEstadoLabel(estado),
    statusBadge: comercioEstadoBadge(estado),
    isInactiveVisual: estado !== 'ACTIVO',
    cuit: display(dto.cuit),
    contactPerson: NOT_PROVIDED,
    logoUrl: optional(dto.logo),
    joinedAt,
    joinedAtLabel: formatComercioDate(joinedAt),
    activePromotionsCount: listHints?.activePromotionsCount ?? activeFromDetail,
    consumptions: listHints?.consumptions ?? 0,
    description: display(dto.descripcion),
    updatedAtLabel: formatComercioDate(dto.fechaActualizacion),
    promotions,
  };
}

export function mapAdminFormToAltaRequest(form: AdminMerchantFormValue): AltaComercioRequest {
  return {
    nombreComercial: form.tradeName.trim(),
    razonSocial: form.name.trim(),
    cuit: form.cuit.trim(),
    rubro: form.category.trim(),
    telefono: form.phone.trim(),
    correoElectronico: form.email.trim(),
    direccion: form.address.trim(),
  };
}

export function mapAdminFormToUpdateRequest(
  form: AdminMerchantFormValue,
): ActualizarComercioParcialRequest {
  return {
    nombreComercial: form.tradeName.trim(),
    razonSocial: form.name.trim(),
    cuit: form.cuit.trim(),
    rubro: form.category.trim(),
    telefono: form.phone.trim(),
    correoElectronico: form.email.trim(),
    direccion: form.address.trim(),
  };
}

/** Rubro options for the form (Swagger rubro is free text; UI keeps known labels). */
export function buildAdminRubroOptions(): AdminMerchantCategoryOption[] {
  return Object.values(MerchantCategory).map((value) => ({
    value,
    label: value,
  }));
}

export { NOT_PROVIDED };
