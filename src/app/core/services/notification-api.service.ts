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
 * Header notifications — REST API against the real backend.
 * Distinct from {@link NotificationService} (toast UI).
 * Complements {@link NotificationStreamService} (SSE) for real-time delivery.
 */
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/notificaciones`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  private readonly unreadCountSignal = signal(0);
  readonly unreadCount = this.unreadCountSignal.asReadonly();

  /** IDs already applied this session (REST + SSE) to avoid double counting. */
  private readonly observedIds = new Set<string>();

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

  /**
   * Tracks a notification id for the current session.
   * @returns true when the id was not seen before.
   */
  observeId(id: string): boolean {
    const trimmed = id.trim();
    if (!trimmed) {
      return false;
    }
    if (this.observedIds.has(trimmed)) {
      return false;
    }
    this.observedIds.add(trimmed);
    return true;
  }

  rememberIds(ids: readonly string[]): void {
    for (const id of ids) {
      this.observeId(id);
    }
  }

  incrementUnread(): void {
    this.unreadCountSignal.update((count) => count + 1);
  }

  /** Merge by id and sort by sentAt descending (does not mutate inputs). */
  mergeNotifications(
    primary: readonly NotificationViewModel[],
    secondary: readonly NotificationViewModel[],
  ): NotificationViewModel[] {
    const byId = new Map<string, NotificationViewModel>();
    for (const item of primary) {
      byId.set(item.id, item);
    }
    for (const item of secondary) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    return Array.from(byId.values()).sort((a, b) => {
      const dateCmp = (b.sentAt || '').localeCompare(a.sentAt || '');
      if (dateCmp !== 0) {
        return dateCmp;
      }
      return a.id.localeCompare(b.id);
    });
  }

  /** Clears badge + SSE/REST dedupe state (logout / user switch). */
  reset(): void {
    this.unreadCountSignal.set(0);
    this.observedIds.clear();
  }
}
