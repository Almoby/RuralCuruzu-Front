import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NotificacionResponseDto,
  NotificationViewModel,
} from '../interfaces/notification-api.interface';
import { mapNotificacionDtoToViewModel } from '../mappers/notification-api.mapper';
import { AuthService } from './auth.service';
import { NotificationApiService } from './notification-api.service';

export type NotificationStreamStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * SSE client for GET /notificaciones/stream?token=...
 * Singleton connection per tab; complementary to {@link NotificationApiService} REST.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private readonly auth = inject(AuthService);
  private readonly notificationApi = inject(NotificationApiService);

  private readonly enabledSignal = signal(false);
  private readonly statusSignal = signal<NotificationStreamStatus>('disconnected');
  private readonly eventsSubject = new Subject<NotificationViewModel>();

  private source: EventSource | null = null;
  private connectedToken: string | null = null;
  private hadSuccessfulOpen = false;

  readonly status = this.statusSignal.asReadonly();
  readonly notifications$: Observable<NotificationViewModel> =
    this.eventsSubject.asObservable();

  constructor() {
    effect(() => {
      const enabled = this.enabledSignal();
      const token = this.auth.session()?.accessToken?.trim() || '';
      untracked(() => {
        if (!enabled || !token || this.auth.isSessionExpiring()) {
          this.disconnect({ clearConnectionFlags: true });
          return;
        }
        this.ensureConnected(token);
      });
    });
  }

  /** Called by the private shell while the authenticated layout is mounted. */
  enable(): void {
    this.enabledSignal.set(true);
  }

  /** Called when leaving the private shell. */
  disable(): void {
    this.enabledSignal.set(false);
    this.disconnect({ clearConnectionFlags: true });
  }

  isSupported(): boolean {
    return typeof EventSource !== 'undefined';
  }

  private ensureConnected(accessToken: string): void {
    if (!this.isSupported()) {
      this.statusSignal.set('disconnected');
      return;
    }

    if (
      this.source &&
      this.connectedToken === accessToken &&
      this.source.readyState !== EventSource.CLOSED
    ) {
      return;
    }

    this.disconnect({ clearConnectionFlags: false });
    this.open(accessToken);
  }

  private open(accessToken: string): void {
    const url = this.buildStreamUrl(accessToken);
    this.statusSignal.set('connecting');
    this.connectedToken = accessToken;

    let source: EventSource;
    try {
      source = new EventSource(url);
    } catch {
      this.connectedToken = null;
      this.statusSignal.set('disconnected');
      return;
    }

    this.source = source;

    source.addEventListener('notificacion', (event: Event) => {
      this.handleNotificationEvent(event);
    });

    source.onopen = () => {
      if (this.source !== source) {
        return;
      }
      this.statusSignal.set('connected');
      if (this.hadSuccessfulOpen) {
        this.resyncUnreadCount();
      }
      this.hadSuccessfulOpen = true;
    };

    source.onerror = () => {
      if (this.source !== source) {
        return;
      }

      const latest = this.auth.session()?.accessToken?.trim() || '';
      if (
        !this.enabledSignal() ||
        !latest ||
        !this.auth.isAuthenticated() ||
        this.auth.isSessionExpiring()
      ) {
        this.disconnect({ clearConnectionFlags: true });
        return;
      }

      if (latest !== this.connectedToken) {
        this.ensureConnected(latest);
        return;
      }

      // Same token: allow native EventSource reconnection without toast spam.
      if (source.readyState === EventSource.CLOSED) {
        this.statusSignal.set('disconnected');
        return;
      }
      this.statusSignal.set('connecting');
    };
  }

  private handleNotificationEvent(event: Event): void {
    if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
      return;
    }

    const dto = this.parsePayload(event.data);
    if (!dto) {
      return;
    }

    const viewModel = mapNotificacionDtoToViewModel(dto);
    if (!viewModel) {
      return;
    }

    this.eventsSubject.next(viewModel);
  }

  private parsePayload(raw: string): NotificacionResponseDto | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as NotificacionResponseDto;
    } catch {
      return null;
    }
  }

  private buildStreamUrl(accessToken: string): string {
    const base = `${environment.apiBaseUrl}/notificaciones/stream`;
    return `${base}?token=${encodeURIComponent(accessToken)}`;
  }

  private resyncUnreadCount(): void {
    this.notificationApi.getUnreadCount().subscribe({
      error: () => {
        /* Silent: REST badge remains at last known value. */
      },
    });
  }

  private disconnect(options: { clearConnectionFlags: boolean }): void {
    if (this.source) {
      this.source.onopen = null;
      this.source.onerror = null;
      this.source.close();
      this.source = null;
    }
    this.connectedToken = null;
    this.statusSignal.set('disconnected');
    if (options.clearConnectionFlags) {
      this.hadSuccessfulOpen = false;
    }
  }
}
