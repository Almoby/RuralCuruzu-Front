import { ApiError } from '../interfaces/api-response.interface';
import {
  ComercioQrRedemptionRejectedViewModel,
  ComercioQrRedemptionSuccessViewModel,
  ValidarBeneficioRequestDto,
  ValidarBeneficioResponseDto,
} from '../interfaces/comercio-qr-redemption.interface';
import { ComercioBeneficioViewModel } from '../interfaces/comercio-beneficio.interface';

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function categoryLabel(categoria: string | null | undefined): string {
  switch (text(categoria).toUpperCase()) {
    case 'ACTIVO':
      return 'Socio Activo';
    case 'ADHERENTE':
      return 'Socio Adherente';
    default:
      return text(categoria) || 'Socio';
  }
}

function buildInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toLocaleUpperCase('es-AR');
  }
  return (fullName.trim().charAt(0) || '?').toLocaleUpperCase('es-AR');
}

/** Formats Instant/date-time for the success card (es-AR). */
export function formatFechaUsoLabel(iso: string | null | undefined): string {
  const raw = text(iso);
  if (!raw) {
    return 'Sin fecha';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatMontoAhorroLabel(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function mapValidarBeneficioResponseToSuccessViewModel(
  dto: ValidarBeneficioResponseDto,
): ComercioQrRedemptionSuccessViewModel {
  const fullName = text(dto.socioNombre, 'Socio');
  const savings =
    typeof dto.montoAhorro === 'number' && Number.isFinite(dto.montoAhorro)
      ? dto.montoAhorro
      : 0;
  const validatedAt = text(dto.fechaUso) || new Date().toISOString();

  return {
    message: text(dto.mensaje, '¡Beneficio aprobado!'),
    fullName,
    initials: buildInitials(fullName),
    memberNumber: text(dto.socioNumeroSocio, '—'),
    category: categoryLabel(dto.socioCategoria),
    benefitName: text(dto.beneficioTitulo, 'Beneficio'),
    benefitValue: text(dto.beneficioValor, '—'),
    benefitTypeLabel: text(dto.beneficioTipoNombre, 'Beneficio'),
    savingsAmount: savings,
    savingsLabel: formatMontoAhorroLabel(savings),
    validatedAt,
    validatedAtLabel: formatFechaUsoLabel(validatedAt),
  };
}

export function mapValidarBeneficioFormToRequest(input: {
  codigoQr: string;
  beneficioId: string;
  montoAhorro: number;
}): ValidarBeneficioRequestDto {
  return {
    codigoQr: input.codigoQr.trim(),
    beneficioId: input.beneficioId.trim(),
    montoAhorro: input.montoAhorro,
  };
}

/** Parses user input into a numeric montoAhorro (dot decimal). Returns null if invalid. */
export function parseMontoAhorroInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function mapApiErrorToRejectedViewModel(
  error: ApiError,
): ComercioQrRedemptionRejectedViewModel {
  const status = error.status;
  const message = text(error.message, 'No se pudo aplicar el beneficio.');

  if (status === 409) {
    return {
      reasonTitle: 'Beneficio ya utilizado',
      reasonDescription:
        message || 'Este socio ya utilizó este beneficio.',
      clearQrToken: true,
      reloadBenefits: false,
      httpStatus: status,
    };
  }

  if (status === 404) {
    return {
      reasonTitle: 'QR o beneficio no válido',
      reasonDescription: message,
      clearQrToken: true,
      reloadBenefits: true,
      httpStatus: status,
    };
  }

  if (status === 400) {
    const lower = message.toLowerCase();
    const expired =
      lower.includes('expir') ||
      lower.includes('vencid') ||
      lower.includes('actualic');
    const benefitIssue =
      lower.includes('beneficio') ||
      lower.includes('pausad') ||
      lower.includes('vigente');

    return {
      reasonTitle: expired
        ? 'QR vencido'
        : benefitIssue
          ? 'Beneficio no disponible'
          : 'No se pudo aplicar el beneficio',
      reasonDescription: message,
      clearQrToken: true,
      reloadBenefits: benefitIssue,
      httpStatus: status,
    };
  }

  if (status === 403) {
    return {
      reasonTitle: 'Sin permisos',
      reasonDescription: message || 'El comercio no puede aplicar beneficios.',
      clearQrToken: false,
      reloadBenefits: false,
      httpStatus: status,
    };
  }

  return {
    reasonTitle: 'Error al validar',
    reasonDescription: message,
    clearQrToken: false,
    reloadBenefits: false,
    httpStatus: status,
  };
}

/** Today as LocalDate `YYYY-MM-DD` (no UTC shift). */
function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Active + still within vigencia for the benefit selector. */
export function isBeneficioEligibleForRedemption(
  benefit: ComercioBeneficioViewModel,
): boolean {
  if (!benefit.isActive || !benefit.id) {
    return false;
  }
  if (benefit.validTo) {
    return benefit.validTo >= todayLocalIso();
  }
  return true;
}

export function mapBeneficioToSelectLabel(
  benefit: ComercioBeneficioViewModel,
): string {
  const parts = [benefit.title];
  if (benefit.typeLabel && benefit.typeLabel !== 'Beneficio') {
    parts.push(benefit.typeLabel);
  }
  if (benefit.valueLabel && benefit.valueLabel !== '—') {
    parts.push(benefit.valueLabel);
  }
  return parts.filter(Boolean).join(' · ');
}
