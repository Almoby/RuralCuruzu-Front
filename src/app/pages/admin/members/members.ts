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
import { Member, MemberDetail } from '../../../core/interfaces/member.interface';
import { FeeStatus, MemberPlan } from '../../../shared/enums';
import {
  feeStatusBadge,
  feeStatusLabel,
  formatMemberDate,
  formatMemberFee,
  initialsFromName,
  memberPlanBadge,
} from '../utils/admin-labels';
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
    MemberEditModal,
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

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly members = signal<Member[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly filterControl = new FormControl('all', { nonNullable: true });
  protected readonly filter = signal('all');

  protected readonly createOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly editingMember = signal<Member | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detailMember = signal<MemberDetail | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly memberToDeactivate = signal<Member | null>(null);

  protected readonly filterOptions: SelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: `plan:${MemberPlan.Oro}`, label: 'Categoría: Oro' },
    { value: `plan:${MemberPlan.Plata}`, label: 'Categoría: Plata' },
    { value: `plan:${MemberPlan.Premium}`, label: 'Categoría: Premium' },
    { value: `fee:${FeeStatus.AlDia}`, label: 'Cuota al día' },
    { value: `fee:${FeeStatus.Pendiente}`, label: 'Cuota pendiente' },
    { value: `fee:${FeeStatus.Vencida}`, label: 'Cuota vencida' },
    { value: 'status:active', label: 'Socios activos' },
    { value: 'status:inactive', label: 'Socios inactivos' },
  ];

  protected readonly filteredMembers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.filter();
    return this.members().filter((member) => {
      const matchesTerm =
        term.length === 0 ||
        member.fullName.toLowerCase().includes(term) ||
        member.firstName.toLowerCase().includes(term) ||
        member.lastName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.documentNumber.toLowerCase().includes(term) ||
        member.memberCode.toLowerCase().includes(term) ||
        (member.establishmentName?.toLowerCase().includes(term) ?? false);

      if (!matchesTerm) {
        return false;
      }

      if (filter === 'all') {
        return true;
      }
      if (filter.startsWith('plan:')) {
        return member.category === filter.slice(5);
      }
      if (filter.startsWith('fee:')) {
        return member.feeStatus === filter.slice(4);
      }
      if (filter === 'status:active') {
        return member.isActive;
      }
      if (filter === 'status:inactive') {
        return !member.isActive;
      }
      return true;
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

  protected readonly memberPlanBadge = memberPlanBadge;
  protected readonly feeStatusBadge = feeStatusBadge;
  protected readonly feeStatusLabel = feeStatusLabel;
  protected readonly formatMemberFee = formatMemberFee;
  protected readonly formatMemberDate = formatMemberDate;
  protected readonly initialsFromName = initialsFromName;

  constructor() {
    this.load();

    this.filterControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.filter.set(value || 'all'));
  }

  protected onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected retry(): void {
    this.load();
  }

  protected openCreate(): void {
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.createOpen.set(false);
  }

  protected openEdit(member: Member): void {
    this.editingMember.set(member);
    this.editOpen.set(true);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
    this.editingMember.set(null);
  }

  protected openDetail(member: Member): void {
    this.detailOpen.set(true);
    this.detailMember.set(null);
    this.detailLoading.set(true);

    this.memberService
      .getMemberById(member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detailMember.set(detail);
          this.detailLoading.set(false);
        },
        error: () => {
          this.detailLoading.set(false);
          this.detailOpen.set(false);
          this.notifications.error('No se pudo cargar el detalle del socio');
        },
      });
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detailMember.set(null);
  }

  protected askDeactivate(member: Member): void {
    this.memberToDeactivate.set(member);
    this.confirmOpen.set(true);
  }

  protected cancelDeactivate(): void {
    this.confirmOpen.set(false);
    this.memberToDeactivate.set(null);
  }

  protected confirmDeactivate(): void {
    const member = this.memberToDeactivate();
    if (!member) {
      return;
    }

    this.submitting.set(true);
    this.memberService
      .deactivateMember(member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.confirmOpen.set(false);
          this.memberToDeactivate.set(null);
          this.notifications.success('Socio desactivado');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo desactivar el socio');
        },
      });
  }

  protected saveCreate(event: MemberCreateSave): void {
    this.submitting.set(true);
    this.memberService
      .createMember(event.payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeCreate();
          this.notifications.success('Socio creado');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo crear el socio');
        },
      });
  }

  protected saveEdit(event: MemberEditSave): void {
    this.submitting.set(true);
    this.memberService
      .updateMember(event.id, event.payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeEdit();
          this.notifications.success('Socio actualizado');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('No se pudo actualizar el socio');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.memberService
      .getMembers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
          this.notifications.error('No se pudieron cargar los socios');
        },
      });
  }
}
