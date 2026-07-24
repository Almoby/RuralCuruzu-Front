import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { DateEsPipe } from '../../../shared/pipes';
import { AuthService } from '../../../core/services/auth.service';
import { MembershipRequestService } from '../../../core/services/membership-request.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  MembershipRequest,
  MembershipRequestFilter,
  MembershipRequestSummary,
} from '../../../core/interfaces/member-request.interface';
import { RequestStatus } from '../../../shared/enums';
import {
  categoryBadge,
  membershipTypeLabel,
  requestStatusBadge,
} from '../utils/admin-labels';
import { RequestDetailModal, RequestDetailMode } from './request-detail-modal/request-detail-modal';

type ViewState = 'loading' | 'success' | 'empty' | 'error';

interface RequestTab {
  id: MembershipRequestFilter;
  label: string;
  count: number;
}

@Component({
  selector: 'app-member-requests',
  standalone: true,
  imports: [
    AppPageHeader,
    AppBadge,
    AppButton,
    AppEmptyState,
    AppLoading,
    AppIcon,
    AppAlert,
    DateEsPipe,
    RequestDetailModal,
  ],
  templateUrl: './member-requests.html',
  styleUrl: './member-requests.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberRequestsPage {
  private readonly requestService = inject(MembershipRequestService);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly viewState = signal<ViewState>('loading');
  protected readonly submitting = signal(false);
  protected readonly requests = signal<MembershipRequest[]>([]);
  protected readonly filter = signal<MembershipRequestFilter>('all');
  protected readonly selected = signal<MembershipRequest | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detailMode = signal<RequestDetailMode>('view');

  protected readonly summary = computed((): MembershipRequestSummary => {
    const items = this.requests();
    return {
      total: items.length,
      pending: items.filter((item) => item.status === RequestStatus.Pendiente).length,
      approved: items.filter((item) => item.status === RequestStatus.Aprobada).length,
      rejected: items.filter((item) => item.status === RequestStatus.Rechazada).length,
    };
  });

  protected readonly pendingCount = computed(() => this.summary().pending);

  protected readonly subtitle = computed(() => {
    const count = this.pendingCount();
    if (count === 1) {
      return '1 pendiente de revisión';
    }
    return `${count} pendientes de revisión`;
  });

  protected readonly unprocessedBadge = computed(() => {
    const count = this.pendingCount();
    if (count <= 0) {
      return null;
    }
    if (count === 1) {
      return '1 sin procesar';
    }
    return `${count} sin procesar`;
  });

  protected readonly tabs = computed((): RequestTab[] => {
    const summary = this.summary();
    return [
      { id: 'all', label: 'Todas', count: summary.total },
      { id: 'pending', label: 'Pendientes', count: summary.pending },
      { id: 'approved', label: 'Aprobadas', count: summary.approved },
      { id: 'rejected', label: 'Rechazadas', count: summary.rejected },
    ];
  });

  protected readonly filtered = computed(() => {
    const current = this.filter();
    const items = this.requests();
    if (current === 'all') {
      return items;
    }
    const statusMap: Record<Exclude<MembershipRequestFilter, 'all'>, RequestStatus> = {
      pending: RequestStatus.Pendiente,
      approved: RequestStatus.Aprobada,
      rejected: RequestStatus.Rechazada,
    };
    return items.filter((item) => item.status === statusMap[current]);
  });

  protected readonly categoryBadge = categoryBadge;
  protected readonly requestStatusBadge = requestStatusBadge;
  protected readonly membershipTypeLabel = membershipTypeLabel;
  protected readonly RequestStatus = RequestStatus;

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => this.viewState.set('loading')),
        switchMap(() =>
          this.requestService.getRequests().pipe(
            catchError(() => {
              this.viewState.set('error');
              this.notifications.error('No se pudieron cargar las solicitudes');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.requests.set(items);
        this.viewState.set(items.length === 0 ? 'empty' : 'success');
      });
  }

  protected setFilter(filter: MembershipRequestFilter): void {
    this.filter.set(filter);
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected openDetail(request: MembershipRequest): void {
    this.selected.set(request);
    this.detailMode.set(
      request.status === RequestStatus.Pendiente ? 'review' : 'view',
    );
    this.detailOpen.set(true);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.selected.set(null);
  }

  protected actionLabel(request: MembershipRequest): string {
    return request.status === RequestStatus.Pendiente ? 'Revisar' : 'Ver detalle';
  }

  protected actionVariant(request: MembershipRequest): 'primary' | 'soft' {
    return request.status === RequestStatus.Pendiente ? 'primary' : 'soft';
  }

  protected statusIcon(status: RequestStatus): string {
    if (status === RequestStatus.Pendiente) {
      return 'clock';
    }
    if (status === RequestStatus.Aprobada) {
      return 'check_circle';
    }
    return 'x_circle';
  }

  protected approve(note: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }

    const reviewer = this.authService.currentUser()?.fullName ?? 'Administrador';
    this.submitting.set(true);

    this.requestService
      .approveRequest(request.id, reviewer, note || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notifications.success('Solicitud aprobada');
          this.closeDetail();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo aprobar la solicitud');
        },
      });
  }

  protected reject(note: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }

    const reviewer = this.authService.currentUser()?.fullName ?? 'Administrador';
    const reason = note || 'Solicitud rechazada';
    this.submitting.set(true);

    this.requestService
      .rejectRequest(request.id, reviewer, reason, note || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notifications.success('Solicitud rechazada');
          this.closeDetail();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo rechazar la solicitud');
        },
      });
  }
}
