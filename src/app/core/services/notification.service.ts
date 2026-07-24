import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationsSignal = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  warning(message: string): void {
    this.push('warning', message);
  }

  dismiss(id: string): void {
    this.notificationsSignal.update((items) => items.filter((item) => item.id !== id));
  }

  clear(): void {
    this.notificationsSignal.set([]);
  }

  private push(type: NotificationType, message: string): void {
    const notification: AppNotification = {
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      createdAt: Date.now(),
    };
    this.notificationsSignal.update((items) => [notification, ...items].slice(0, 5));

    window.setTimeout(() => this.dismiss(notification.id), 4000);
  }
}
