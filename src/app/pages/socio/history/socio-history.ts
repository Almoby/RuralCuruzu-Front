import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  forkJoin,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { BenefitService } from '../../../core/services/benefit.service';
import { FeeService } from '../../../core/services/fee.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { SocioHistoryViewModel } from '../../../core/interfaces/socio-history.interface';
import { mapSocioHistoryBundleToViewModel } from '../../../core/mappers/socio-history.mapper';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
  AppStatCard,
} from '../../../shared/components';
import { CurrencyArsPipe } from '../../../shared/pipes';

type HistoryTab = 'benefits' | 'payments';
type ViewState = 'loading' | 'success' | 'error';

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

const EMPTY_HISTORY: SocioHistoryViewModel = {
  savingsTotal: 0,
  usedBenefitsCount: 0,
  approvedPaymentsCount: 0,
  benefits: [],
  payments: [],
};

@Component({
  selector: 'app-socio-history',
  standalone: true,
  imports: [
    AppPageHeader,
    AppStatCard,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppButton,
    AppIcon,
    CurrencyArsPipe,
  ],
  templateUrl: './socio-history.html',
  styleUrl: './socio-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioHistory {
  private readonly benefitService = inject(BenefitService);
  private readonly feeService = inject(FeeService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  readonly viewState = signal<ViewState>('loading');
  readonly tab = signal<HistoryTab>('benefits');
  readonly history = signal<SocioHistoryViewModel>(EMPTY_HISTORY);
  readonly errorMessage = signal(
    'No pudimos cargar el historial. Reintentá en unos segundos.',
  );

  readonly savings = computed(() => this.history().savingsTotal);
  readonly usedBenefitsCount = computed(() => this.history().usedBenefitsCount);
  readonly paymentsCount = computed(() => this.history().approvedPaymentsCount);
  readonly redemptions = computed(() => this.history().benefits);
  readonly fees = computed(() => this.history().payments);

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.viewState.set('loading');
        }),
        switchMap(() =>
          forkJoin({
            historial: this.benefitService.getSocioBenefitHistory(),
            pagos: this.feeService.getSocioPaymentHistory(),
          }).pipe(
            map(mapSocioHistoryBundleToViewModel),
            catchError((error: unknown) => {
              this.history.set(EMPTY_HISTORY);
              this.viewState.set('error');
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No pudimos cargar el historial. Reintentá en unos segundos.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.history.set(payload);
        this.viewState.set('success');
      });
  }

  setTab(tab: HistoryTab): void {
    this.tab.set(tab);
  }

  protected retry(): void {
    this.reload$.next();
  }
}
