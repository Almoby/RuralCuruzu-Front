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
} from 'rxjs';
import {
  AppAlert,
  AppBadge,
  AppButton,
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
  SocioEstado,
} from '../../../core/interfaces/admin-socio.interface';
import { formatMemberDate, initialsFromName } from '../utils/admin-labels';
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

type MembersViewState = 'loading' | 'success' | 'empty' | 'error';

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

/**
 * Admin Gestión de Socios — consumes ONLY:
 * - getAdminSocios() → GET /admin/socios
 * - getAdminSocioById() → GET /admin/socios/{id}
 * - createAdminSocio() → POST /admin/socios
 *
 * Never calls legacy getMembers() / list() (those stay mocked for Cuotas/Portal Socio).
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
    MemberCreateModal,
    MemberDetailModal,
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

  /** Always starts empty — filled only by GET /admin/socios. */
  protected readonly members = signal<AdminMember[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly filterControl = new FormControl('all', { nonNullable: true });
  protected readonly filter = signal('all');

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly detailMember = signal<AdminMemberDetail | null>(null);

  /** Backend-supported filter only: `estado`. */
  protected readonly filterOptions: SelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'ACTIVO', label: 'Activos' },
    { value: 'INACTIVO', label: 'Inactivos' },
    { value: 'DADO_DE_BAJA', label: 'Dados de baja' },
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

  protected readonly socioCategoryBadge = socioCategoryBadge;
  protected readonly socioCategoryLabel = socioCategoryLabel;
  protected readonly socioEstadoBadge = socioEstadoBadge;
  protected readonly socioEstadoLabel = socioEstadoLabel;
  protected readonly formatMemberDate = formatMemberDate;
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

          return this.memberService.getAdminSocios(estado ? { estado } : undefined).pipe(
            catchError((error: unknown) => {
              this.loadError.set(true);
              this.loading.set(false);
              // Keep previous members only if we already had real data; otherwise stay empty.
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

  protected closeCreate(): void {
    this.createOpen.set(false);
  }

  protected openEdit(): void {
    this.notifications.error(
      'La edición de socios no está disponible en el backend actual.',
    );
  }

  protected openDetail(member: AdminMember): void {
    this.detailOpen.set(true);
    // Show basic row data while the real detail loads.
    this.detailMember.set({ ...member });
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

  protected askDeactivate(): void {
    this.notifications.error(
      'La baja/desactivación de socios no está disponible en el backend actual.',
    );
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
          this.closeCreate();
          this.notifications.success(
            response.mensaje || 'Socio creado correctamente',
          );
          this.reload$.next();
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo crear el socio',
          );
        },
      });
  }
}
