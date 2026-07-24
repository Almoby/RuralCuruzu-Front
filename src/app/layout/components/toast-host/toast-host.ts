import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { AppAlert } from '../../../shared/components';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [AppAlert],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHostComponent {
  private readonly notificationService = inject(NotificationService);
  protected readonly notifications = this.notificationService.notifications;

  protected dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }
}
