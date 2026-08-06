import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { APP_ROUTES } from '../../core/constants/routes.constant';
import { NotificationViewModel } from '../../core/interfaces/notification-api.interface';
import { formatUnreadBadge } from '../../core/mappers/notification-api.mapper';
import { AuthService } from '../../core/services/auth.service';
import { NotificationApiService } from '../../core/services/notification-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { USER_ROLE_LABELS, UserRole } from '../../shared/enums';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppLoading } from '../../shared/components/loading/app-loading';

type HeaderPanel = 'none' | 'notifications' | 'profile';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AppIcon, AppLoading],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly notificationStream = inject(NotificationStreamService);
  private readonly toasts = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly title = input('Portal SRCC');
  readonly showBell = input(true);
  readonly menuToggle = output<void>();

  protected readonly user = this.authService.currentUser;
  protected readonly unreadCount = this.notificationApi.unreadCount;

  private readonly openPanelSignal = signal<HeaderPanel>('none');
  protected readonly openPanel = this.openPanelSignal.asReadonly();

  private readonly notificationsSignal = signal<NotificationViewModel[]>([]);
  protected readonly notifications = this.notificationsSignal.asReadonly();

  private readonly notificationsLoadingSignal = signal(false);
  protected readonly notificationsLoading = this.notificationsLoadingSignal.asReadonly();

  private readonly notificationsErrorSignal = signal(false);
  protected readonly notificationsError = this.notificationsErrorSignal.asReadonly();

  private markingReadIds = new Set<string>();

  protected readonly userDisplayName = computed(() => {
    const current = this.user();
    if (!current) {
      return '';
    }
    if (current.role === UserRole.Comercio) {
      return current.merchantName?.trim() || current.fullName?.trim() || '';
    }
    return current.fullName?.trim() || '';
  });

  protected readonly userInitial = computed(() => {
    const name = this.userDisplayName();
    if (!name) {
      return '?';
    }
    return name.charAt(0).toLocaleUpperCase('es-AR');
  });

  protected readonly userRoleLabel = computed(() => {
    const role = this.user()?.role;
    if (!role) {
      return '';
    }
    return USER_ROLE_LABELS[role];
  });

  protected readonly unreadBadge = computed(() =>
    formatUnreadBadge(this.unreadCount()),
  );

  protected readonly showUnreadBadge = computed(() => this.unreadCount() > 0);

  protected readonly currentDateLabel = computed(() => {
    const formatter = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatter.format(new Date());
  });

  constructor() {
    effect(() => {
      const session = this.authService.session();
      untracked(() => {
        if (!session) {
          this.notificationApi.reset();
          this.resetNotificationState();
          this.closePanels();
          return;
        }
        this.refreshUnreadCount();
      });
    });

    this.notificationStream.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => {
        this.applyRealtimeNotification(item);
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.closePanels();
      });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.openPanelSignal() === 'none') {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    this.closePanels();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.openPanelSignal() !== 'none') {
      this.closePanels();
    }
  }

  protected onMenuClick(): void {
    this.menuToggle.emit();
  }

  protected toggleNotifications(): void {
    const next = this.openPanelSignal() === 'notifications' ? 'none' : 'notifications';
    this.openPanelSignal.set(next);
    if (next === 'notifications') {
      this.loadNotifications();
    }
  }

  protected toggleProfile(): void {
    const next = this.openPanelSignal() === 'profile' ? 'none' : 'profile';
    this.openPanelSignal.set(next);
  }

  protected loadNotifications(): void {
    this.notificationsLoadingSignal.set(true);
    this.notificationsErrorSignal.set(false);

    this.notificationApi
      .getMyNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.notificationApi.rememberIds(items.map((item) => item.id));
          this.notificationsSignal.update((current) =>
            this.notificationApi.mergeNotifications(items, current),
          );
          this.notificationsLoadingSignal.set(false);
          this.notificationsErrorSignal.set(false);
        },
        error: () => {
          this.notificationsLoadingSignal.set(false);
          this.notificationsErrorSignal.set(true);
        },
      });
  }

  protected onNotificationClick(item: NotificationViewModel): void {
    if (item.read || this.markingReadIds.has(item.id)) {
      return;
    }

    this.markingReadIds.add(item.id);
    this.notificationApi
      .markAsRead(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationsSignal.update((list) =>
            list.map((entry) =>
              entry.id === item.id ? { ...entry, read: true } : entry,
            ),
          );
          this.markingReadIds.delete(item.id);
        },
        error: () => {
          this.markingReadIds.delete(item.id);
        },
      });
  }

  protected goToChangePassword(): void {
    this.closePanels();
    void this.router.navigate(['/', ...APP_ROUTES.auth.changePassword.split('/')]);
  }

  protected logout(): void {
    this.closePanels();
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationApi.reset();
          void this.router.navigate(['/', ...APP_ROUTES.auth.login.split('/')]);
        },
        error: () => {
          this.notificationApi.reset();
          void this.router.navigate(['/', ...APP_ROUTES.auth.login.split('/')]);
        },
      });
  }

  private refreshUnreadCount(): void {
    this.notificationApi
      .getUnreadCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          /* Badge stays at last known / 0; header remains usable. */
        },
      });
  }

  private applyRealtimeNotification(item: NotificationViewModel): void {
    if (!this.notificationApi.observeId(item.id)) {
      return;
    }

    if (!item.read) {
      this.notificationApi.incrementUnread();
    }

    const panelOpen = this.openPanelSignal() === 'notifications';
    if (panelOpen) {
      this.notificationsSignal.update((list) =>
        this.notificationApi.mergeNotifications([item], list),
      );
      return;
    }

    if (!item.read) {
      const toastText = item.subject.trim() || 'Nueva notificación';
      this.toasts.info(toastText);
    }
  }

  private closePanels(): void {
    this.openPanelSignal.set('none');
  }

  private resetNotificationState(): void {
    this.notificationsSignal.set([]);
    this.notificationsLoadingSignal.set(false);
    this.notificationsErrorSignal.set(false);
    this.markingReadIds.clear();
  }
}
