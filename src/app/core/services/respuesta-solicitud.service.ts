import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  MensajeResponse,
  ObservacionPendienteResponse,
} from '../interfaces/respuesta-solicitud.interface';

/**
 * Public member-request observation reply endpoints.
 * Always uses the real HTTP API (tokenized email links — no mocks).
 */
@Injectable({ providedIn: 'root' })
export class RespuestaSolicitudService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/respuesta-solicitud`;

  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  getPendingObservation(token: string): Observable<ObservacionPendienteResponse> {
    const params = new HttpParams().set('token', token);

    return this.http.get<ObservacionPendienteResponse>(this.baseUrl, {
      params,
      context: this.silentContext,
    });
  }

  sendResponse(
    token: string,
    texto: string,
    archivos: File[],
  ): Observable<MensajeResponse> {
    const params = new HttpParams().set('token', token).set('texto', texto);
    const formData = new FormData();

    for (const file of archivos) {
      formData.append('archivos', file);
    }

    return this.http.post<MensajeResponse>(this.baseUrl, formData, {
      params,
      context: this.silentContext,
    });
  }
}
