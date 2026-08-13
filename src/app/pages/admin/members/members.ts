import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  EMPTY,
  Subject,
  catchError,
  finalize,
  startWith,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
  AppSearch,
  AppSelect,
  SelectOption,
} from '../../../shared/components';
import { MemberService } from '../../../core/services/member.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  AdminMember,
  AdminMemberDetail,
  SocioCategoria,
  SocioEstado,
} from '../../../core/interfaces/admin-socio.interface';
import { mapSocioDetalleDtoToViewModel } from '../../../core/mappers/admin-socio.mapper';
import { initialsFromName } from '../utils/admin-labels';
import {
  socioCategoryBadge,
  socioCategoryLabel,
  socioEstadoBadge,
  socioEstadoLabel,
} from '../utils/socio-estado';
import { MemberDetailModal } from './member-detail-modal/member-detail-modal';
import {
  MemberCreateModal,
  MemberCreateSave,
} from './member-create-modal/member-create-modal';
import {
  MemberEditModal,
  MemberEditSave,
} from './member-edit-modal/member-edit-modal';

type MembersViewState = 'loading' | 'success' | 'empty' | 'error';

type StatusConfirmKind = 'deactivate' | 'reactivate' | 'baja';

interface StatusConfirmState {
  kind: StatusConfirmKind;
  member: AdminMember;
  nuevoEstado: SocioEstado;
}

const SUCCESS_CLOSE_DELAY_MS = 1500;

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

function isSocioEstado(value: string): value is SocioEstado {
  return value === 'ACTIVO' || value === 'INACTIVO' || value === 'DADO_DE_BAJA';
}

function mapSocioFieldErrors(error: ApiError): Readonly<Record<string, string>> {
  const mapped: Record<string, string> = {};
  for (const item of error.fieldErrors ?? []) {
    const field = item.field?.trim();
    const message = item.message.trim();
    if (!field || !message) {
      continue;
    }
    const key = field.includes('.') ? (field.split('.').pop() ?? field) : field;
    mapped[key] = message;
  }
  return mapped;
}

/**
 * Admin Gestión de Socios — real backend only:
 * - GET /admin/socios
 * - GET /admin/socios/{id}
 * - POST /admin/socios
 * - PATCH /admin/socios/{id}
 * - PATCH /admin/socios/{id}/estado
 */
@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppPageHeader,
    AppButton,
    AppSearch,
    AppSelect,
    AppBadge,
    AppIcon,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppConfirmDialog,
    MemberCreateModal,
    MemberDetailModal,
    MemberEditModal,
  ],
  templateUrl: './members.html',
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPage {
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly editLoading = signal(false);
  protected readonly statusBusyId = signal<string | null>(null);

  /** Always starts empty — filled only by GET /admin/socios. */
  protected readonly members = signal<AdminMember[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly filterControl = new FormControl('all', { nonNullable: true });
  protected readonly filter = signal('all');
  protected readonly categoryControl = new FormControl('all', { nonNullable: true });
  protected readonly categoryFilter = signal('all');

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly detailMember = signal<AdminMemberDetail | null>(null);
  protected readonly editOpen = signal(false);
  protected readonly editMember = signal<AdminMemberDetail | null>(null);
  protected readonly editSuccessMessage = signal('');
  protected readonly editServerErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly statusConfirm = signal<StatusConfirmState | null>(null);

  /** Backend-supported filter: `estado`. */
  protected readonly filterOptions: SelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'ACTIVO', label: 'Activos' },
    { value: 'INACTIVO', label: 'Inactivos' },
    { value: 'DADO_DE_BAJA', label: 'Dados de baja' },
  ];

  /** Backend-supported filter: `categoria`. */
  protected readonly categoryOptions: SelectOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'ADHERENTE', label: 'Adherente' },
  ];

  protected readonly filteredMembers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.members().filter((member) => {
      if (term.length === 0) {
        return true;
      }
      return (
        member.fullName.toLowerCase().includes(term) ||
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.documentNumber.toLowerCase().includes(term) ||
        member.memberCode.toLowerCase().includes(term) ||
        (member.establishmentName?.toLowerCase().includes(term) ?? false)
      );
    });
  });

  protected readonly subtitle = computed(
    () => `${this.members().length} socios registrados`,
  );

  protected readonly viewState = computed<MembersViewState>(() => {
    if (this.loading()) {
      return 'loading';
    }
    if (this.loadError()) {
      return 'error';
    }
    if (this.members().length === 0 || this.filteredMembers().length === 0) {
      return 'empty';
    }
    return 'success';
  });

  protected readonly confirmTitle = computed(() => {
    switch (this.statusConfirm()?.kind) {
      case 'deactivate':
        return 'Desactivar socio';
      case 'reactivate':
        return 'Reactivar socio';
      case 'baja':
        return 'Dar de baja al socio';
      default:
        return 'Confirmar acción';
    }
  });

  protected readonly confirmMessage = computed(() => {
    switch (this.statusConfirm()?.kind) {
      case 'deactivate':
        return '¿Querés pasar este socio a estado inactivo?';
      case 'reactivate':
        return '¿Querés volver a activar este socio?';
      case 'baja':
        return '¿Querés dar de baja este socio? Esta acción puede afectar su acceso y beneficios.';
      default:
        return '';
    }
  });

  protected readonly confirmLabel = computed(() => {
    switch (this.statusConfirm()?.kind) {
      case 'deactivate':
        return 'Desactivar';
      case 'reactivate':
        return 'Reactivar';
      case 'baja':
        return 'Dar de baja';
      default:
        return 'Confirmar';
    }
  });

  protected readonly socioCategoryBadge = socioCategoryBadge;
  protected readonly socioCategoryLabel = socioCategoryLabel;
  protected readonly socioEstadoBadge = socioEstadoBadge;
  protected readonly socioEstadoLabel = socioEstadoLabel;
  protected readonly initialsFromName = initialsFromName;

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(false);
        }),
        switchMap(() => {
          const filter = this.filter();
          const estado = isSocioEstado(filter) ? filter : undefined;
          const category = this.categoryFilter();
          const categoria =
            category === 'ACTIVO' || category === 'ADHERENTE'
              ? (category as SocioCategoria)
              : undefined;

          const params =
            estado || categoria
              ? {
                  ...(estado ? { estado } : {}),
                  ...(categoria ? { categoria } : {}),
                }
              : undefined;

          return this.memberService.getAdminSocios(params).pipe(
            catchError((error: unknown) => {
              this.loadError.set(true);
              this.loading.set(false);
              if (this.members().length === 0) {
                this.members.set([]);
              }
              this.notifications.error(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar los socios',
              );
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((members) => {
        this.members.set(members);
        this.loading.set(false);
        this.loadError.set(false);
      });

    this.filterControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filter.set(value || 'all');
        this.reload$.next();
      });

    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.categoryFilter.set(value || 'all');
        this.reload$.next();
      });
  }

  protected onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected openCreate(): void {
    this.createOpen.set(true);
  }

  protected closeCreate(options?: { force?: boolean }): void {
    if (!options?.force && this.submitting()) {
      return;
    }
    this.createOpen.set(false);
  }

  protected openEdit(member: AdminMember | AdminMemberDetail): void {
    this.editOpen.set(true);
    this.editSuccessMessage.set('');
    this.editServerErrors.set({});

    const detail = this.detailMember();
    if (detail && detail.id === member.id && !this.detailLoading()) {
      this.editMember.set(detail);
      this.editLoading.set(false);
      return;
    }

    this.editMember.set(null);
    this.editLoading.set(true);

    this.memberService
      .getAdminSocioById(member.id)
      .pipe(
        take(1),
        finalize(() => this.editLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (loaded) => {
          if (!this.editOpen()) {
            return;
          }
          this.editMember.set(loaded);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cargar el socio para editar',
          );
          this.editOpen.set(false);
        },
      });
  }

  protected closeEdit(options?: { force?: boolean }): void {
    if (!options?.force && this.submitting()) {
      return;
    }
    this.editOpen.set(false);
    this.editMember.set(null);
    this.editLoading.set(false);
    this.editSuccessMessage.set('');
    this.editServerErrors.set({});
  }

  protected openDetail(member: AdminMember): void {
    this.detailOpen.set(true);
    this.detailMember.set({ ...member, accountState: null });
    this.detailLoading.set(true);

    this.memberService
      .getAdminSocioById(member.id)
      .pipe(
        take(1),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          if (!this.detailOpen()) {
            return;
          }
          this.detailMember.set(detail);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cargar el detalle del socio',
          );
        },
      });
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detailMember.set(null);
    this.detailLoading.set(false);
  }

  protected askStatusChange(member: AdminMember, nuevoEstado: SocioEstado): void {
    if (this.statusBusyId() || member.membershipStatus === nuevoEstado) {
      return;
    }

    let kind: StatusConfirmKind;
    if (nuevoEstado === 'ACTIVO') {
      kind = 'reactivate';
    } else if (nuevoEstado === 'INACTIVO') {
      kind = 'deactivate';
    } else {
      kind = 'baja';
    }

    this.statusConfirm.set({ kind, member, nuevoEstado });
  }

  protected cancelStatusChange(): void {
    if (this.statusBusyId()) {
      return;
    }
    this.statusConfirm.set(null);
  }

  protected confirmStatusChange(): void {
    const pending = this.statusConfirm();
    if (!pending || this.statusBusyId()) {
      return;
    }

    this.statusBusyId.set(pending.member.id);
    this.memberService
      .changeAdminSocioEstado(pending.member.id, {
        nuevoEstado: pending.nuevoEstado,
      })
      .pipe(
        take(1),
        finalize(() => this.statusBusyId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.statusConfirm.set(null);
          this.notifications.success(
            response.mensaje?.trim() || 'Estado actualizado correctamente',
          );
          this.reload$.next();
          this.refreshDetailIfOpen(pending.member.id);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cambiar el estado del socio',
          );
        },
      });
  }

  protected saveCreate(event: MemberCreateSave): void {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.memberService
      .createAdminSocio(event.payload)
      .pipe(
        take(1),
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.notifications.success(
            response.mensaje || 'Socio creado correctamente',
          );
          this.closeCreate({ force: true });
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo crear el socio',
          );
        },
      });
  }

  protected saveEdit(event: MemberEditSave): void {
    if (this.submitting()) {
      return;
    }

    this.editServerErrors.set({});
    this.editSuccessMessage.set('');
    this.submitting.set(true);

    this.memberService
      .updateAdminSocio(event.id, event.payload)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const message =
            response.mensaje?.trim() || 'Socio actualizado correctamente';
          this.editSuccessMessage.set(message);
          this.notifications.success(message);

          if (response.socio) {
            const detail = mapSocioDetalleDtoToViewModel(response.socio);
            this.editMember.set(detail);
            if (this.detailOpen() && this.detailMember()?.id === event.id) {
              this.detailMember.set(detail);
            }
          }

          timer(SUCCESS_CLOSE_DELAY_MS)
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.submitting.set(false);
              this.closeEdit({ force: true });
              this.reload$.next();
              if (this.detailOpen() && this.detailMember()?.id === event.id) {
                this.refreshDetailIfOpen(event.id);
              }
            });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (isApiError(error)) {
            this.editServerErrors.set(mapSocioFieldErrors(error));
            this.notifications.error(error.message);
            return;
          }
          this.notifications.error('No se pudo actualizar el socio');
        },
      });
  }

  private refreshDetailIfOpen(id: string): void {
    if (!this.detailOpen() || this.detailMember()?.id !== id) {
      return;
    }

    this.detailLoading.set(true);
    this.memberService
      .getAdminSocioById(id)
      .pipe(
        take(1),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          if (!this.detailOpen()) {
            return;
          }
          this.detailMember.set(detail);
        },
        error: () => {
          // Keep previous detail visible; list reload still applies.
        },
      });
  }
}
