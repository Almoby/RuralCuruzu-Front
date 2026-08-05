import {
  ContadorNoLeidasResponseDto,
  NotificacionResponseDto,
  NotificacionTipoDto,
  NotificationResultTone,
  NotificationViewModel,
} from '../interfaces/notification-api.interface';

const TIPO_ICONS: Record<NotificacionTipoDto, string> = {
  SOLICITUD_RECIBIDA: 'inbox',
  SOLICITUD_APROBADA: 'check_circle',
  SOLICITUD_RECHAZADA: 'x_circle',
  SOLICITUD_OBSERVACION: 'alert_circle',
  SOLICITUD_RESPUESTA_RECIBIDA: 'mail',
  CREDENCIALES_ACCESO: 'lock',
  CUOTA_GENERADA: 'payments',
  CUOTA_PROXIMA_A_VENCER: 'clock',
  CUOTA_VENCIDA: 'alert',
  PAGO_INFORMADO: 'banknote',
  PAGO_APROBADO: 'check_circle',
  PAGO_RECHAZADO: 'x_circle',
  CUENTA_AL_DIA: 'check',
  RECUPERACION_PASSWORD: 'lock',
  PASSWORD_CAMBIADA: 'lock',
  COMERCIO_ELIMINADO: 'storefront',
};

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function mapIcon(tipo: string | null | undefined): string {
  const key = text(tipo).toUpperCase() as NotificacionTipoDto;
  return TIPO_ICONS[key] ?? 'bell';
}

function mapResultTone(
  resultado: string | null | undefined,
): NotificationResultTone {
  switch (text(resultado).toUpperCase()) {
    case 'EXITOSO':
      return 'success';
    case 'FALLIDO':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatNotificationDateLabel(
  iso: string | null | undefined,
): string {
  const raw = text(iso);
  if (!raw) {
    return '';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '');
}

export function mapNotificacionDtoToViewModel(
  dto: NotificacionResponseDto,
): NotificationViewModel | null {
  const id = text(dto.id);
  if (!id) {
    return null;
  }

  const sentAt = text(dto.fechaEnvio);

  return {
    id,
    type: text(dto.tipo),
    subject: text(dto.asunto, 'Notificación'),
    message: text(dto.mensaje),
    read: dto.leida === true,
    sentAt,
    sentAtLabel: formatNotificationDateLabel(sentAt),
    icon: mapIcon(dto.tipo),
    resultTone: mapResultTone(dto.resultado),
  };
}

export function mapNotificacionesToViewModels(
  items: NotificacionResponseDto[] | null | undefined,
): NotificationViewModel[] {
  return (items ?? [])
    .map(mapNotificacionDtoToViewModel)
    .filter((item): item is NotificationViewModel => item !== null);
}

export function mapUnreadCount(
  dto: ContadorNoLeidasResponseDto | null | undefined,
): number {
  const cantidad = dto?.cantidad;
  if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad < 0) {
    return 0;
  }
  return Math.floor(cantidad);
}

export function formatUnreadBadge(count: number): string {
  if (count <= 0) {
    return '';
  }
  if (count > 99) {
    return '99+';
  }
  return String(count);
}
