/**
 * DTOs / ViewModels for header notifications.
 * Swagger tags: Notificaciones
 * - GET /api/notificaciones
 * - GET /api/notificaciones/no-leidas/contador
 * - PATCH /api/notificaciones/{id}/leida
 */

export type NotificacionTipoDto =
  | 'SOLICITUD_RECIBIDA'
  | 'SOLICITUD_APROBADA'
  | 'SOLICITUD_RECHAZADA'
  | 'SOLICITUD_OBSERVACION'
  | 'SOLICITUD_RESPUESTA_RECIBIDA'
  | 'CREDENCIALES_ACCESO'
  | 'CUOTA_GENERADA'
  | 'CUOTA_PROXIMA_A_VENCER'
  | 'CUOTA_VENCIDA'
  | 'PAGO_INFORMADO'
  | 'PAGO_APROBADO'
  | 'PAGO_RECHAZADO'
  | 'CUENTA_AL_DIA'
  | 'RECUPERACION_PASSWORD'
  | 'PASSWORD_CAMBIADA'
  | 'COMERCIO_ELIMINADO';

export type NotificacionResultadoDto = 'EXITOSO' | 'FALLIDO';

/** Swagger `NotificacionResponse` */
export interface NotificacionResponseDto {
  id?: string | null;
  tipo?: NotificacionTipoDto | string | null;
  asunto?: string | null;
  mensaje?: string | null;
  resultado?: NotificacionResultadoDto | string | null;
  leida?: boolean | null;
  fechaEnvio?: string | null;
}

/** Swagger `ContadorNoLeidasResponse` */
export interface ContadorNoLeidasResponseDto {
  cantidad?: number | null;
}

export type NotificationResultTone = 'success' | 'danger' | 'neutral';

export interface NotificationViewModel {
  id: string;
  type: string;
  subject: string;
  message: string;
  read: boolean;
  sentAt: string;
  sentAtLabel: string;
  icon: string;
  resultTone: NotificationResultTone;
}
