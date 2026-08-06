import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { AdminDeletedMerchantViewModel } from '../../../../core/interfaces/admin-comercio.interface';
import { MerchantService } from '../../../../core/services/merchant.service';
import {
  AppAlert,
  AppBadge,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppInput,
  AppLoading,
  AppModal,
} from '../../../../shared/components';

type ListState = 'loading' | 'success' | 'empty' | 'error' | 'no-results';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function clampPage(page: number, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.min(page, totalPages);
}

function pageRangeLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) {
    return 'Mostrando 0–0 de 0 comercios';
  }
  const safePage = clampPage(page, total, pageSize);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const noun = total === 1 ? 'comercio' : 'comercios';
  return `Mostrando ${start}–${end} de ${total} ${noun}`;
}

function matchesSearch(item: AdminDeletedMerchantViewModel, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [item.tradeName, item.legalName, item.cuit, item.category]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

@Component({
  selector: 'app-deleted-merchants-modal',
  standalone: true,
  imports: [
    FormsModule,
    AppModal,
    AppButton,
    AppInput,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppBadge,
    AppIcon,
  ],
  templateUrl: './deleted-merchants-modal.html',
  styleUrl: './deleted-merchants-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletedMerchantsModal {
  private readonly merchantService = inject(MerchantService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<void>();

  readonly open = input(false);
  /** Increment while open to refetch after a new physical delete. */
  readonly refreshToken = input(0);
  readonly close = output<void>();

  protected readonly listState = signal<ListState>('loading');
  protected readonly items = signal<AdminDeletedMerchantViewModel[]>([]);
  protected readonly listError = signal('No pudimos cargar los comercios eliminados.');
  protected readonly searchQuery = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  protected readonly pageSizeMenuOpen = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly filteredItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.items().filter((item) => matchesSearch(item, query));
  });

  protected readonly total = computed(() => this.filteredItems().length);

  protected readonly safePage = computed(() =>
    clampPage(this.page(), this.total(), this.pageSize()),
  );

  protected readonly paginatedItems = computed(() => {
    const size = this.pageSize();
    const start = (this.safePage() - 1) * size;
    return this.filteredItems().slice(start, start + size);
  });

  protected readonly rangeLabel = computed(() =>
    pageRangeLabel(this.safePage(), this.pageSize(), this.total()),
  );

  protected readonly canGoPrev = computed(() => this.safePage() > 1);

  protected readonly canGoNext = computed(() => {
    const total = this.total();
    const size = this.pageSize();
    return this.safePage() * size < total;
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return null;
    }
    return this.items().find((item) => item.id === id) ?? null;
  });

  protected readonly viewState = computed<ListState>(() => {
    const state = this.listState();
    if (state === 'loading' || state === 'error') {
      return state;
    }
    if (this.items().length === 0) {
      return 'empty';
    }
    if (this.filteredItems().length === 0) {
      return 'no-results';
    }
    return 'success';
  });

  constructor() {
    this.load$
      .pipe(
        tap(() => {
          this.listState.set('loading');
          this.listError.set('No pudimos cargar los comercios eliminados.');
          this.pageSizeMenuOpen.set(false);
          this.selectedId.set(null);
        }),
        switchMap(() =>
          this.merchantService.getAdminDeletedMerchants().pipe(
            catchError(() => {
              this.items.set([]);
              this.listState.set('error');
              this.listError.set('No pudimos cargar los comercios eliminados.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        if (items === null) {
          return;
        }
        this.items.set(items);
        this.page.set(clampPage(this.page(), items.length, this.pageSize()));
        this.listState.set(items.length === 0 ? 'empty' : 'success');
      });

    effect(() => {
      const isOpen = this.open();
      const token = this.refreshToken();
      if (!isOpen) {
        this.resetLocalState();
        return;
      }
      void token;
      this.load$.next();
    });
  }

  protected onClose(): void {
    if (this.listState() === 'loading') {
      return;
    }
    this.close.emit();
  }

  protected retry(): void {
    this.load$.next();
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.page.set(1);
    this.selectedId.set(null);
  }

  protected setPageSize(size: (typeof PAGE_SIZE_OPTIONS)[number]): void {
    this.pageSizeMenuOpen.set(false);
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected togglePageSizeMenu(): void {
    this.pageSizeMenuOpen.update((open) => !open);
  }

  protected goPrev(): void {
    if (!this.canGoPrev()) {
      return;
    }
    this.page.set(this.safePage() - 1);
  }

  protected goNext(): void {
    if (!this.canGoNext()) {
      return;
    }
    this.page.set(this.safePage() + 1);
  }

  protected selectItem(item: AdminDeletedMerchantViewModel): void {
    this.selectedId.update((current) => (current === item.id ? null : item.id));
  }

  private resetLocalState(): void {
    this.listState.set('loading');
    this.items.set([]);
    this.listError.set('No pudimos cargar los comercios eliminados.');
    this.searchQuery.set('');
    this.page.set(1);
    this.pageSize.set(10);
    this.pageSizeMenuOpen.set(false);
    this.selectedId.set(null);
  }
}
