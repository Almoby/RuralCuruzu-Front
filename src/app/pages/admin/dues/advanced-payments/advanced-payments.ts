import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppLoading,
  AppPageHeader,
} from '../../../../shared/components';
import { AdminCuotaListItem } from '../../../../core/interfaces/admin-cuota.interface';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { FeeService } from '../../../../core/services/fee.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatPeriodLabel } from '../../../../shared/utils';

type ViewState = 'loading' | 'success' | 'empty' | 'error';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

@Component({
  selector: 'app-advanced-payments',
  standalone: true,
  imports: [AppPageHeader, AppButton, AppLoading, AppEmptyState, AppAlert],
  templateUrl: './advanced-payments.html',
  styleUrl: './advanced-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedPaymentsPage {
  private readonly feeService = inject(FeeService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly viewState = signal<ViewState>('loading');
  protected readonly items = signal<AdminCuotaListItem[]>([]);
  protected readonly errorMessage = signal('No se pudieron cargar los pagos adelantados.');

  protected readonly formatPeriodLabel = formatPeriodLabel;

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => this.viewState.set('loading')),
        switchMap(() =>
          this.feeService.getAdminPagosAdelantados().pipe(
            catchError((error: unknown) => {
              this.items.set([]);
              this.viewState.set('error');
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar los pagos adelantados.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        this.items.set(list);
        this.viewState.set(list.length === 0 ? 'empty' : 'success');
      });
  }

  protected retry(): void {
    this.reload$.next();
  }
}
