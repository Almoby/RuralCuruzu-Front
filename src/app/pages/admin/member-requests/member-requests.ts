import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, startWith, switchMap, tap } from 'rxjs';
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
import { MembershipRequestService } from '../../../core/services/membership-request.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
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
  requestStatusIcon,
  requestStatusLabel,
} from '../utils/admin-labels';
import { canReviewSolicitud } from '../utils/solicitud-estado';
import {
  RequestDetailModal,
  RequestDetailMode,
} from './request-detail-modal/request-detail-modal';

type ViewState = 'loading' | 'success' | 'empty' | 'error';

interface RequestTab {
  id: MembershipRequestFilter;
  label: string;
  count: number;
}

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
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly viewState = signal<ViewState>('loading');
  protected readonly submitting = signal(false);
  protected readonly detailLoading = signal(false);
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
      inReview: items.filter((item) => item.status === RequestStatus.EnRevision).length,
      approved: items.filter((item) => item.status === RequestStatus.Aprobada).length,
      rejected: items.filter((item) => item.status === RequestStatus.Rechazada).length,
      cancelled: items.filter((item) => item.status === RequestStatus.Cancelada).length,
    };
  });

  protected readonly pendingCount = computed(
    () => this.summary().pending + this.summary().inReview,
  );

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
      { id: 'in_review', label: 'En revisión', count: summary.inReview },
      { id: 'approved', label: 'Aprobadas', count: summary.approved },
      { id: 'rejected', label: 'Rechazadas', count: summary.rejected },
      { id: 'cancelled', label: 'Canceladas', count: summary.cancelled },
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
      in_review: RequestStatus.EnRevision,
      approved: RequestStatus.Aprobada,
      rejected: RequestStatus.Rechazada,
      cancelled: RequestStatus.Cancelada,
    };
    return items.filter((item) => item.status === statusMap[current]);
  });

  protected readonly categoryBadge = categoryBadge;
  protected readonly requestStatusBadge = requestStatusBadge;
  protected readonly requestStatusLabel = requestStatusLabel;
  protected readonly requestStatusIcon = requestStatusIcon;
  protected readonly membershipTypeLabel = membershipTypeLabel;
  protected readonly RequestStatus = RequestStatus;

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => this.viewState.set('loading')),
        switchMap(() =>
          this.requestService.getRequests().pipe(
            catchError((error: unknown) => {
              this.viewState.set('error');
              this.notifications.error(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar las solicitudes',
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.requests.set(items);
        this.viewState.set(items.length === 0 ? 'empty' : 'success');
        this.syncSelectedFromList(items);
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
    this.detailMode.set(canReviewSolicitud(request.status) ? 'review' : 'view');
    this.detailOpen.set(true);
    this.loadDetail(request.id);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.selected.set(null);
    this.detailLoading.set(false);
  }

  protected actionLabel(request: MembershipRequest): string {
    return canReviewSolicitud(request.status) ? 'Revisar' : 'Ver detalle';
  }

  protected actionVariant(request: MembershipRequest): 'primary' | 'soft' {
    return canReviewSolicitud(request.status) ? 'primary' : 'soft';
  }

  protected passToReview(observacion: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    this.runEstadoAction(
      this.requestService.passToReview(request.id, observacion || undefined),
      true,
    );
  }

  protected approve(observacion: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    this.runEstadoAction(
      this.requestService.approve(request.id, observacion || undefined),
      true,
    );
  }

  protected reject(payload: { motivo: string; observacion: string }): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    const motivo = payload.motivo.trim();
    if (!motivo) {
      this.notifications.error('El motivo es obligatorio para rechazar');
      return;
    }
    this.runEstadoAction(
      this.requestService.reject(
        request.id,
        motivo,
        payload.observacion.trim() || undefined,
      ),
      true,
    );
  }

  protected cancelRequest(payload: { motivo: string; observacion: string }): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    const motivo = payload.motivo.trim();
    if (!motivo) {
      this.notifications.error('El motivo es obligatorio para cancelar');
      return;
    }
    this.runEstadoAction(
      this.requestService.cancel(
        request.id,
        motivo,
        payload.observacion.trim() || undefined,
      ),
      true,
    );
  }

  protected reopen(observacion: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    this.runEstadoAction(
      this.requestService.reopen(request.id, observacion || undefined),
      true,
    );
  }

  protected observe(observacion: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }
    const text = observacion.trim();
    if (!text) {
      this.notifications.error('La observación no puede estar vacía');
      return;
    }

    this.submitting.set(true);
    this.requestService
      .addObservacion(request.id, text)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.notifications.success(
            response.mensaje || 'Observación agregada correctamente',
          );
          this.reload$.next();
          this.loadDetail(request.id);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo agregar la observación',
          );
        },
      });
  }

  protected downloadFile(path: string): void {
    const request = this.selected();
    if (!request || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.requestService
      .downloadArchivo(request.id, path)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ blob, fileName }) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo descargar el archivo',
          );
        },
      });
  }

  private runEstadoAction(
    request$: ReturnType<MembershipRequestService['changeEstado']>,
    closeOnSuccess: boolean,
  ): void {
    const current = this.selected();
    this.submitting.set(true);
    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.notifications.success(
            response.mensaje || 'Estado actualizado correctamente',
          );
          this.reload$.next();
          if (closeOnSuccess) {
            this.closeDetail();
          } else if (current) {
            this.loadDetail(current.id);
          }
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo actualizar el estado',
          );
        },
      });
  }

  private loadDetail(numeroSolicitud: string): void {
    this.detailLoading.set(true);
    this.requestService
      .getByNumero(numeroSolicitud)
      .pipe(
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          if (!this.detailOpen()) {
            return;
          }
          this.selected.set(detail);
          this.detailMode.set(canReviewSolicitud(detail.status) ? 'review' : 'view');
          this.patchListItem(detail);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo cargar el detalle',
          );
        },
      });
  }

  private patchListItem(detail: MembershipRequest): void {
    this.requests.update((items) =>
      items.map((item) =>
        item.id === detail.id
          ? {
              ...item,
              fullName: detail.fullName,
              email: detail.email,
              category: detail.category,
              status: detail.status,
              submittedAt: detail.submittedAt || item.submittedAt,
              notes: detail.notes,
            }
          : item,
      ),
    );
  }

  private syncSelectedFromList(items: MembershipRequest[]): void {
    const current = this.selected();
    if (!current || !this.detailOpen()) {
      return;
    }
    const updated = items.find((item) => item.id === current.id);
    if (updated && !this.detailLoading()) {
      this.selected.update((prev) =>
        prev
          ? {
              ...prev,
              status: updated.status,
              fullName: updated.fullName,
              email: updated.email,
              category: updated.category,
            }
          : prev,
      );
    }
  }
}
