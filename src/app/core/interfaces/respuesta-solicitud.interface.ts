/** Pending observation returned by GET /respuesta-solicitud. */
export interface ObservacionPendienteResponse {
  numeroSolicitud: string;
  nombreSolicitante: string;
  observacion: string;
  fechaHora: string;
}

/** Success payload from POST /respuesta-solicitud. */
export interface MensajeResponse {
  mensaje: string;
}

/** Backend error body (Swagger ApiErrorResponse). */
export interface ApiErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  errores?: CampoError[];
  codigo?: string;
}

export interface CampoError {
  campo?: string;
  mensaje?: string;
}

/** Selected attachment tracked in component state. */
export interface SelectedAttachment {
  id: string;
  file: File;
}
