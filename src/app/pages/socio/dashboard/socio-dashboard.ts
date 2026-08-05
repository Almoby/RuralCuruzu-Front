import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { MemberDashboardResponse } from '../../../core/interfaces/dashboard.interface';
import {
  AppAlert,
  AppButton,
  AppCard,
  AppEmptyState,
  AppIcon,
  AppLoading,
} from '../../../shared/components';
import { CurrencyArsPipe } from '../../../shared/pipes';
import { resolveBenefitRubroIcon } from '../../../shared/utils';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { resolveSocioModuleIcon } from '../../../core/config/socio-ui.config';

type PanelViewState = 'loading' | 'success' | 'error';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

@Component({
  selector: 'app-socio-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AppCard,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppButton,
    AppIcon,
    CurrencyArsPipe,
  ],
  templateUrl: './socio-dashboard.html',
  styleUrl: './socio-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioDashboard {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  readonly routes = APP_ROUTES;
  readonly viewState = signal<PanelViewState>('loading');
  readonly dashboard = signal<MemberDashboardResponse | null>(null);
  readonly errorMessage = signal('No pudimos cargar tu panel. Reintentá en unos segundos.');

  readonly profile = computed(() => this.dashboard()?.profile ?? null);
  readonly membershipStatus = computed(() => this.dashboard()?.membershipStatus ?? null);
  readonly quickAccess = computed(() => this.dashboard()?.quickAccess ?? []);
  readonly financial = computed(() => this.dashboard()?.financial ?? null);
  readonly availableBenefits = computed(() => this.dashboard()?.availableBenefits ?? []);
  readonly recentUsage = computed(() => this.dashboard()?.recentUsage ?? []);

  /** Full name only — never firstName / last token split. */
  readonly greeting = computed(() => {
    const fullName =
      this.profile()?.fullName?.trim() ||
      this.auth.currentUser()?.fullName?.trim() ||
      '';
    return fullName ? `¡Hola, ${fullName}!` : '¡Hola!';
  });

  readonly profileLine = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return '';
    }

    const code = profile.memberCode?.trim();
    const plan = profile.planLabel?.trim();
    const hasCode = !!code && code !== '—';

    if (hasCode && plan) {
      return `Socio ${code} · ${plan}`;
    }
    if (hasCode) {
      return `Socio ${code}`;
    }
    if (plan) {
      return plan;
    }
    return '';
  });

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.viewState.set('loading');
        }),
        switchMap(() =>
          this.dashboardService.getSocioPanelDashboard().pipe(
            catchError((error: unknown) => {
              this.dashboard.set(null);
              this.viewState.set('error');
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No pudimos cargar tu panel. Reintentá en unos segundos.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.dashboard.set(payload);
        this.viewState.set('success');
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected moduleIcon(route: string): string {
    return resolveSocioModuleIcon(route);
  }

  protected rubroTone(categoryName: string): string {
    return resolveBenefitRubroIcon(categoryName).tone;
  }

  protected rubroIcon(categoryName: string): string {
    return resolveBenefitRubroIcon(categoryName).icon;
  }

  protected formatSavings(amount: number): string {
    return `-$${amount.toLocaleString('en-US')}`;
  }

  protected routeLink(route: string): string[] {
    return ['/', ...route.split('/')];
  }
}
