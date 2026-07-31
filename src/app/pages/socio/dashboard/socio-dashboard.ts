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
import { DashboardService } from '../../../core/services/dashboard.service';
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
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly routes = APP_ROUTES;
  readonly viewState = signal<PanelViewState>('loading');
  readonly dashboard = signal<MemberDashboardResponse | null>(null);

  readonly profile = computed(() => this.dashboard()?.profile ?? null);
  readonly membershipStatus = computed(() => this.dashboard()?.membershipStatus ?? null);
  readonly quickAccess = computed(() => this.dashboard()?.quickAccess ?? []);
  readonly financial = computed(() => this.dashboard()?.financial ?? null);
  readonly availableBenefits = computed(() => this.dashboard()?.availableBenefits ?? []);
  readonly recentUsage = computed(() => this.dashboard()?.recentUsage ?? []);

  readonly greeting = computed(() => {
    const firstName = this.profile()?.firstName?.trim();
    return firstName ? `¡Hola, ${firstName}!` : '¡Hola!';
  });

  readonly profileLine = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return '';
    }
    return `Socio ${profile.memberCode} · ${profile.planLabel}`;
  });

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
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

  private load(): void {
    this.viewState.set('loading');
    this.dashboardService
      .getMemberDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.dashboard.set(payload);
          this.viewState.set('success');
        },
        error: () => {
          this.dashboard.set(null);
          this.viewState.set('error');
        },
      });
  }
}
