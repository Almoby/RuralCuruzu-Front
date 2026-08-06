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
import { catchError, filter, merge, of, startWith, switchMap } from 'rxjs';
import { APP_NAVIGATION, NavItem } from '../../core/config/app.config';
import { PORTAL_BRANDING } from '../../core/config/socio-ui.config';
import { APP_ROUTES } from '../../core/constants/routes.constant';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import { MembershipRequestService } from '../../core/services/membership-request.service';
import { UserIdentityService } from '../../core/services/user-identity.service';
import { asDisplayableBusinessCode } from '../../core/utils/display-identity.util';
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
  private readonly userIdentity = inject(UserIdentityService);
  private readonly feeService = inject(FeeService);
  private readonly membershipRequestService = inject(MembershipRequestService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly closed = output<void>();

  private readonly pendingRequestsCount = signal(0);
  private socioNumeroHydrationStarted = false;

  protected readonly organizationName = PORTAL_BRANDING.organizationName;

  protected readonly navItems = computed(() => {
    const role = this.authService.currentRole();
    if (!role) {
      return [];
    }
    return APP_NAVIGATION[role] ?? [];
  });

  /**
   * Secondary brand line:
   * - SOCIO: `{numeroSocio} · {nombreCompleto}` when numero is known
   * - COMERCIO / ADMIN: full display name (no technical ids)
   */
  protected readonly sidebarIdentityLabel = computed(() =>
    this.userIdentity.sidebarIdentityLabel(),
  );

  protected readonly showPendingIndicator = computed(() => this.pendingRequestsCount() > 0);

  constructor() {
    merge(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
      ),
      this.membershipRequestService.changes$,
    )
      .pipe(
        switchMap(() => {
          if (this.authService.currentRole() !== UserRole.Admin) {
            return of(0);
          }
          return this.membershipRequestService.countPending().pipe(catchError(() => of(0)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((count) => this.pendingRequestsCount.set(count));

    // Legacy fallback: hydrate Socio number from cuotas/pagos only when login
    // session (and cache) do not already provide numeroSocio.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        switchMap(() => {
          if (this.authService.currentRole() !== UserRole.Socio) {
            this.socioNumeroHydrationStarted = false;
            return of(null);
          }

          const session = this.authService.getCurrentSession();
          const hasNumero =
            !!asDisplayableBusinessCode(session?.numeroSocio) ||
            !!this.userIdentity.socioNumero() ||
            !!asDisplayableBusinessCode(this.authService.currentUser()?.memberCode);

          if (hasNumero || this.socioNumeroHydrationStarted) {
            return of(null);
          }

          this.socioNumeroHydrationStarted = true;
          return this.feeService.getSocioCuotas().pipe(
            catchError(() => this.feeService.getSocioPayments()),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/', ...APP_ROUTES.auth.login.split('/')]);
          this.closed.emit();
        },
        error: () => {
          void this.router.navigate(['/', ...APP_ROUTES.auth.login.split('/')]);
          this.closed.emit();
        },
      });
  }
}
