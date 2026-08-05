import {
  ActualizarBeneficioRequestDto,
  BeneficioEstadoDto,
  BeneficioResponseDto,
  BeneficioTipoDto,
  ComercioBeneficioFormValue,
  ComercioBeneficioViewModel,
  CrearBeneficioRequestDto,
} from '../interfaces/comercio-beneficio.interface';

const TIPO_LABELS: Record<BeneficioTipoDto, string> = {
  DESCUENTO_PORCENTAJE: 'Descuento',
  DOS_POR_UNO: '2×1',
  TRES_POR_DOS: '3×2',
  GRATIS: 'Gratis',
  OTRO: 'Otro',
};

const TIPO_VALUES = new Set<string>(Object.keys(TIPO_LABELS));

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asTipo(value: string | null | undefined): BeneficioTipoDto {
  const raw = text(value).toUpperCase();
  if (TIPO_VALUES.has(raw)) {
    return raw as BeneficioTipoDto;
  }
  return 'OTRO';
}

function asEstado(value: string | null | undefined): BeneficioEstadoDto {
  return text(value).toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
}

/** Formats LocalDate `YYYY-MM-DD` without UTC shift. */
function formatUntilLabel(date: string | null | undefined): string {
  const raw = text(date);
  if (!raw) {
    return 'Sin vencimiento';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) {
    return `Hasta ${raw}`;
  }
  return `Hasta ${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function isPercentType(tipo: BeneficioTipoDto, valor: string): boolean {
  if (tipo === 'DESCUENTO_PORCENTAJE') {
    return true;
  }
  return valor.includes('%');
}

export function mapBeneficioTipoLabel(tipo: BeneficioTipoDto | string): string {
  const normalized = asTipo(String(tipo));
  return TIPO_LABELS[normalized];
}

export function mapComercioBeneficioDtoToViewModel(
  dto: BeneficioResponseDto,
): ComercioBeneficioViewModel {
  const tipo = asTipo(dto.tipo);
  const valor = text(dto.valor);
  const estado = asEstado(dto.estado);
  const isActive = estado === 'ACTIVO';

  return {
    id: text(dto.id),
    title: text(dto.titulo, 'Sin título'),
    description: text(dto.descripcion),
    type: tipo,
    typeLabel: TIPO_LABELS[tipo],
    valueLabel: valor || '—',
    isPercent: isPercentType(tipo, valor),
    status: estado,
    statusLabel: isActive ? 'Activa' : 'Inactiva',
    isActive,
    validFrom: text(dto.fechaInicioVigencia),
    validTo: text(dto.fechaFinVigencia),
    validToLabel: formatUntilLabel(dto.fechaFinVigencia),
    usesThisMonth: asNumber(dto.usosEsteMes),
    merchantName: text(dto.comercioNombre),
  };
}

export function mapComercioBeneficiosToViewModels(
  items: BeneficioResponseDto[] | null | undefined,
): ComercioBeneficioViewModel[] {
  return (items ?? [])
    .map(mapComercioBeneficioDtoToViewModel)
    .filter((item) => !!item.id);
}

function optionalDate(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function mapPromotionFormToCreateRequest(
  form: ComercioBeneficioFormValue,
): CrearBeneficioRequestDto {
  return {
    titulo: form.title.trim(),
    descripcion: form.description.trim() || undefined,
    tipo: asTipo(form.type),
    valor: form.value.trim(),
    fechaInicioVigencia: optionalDate(form.validFrom),
    fechaFinVigencia: optionalDate(form.validTo),
  };
}

export function mapPromotionFormToUpdateRequest(
  form: ComercioBeneficioFormValue,
): ActualizarBeneficioRequestDto {
  return {
    titulo: form.title.trim(),
    descripcion: form.description.trim() || undefined,
    tipo: asTipo(form.type),
    valor: form.value.trim(),
    fechaInicioVigencia: optionalDate(form.validFrom),
    fechaFinVigencia: optionalDate(form.validTo),
  };
}

export function mapPromotionStatusToNextEstado(
  current: BeneficioEstadoDto,
): BeneficioEstadoDto {
  return current === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
}
