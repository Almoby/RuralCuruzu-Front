import {
  MemberQrPayload,
  MemberQrProfile,
  MemberQrResponse,
  MemberQrStatus,
  MemberQrSummary,
  ShareQrPayload,
} from '../interfaces/member-qr.interface';
import {
  MiQrResponseDto,
  SocioQrCategoria,
  SocioQrEstado,
} from '../interfaces/socio-qr.interface';
import { APP_ROUTES } from '../constants/routes.constant';

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/** Formats LocalDate `YYYY-MM-DD` as `d/m/yyyy` without UTC shift. */
function formatLocalDateLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Sin datos';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Sin datos';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    return formatLocalDateLabel(value);
  }
  return value.trim();
}

function categoryLabel(categoria: SocioQrCategoria | undefined): string {
  switch (categoria) {
    case 'ACTIVO':
      return 'Socio Activo';
    case 'ADHERENTE':
      return 'Socio Adherente';
    default:
      return '';
  }
}

function mapUiStatus(estado: SocioQrEstado | undefined): {
  status: MemberQrStatus;
  statusLabel: string;
  statusIcon: string;
} {
  switch (estado) {
    case 'ACTIVO':
      return {
        status: 'active',
        statusLabel: 'QR Activo',
        statusIcon: 'check_circle',
      };
    case 'VENCIDO':
      return {
        status: 'expired',
        statusLabel: 'QR no vigente',
        statusIcon: 'alert_circle',
      };
    case 'INACTIVO_POR_DEUDA':
      return {
        status: 'suspended',
        statusLabel: 'Inactivo por deuda',
        statusIcon: 'alert_circle',
      };
    case 'INACTIVO_POR_SUSPENSION':
      return {
        status: 'suspended',
        statusLabel: 'Cuenta suspendida',
        statusIcon: 'alert_circle',
      };
    case 'BLOQUEADO':
      return {
        status: 'suspended',
        statusLabel: 'QR bloqueado',
        statusIcon: 'alert_circle',
      };
    default:
      return {
        status: 'suspended',
        statusLabel: 'QR no disponible',
        statusIcon: 'alert_circle',
      };
  }
}

function buildProfile(dto: MiQrResponseDto): MemberQrProfile {
  return {
    memberId: text(dto.numeroSocio, 'socio'),
    memberNumber: text(dto.numeroSocio, '—'),
    memberName: text(dto.nombre, 'Socio'),
    categoryLabel: categoryLabel(dto.categoria),
  };
}

function buildSummary(dto: MiQrResponseDto, available: boolean): MemberQrSummary {
  const helperFromBackend = text(dto.mensaje);
  return {
    nextDueDateLabel: formatLocalDateLabel(dto.fechaValidez),
    lastPaymentDateLabel: formatDateTimeLabel(dto.ultimoPago),
    renewalNote: available
      ? 'El código se actualiza automáticamente antes de vencer'
      : 'Actualizá cuando tu situación lo permita',
    helperText: helperFromBackend
      ? helperFromBackend
      : available
        ? 'Podés usar este QR en todos los comercios adheridos'
        : 'Tu QR no está disponible en este momento',
  };
}

function buildQrPayload(dto: MiQrResponseDto): MemberQrPayload | null {
  const token = text(dto.token);
  if (!token) {
    return null;
  }

  const ui = mapUiStatus(dto.estado);
  return {
    qrValue: token,
    status: ui.status,
    statusLabel: ui.statusLabel,
    statusIcon: ui.statusIcon,
    generatedAt: new Date().toISOString(),
    expirationDate: text(dto.expiraEn),
  };
}

/**
 * Maps Swagger `MiQrResponse` to the Mi QR ViewModel.
 * The visual QR must encode `token` exactly — nothing else.
 */
export function mapMiQrDtoToViewModel(dto: MiQrResponseDto): MemberQrResponse {
  const available = dto.estado === 'ACTIVO' && !!text(dto.token);
  const profile = buildProfile(dto);
  const summary = buildSummary(dto, available);

  return {
    profile,
    qr: available ? buildQrPayload(dto) : null,
    summary,
    available,
    message: text(dto.mensaje, summary.helperText),
    expiresAt: available ? text(dto.expiraEn) || null : null,
  };
}

/** Share metadata without exposing the QR token. */
export function mapSocioQrSharePayload(view: MemberQrResponse): ShareQrPayload {
  const name = view.profile.memberName;
  const number = view.profile.memberNumber;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';

  return {
    title: `QR de ${name}`,
    text:
      number && number !== '—'
        ? `Código de socio ${number}. Presentá tu QR en la app Rural Curuzu.`
        : 'Presentá tu QR en la app Rural Curuzu.',
    url: origin ? `${origin}/${APP_ROUTES.socio.qr}` : '',
  };
}
