import {
  ActualizarBeneficioRequestDto,
  BeneficioEstadoDto,
  BeneficioResponseDto,
  ComercioBeneficioFormValue,
  ComercioBeneficioViewModel,
  CrearBeneficioRequestDto,
} from '../interfaces/comercio-beneficio.interface';

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function isPercentValue(valor: string): boolean {
  return valor.includes('%');
}

export function mapComercioBeneficioDtoToViewModel(
  dto: BeneficioResponseDto,
): ComercioBeneficioViewModel {
  const valor = text(dto.valor);
  const estado = asEstado(dto.estado);
  const isActive = estado === 'ACTIVO';
  const tipoBeneficioId = text(dto.tipoBeneficioId);
  const tipoBeneficioNombre = text(dto.tipoBeneficioNombre);
  const typeLabel = tipoBeneficioNombre || 'Beneficio';

  return {
    id: text(dto.id),
    title: text(dto.titulo, 'Sin título'),
    description: text(dto.descripcion),
    tipoBeneficioId,
    tipoBeneficioNombre,
    typeLabel,
    valueLabel: valor || '—',
    isPercent: isPercentValue(valor),
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
    tipoBeneficioId: form.typeId.trim(),
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
    tipoBeneficioId: form.typeId.trim(),
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
