import {
  AdminBenefitTypeViewModel,
  BenefitTypeOptionViewModel,
  TipoBeneficioResponseDto,
} from '../interfaces/benefit-type.interface';
import { SelectOption } from '../../shared/components';

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function mapTipoBeneficioDtoToOption(
  dto: TipoBeneficioResponseDto,
): BenefitTypeOptionViewModel | null {
  const id = text(dto.id);
  const nombre = text(dto.nombre);
  if (!id || !nombre) {
    return null;
  }

  return {
    id,
    codigo: text(dto.codigo),
    nombre,
    value: id,
    label: nombre,
  };
}

export function mapTipoBeneficiosToOptions(
  items: TipoBeneficioResponseDto[] | null | undefined,
): BenefitTypeOptionViewModel[] {
  return (items ?? [])
    .map(mapTipoBeneficioDtoToOption)
    .filter((item): item is BenefitTypeOptionViewModel => item !== null);
}

export function mapBenefitTypeOptionsToSelectOptions(
  items: BenefitTypeOptionViewModel[],
): SelectOption[] {
  return items.map((item) => ({
    value: item.value,
    label: item.label,
  }));
}

/**
 * Ensures the currently assigned type remains selectable while editing,
 * even if it was deactivated and is missing from GET /tipos-beneficio.
 */
export function ensureBenefitTypeOption(
  options: BenefitTypeOptionViewModel[],
  typeId: string | null | undefined,
  typeName: string | null | undefined,
): BenefitTypeOptionViewModel[] {
  const id = text(typeId);
  if (!id) {
    return options;
  }
  if (options.some((item) => item.id === id)) {
    return options;
  }

  const nombre = text(typeName, 'Tipo actual');
  return [
    {
      id,
      codigo: '',
      nombre,
      value: id,
      label: nombre,
    },
    ...options,
  ];
}

export function mapTipoBeneficioDtoToAdminViewModel(
  dto: TipoBeneficioResponseDto,
): AdminBenefitTypeViewModel | null {
  const id = text(dto.id);
  const codigo = text(dto.codigo);
  const nombre = text(dto.nombre);
  if (!id || !codigo || !nombre) {
    return null;
  }

  const activo = dto.activo !== false;
  return {
    id,
    codigo,
    nombre,
    activo,
    statusLabel: activo ? 'Activo' : 'Inactivo',
    statusBadge: activo ? 'success' : 'neutral',
  };
}

export function mapTipoBeneficiosToAdminViewModels(
  items: TipoBeneficioResponseDto[] | null | undefined,
): AdminBenefitTypeViewModel[] {
  return (items ?? [])
    .map(mapTipoBeneficioDtoToAdminViewModel)
    .filter((item): item is AdminBenefitTypeViewModel => item !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Normalizes create `codigo` to uppercase stable identifier. */
export function normalizeBenefitTypeCodigo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}
