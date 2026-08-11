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

/**
 * Label for Comercio promotion cards.
 * null/undefined → default “1 uso por socio”; 0 → unlimited.
 */
export function formatLimiteUsosPorSocioLabel(
  limite: number | null | undefined,
): string {
  if (limite === 0) {
    return 'Uso ilimitado';
  }
  if (limite == null) {
    return '1 uso por socio';
  }
  if (limite === 1) {
    return '1 uso por socio';
  }
  return `${limite} usos por socio`;
}

/** Form field string for edit: empty when backend omitted (default 1). */
export function limiteUsosPorSocioToFormValue(
  limite: number | null | undefined,
): string {
  if (limite == null) {
    return '';
  }
  return String(limite);
}

/**
 * Parses optional usage-limit form field.
 * empty → omit from payload; "0"/N → integer >= 0; invalid → null.
 */
export function parseLimiteUsosPorSocioInput(
  raw: string | null | undefined,
): number | null | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
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
  const limite =
    typeof dto.limiteUsosPorSocio === 'number' &&
    Number.isFinite(dto.limiteUsosPorSocio)
      ? dto.limiteUsosPorSocio
      : null;

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
    limiteUsosPorSocio: limite,
    usageLimitLabel: formatLimiteUsosPorSocioLabel(limite),
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

function withOptionalLimite(
  base: Omit<CrearBeneficioRequestDto, 'limiteUsosPorSocio'>,
  form: ComercioBeneficioFormValue,
): CrearBeneficioRequestDto {
  const limite = parseLimiteUsosPorSocioInput(form.usageLimit);
  if (typeof limite !== 'number') {
    return base;
  }
  return { ...base, limiteUsosPorSocio: limite };
}

export function mapPromotionFormToCreateRequest(
  form: ComercioBeneficioFormValue,
): CrearBeneficioRequestDto {
  return withOptionalLimite(
    {
      titulo: form.title.trim(),
      descripcion: form.description.trim() || undefined,
      tipoBeneficioId: form.typeId.trim(),
      valor: form.value.trim(),
      fechaInicioVigencia: optionalDate(form.validFrom),
      fechaFinVigencia: optionalDate(form.validTo),
    },
    form,
  );
}

export function mapPromotionFormToUpdateRequest(
  form: ComercioBeneficioFormValue,
): ActualizarBeneficioRequestDto {
  return withOptionalLimite(
    {
      titulo: form.title.trim(),
      descripcion: form.description.trim() || undefined,
      tipoBeneficioId: form.typeId.trim(),
      valor: form.value.trim(),
      fechaInicioVigencia: optionalDate(form.validFrom),
      fechaFinVigencia: optionalDate(form.validTo),
    },
    form,
  );
}

export function mapPromotionStatusToNextEstado(
  current: BeneficioEstadoDto,
): BeneficioEstadoDto {
  return current === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
}

/** Formats `YYYY-MM-DD` as `DD/MM/YYYY` using calendar parts (no UTC shift). */
export function formatBeneficioCalendarDate(
  value: string | null | undefined,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  if (!match) {
    return null;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function toLocalCalendarDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayLocalCalendar(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Explains why a promotion stayed INACTIVA after a successful ACTIVO PATCH
 * (effective state from GET, typically vigencia).
 */
export function buildActivationNotEffectiveMessage(
  promo:
    | Pick<ComercioBeneficioViewModel, 'validFrom' | 'validTo'>
    | null
    | undefined,
): string {
  const start = toLocalCalendarDate(promo?.validFrom);
  const end = toLocalCalendarDate(promo?.validTo);
  const today = todayLocalCalendar();
  const startLabel = formatBeneficioCalendarDate(promo?.validFrom);
  const endLabel = formatBeneficioCalendarDate(promo?.validTo);

  if (start && startLabel && today.getTime() < start.getTime()) {
    return `La promoción todavía no está vigente. Podrá activarse a partir del ${startLabel}.`;
  }

  if (end && endLabel && today.getTime() > end.getTime()) {
    return `La promoción no puede activarse porque su período de vigencia finalizó el ${endLabel}.`;
  }

  if (
    start &&
    end &&
    today.getTime() >= start.getTime() &&
    today.getTime() <= end.getTime()
  ) {
    return 'El backend no dejó la promoción activa. Revisá el estado o intentá nuevamente.';
  }

  if (startLabel && endLabel) {
    return `La promoción no se activó porque su vigencia es del ${startLabel} al ${endLabel}.`;
  }

  return 'No se pudo activar la promoción porque no se encuentra dentro de su período de vigencia.';
}
