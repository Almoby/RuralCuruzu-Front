import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, fromEvent, map, startWith } from 'rxjs';
import { APP_NAVIGATION } from '../../core/config/app.config';
import { resolveLayoutTheme } from '../../core/config/layout-theme';
import { AuthService } from '../../core/services/auth.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { HeaderComponent } from '../header/header';
import { SidebarComponent } from '../sidebar/sidebar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationStream = inject(NotificationStreamService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sidebarOpen = signal(false);

  private readonly currentUrl = signal(this.router.url);

  protected readonly layoutTheme = computed(() =>
    resolveLayoutTheme(this.authService.currentRole()),
  );

  protected readonly pageTitle = computed(() => {
    const role = this.authService.currentRole();
    const url = this.currentUrl().replace(/^\//, '');
    if (!role) {
      return 'Portal SRCC';
    }

    const match = APP_NAVIGATION[role].find(
      (item) => url === item.route || url.startsWith(`${item.route}/`),
    );
    return match?.label ?? 'Portal SRCC';
  });

  constructor() {
    this.notificationStream.enable();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects),
        startWith(this.router.url),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => {
        this.currentUrl.set(url);
        this.sidebarOpen.set(false);
      });

    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Escape' && this.sidebarOpen()) {
          this.closeSidebar();
        }
      });

    effect(() => {
      const open = this.sidebarOpen();
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      document.body.style.overflow = open && isMobile ? 'hidden' : '';
    });

    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
      this.notificationStream.disable();
    });
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
