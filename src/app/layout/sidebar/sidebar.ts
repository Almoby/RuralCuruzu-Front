import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, filter, of, startWith, switchMap } from 'rxjs';
import { APP_NAVIGATION, NavItem } from '../../core/config/app.config';
import { APP_ROUTES } from '../../core/constants/routes.constant';
import { AuthService } from '../../core/services/auth.service';
import { MembershipRequestService } from '../../core/services/membership-request.service';
import { UserRole } from '../../shared/enums';
import { AppIcon } from '../../shared/components/icon/app-icon';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AppIcon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly membershipRequestService = inject(MembershipRequestService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly closed = output<void>();

  private readonly pendingRequestsCount = signal(0);

  protected readonly navItems = computed(() => {
    const role = this.authService.currentRole();
    if (!role) {
      return [];
    }
    return APP_NAVIGATION[role] ?? [];
  });

  protected readonly showPendingIndicator = computed(() => this.pendingRequestsCount() > 0);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        switchMap(() => {
          if (this.authService.currentRole() !== UserRole.Admin) {
            return of(0);
          }
          return this.membershipRequestService.countPending().pipe(catchError(() => of(0)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((count) => this.pendingRequestsCount.set(count));
  }

  protected routeLink(route: string): string[] {
    return ['/', ...route.split('/')];
  }

  protected isRequestsItem(item: NavItem): boolean {
    return (
      this.authService.currentRole() === UserRole.Admin &&
      item.route === APP_ROUTES.admin.requests
    );
  }

  protected onNavigate(): void {
    this.closed.emit();
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/', ...APP_ROUTES.auth.login.split('/')]);
    this.closed.emit();
  }
}
