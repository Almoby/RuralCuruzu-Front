import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  ContadorNoLeidasResponseDto,
  NotificacionResponseDto,
  NotificationViewModel,
} from '../interfaces/notification-api.interface';
import {
  mapNotificacionesToViewModels,
  mapUnreadCount,
} from '../mappers/notification-api.mapper';

/**
 * Header notifications — always real backend (ignores environment.useMocks).
 * Distinct from {@link NotificationService} (toast UI).
 */
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/notificaciones`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  private readonly unreadCountSignal = signal(0);
  readonly unreadCount = this.unreadCountSignal.asReadonly();

  /** GET /notificaciones/no-leidas/contador */
  getUnreadCount(): Observable<number> {
    return this.http
      .get<ContadorNoLeidasResponseDto>(`${this.baseUrl}/no-leidas/contador`, {
        context: this.silentContext,
      })
      .pipe(
        map(mapUnreadCount),
        tap((count) => this.unreadCountSignal.set(count)),
      );
  }

  /** GET /notificaciones */
  getMyNotifications(): Observable<NotificationViewModel[]> {
    return this.http
      .get<NotificacionResponseDto[]>(this.baseUrl, {
        context: this.silentContext,
      })
      .pipe(map(mapNotificacionesToViewModels));
  }

  /** PATCH /notificaciones/{id}/leida */
  markAsRead(notificationId: string): Observable<void> {
    return this.http
      .patch<void>(`${this.baseUrl}/${notificationId}/leida`, null, {
        context: this.silentContext,
      })
      .pipe(
        tap(() => {
          this.unreadCountSignal.update((count) => Math.max(0, count - 1));
        }),
        map(() => undefined),
      );
  }

  /** Clears badge state (logout / user switch). */
  reset(): void {
    this.unreadCountSignal.set(0);
  }
}
