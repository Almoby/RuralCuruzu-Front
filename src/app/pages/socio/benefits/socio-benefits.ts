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
  debounceTime,
  distinctUntilChanged,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { BenefitService } from '../../../core/services/benefit.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  BenefitCategoryFilter,
  BenefitsCatalogView,
  SocioBenefitsCatalogResponse,
} from '../../../core/interfaces/benefit.interface';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppSearch,
} from '../../../shared/components';
import { resolveBenefitRubroIcon } from '../../../shared/utils';

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

@Component({
  selector: 'app-socio-benefits',
  standalone: true,
  imports: [
    AppSearch,
    AppLoading,
    AppEmptyState,
    AppAlert,
    AppButton,
    AppIcon,
  ],
  templateUrl: './socio-benefits.html',
  styleUrl: './socio-benefits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioBenefits {
  private readonly benefitService = inject(BenefitService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  readonly viewState = signal<ViewState>('loading');
  readonly catalog = signal<SocioBenefitsCatalogResponse | null>(null);
  readonly searchTerm = signal('');
  readonly categoryFilter = signal('all');
  readonly viewMode = signal<BenefitsCatalogView>('promotions');
  readonly errorMessage = signal('No pudimos cargar los beneficios. Reintentá en unos segundos.');
  /** Rubro chips from the last unfiltered (by rubro) response. */
  private readonly rubroCategories = signal<BenefitCategoryFilter[]>([]);

  readonly title = computed(() => this.catalog()?.title ?? 'Beneficios y Comercios');
  readonly searchPlaceholder = computed(
    () => this.catalog()?.searchPlaceholder ?? 'Buscar beneficios o comercios...',
  );
  readonly categories = computed(() => {
    const fromCatalog = this.catalog()?.categories ?? [];
    const stored = this.rubroCategories();
    return stored.length > 0 ? stored : fromCatalog;
  });
  readonly viewModes = computed(() => this.catalog()?.viewModes ?? []);
  readonly promotions = computed(() => this.catalog()?.promotions ?? []);
  readonly merchants = computed(() => this.catalog()?.merchants ?? []);

  readonly availableCountLabel = computed(() => {
    if (this.viewMode() === 'merchants') {
      const merchants = this.merchants().length;
      return merchants === 1
        ? '1 comercio disponible'
        : `${merchants} comercios disponibles`;
    }

    const count = this.promotions().length;
    return `${count} beneficio${count === 1 ? '' : 's'} disponibles para vos`;
  });

  /** True when the user typed a search or selected a rubro other than “Todos”. */
  readonly hasActiveSearchOrFilters = computed(
    () => this.searchTerm().trim().length > 0 || this.categoryFilter() !== 'all',
  );

  readonly emptyState = computed(() => {
    const filtered = this.hasActiveSearchOrFilters();
    if (this.viewMode() === 'merchants') {
      return filtered
        ? {
            title: 'Sin resultados',
            description: 'No encontramos comercios con esa búsqueda.',
          }
        : {
            title: 'Sin comercios',
            description: 'No hay comercios con beneficios disponibles en este momento.',
          };
    }

    return filtered
      ? {
          title: 'Sin resultados',
          description: 'No encontramos beneficios con esa búsqueda.',
        }
      : {
          title: 'Sin beneficios',
          description: 'No hay beneficios disponibles en este momento.',
        };
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          if (!this.catalog()) {
            this.viewState.set('loading');
          }
        }),
        switchMap(() => {
          const category = this.categoryFilter();
          const busqueda = this.searchTerm().trim();
          const rubro = category !== 'all' ? category : undefined;
          const preserveCategories = category !== 'all' ? this.rubroCategories() : undefined;

          return this.benefitService
            .getSocioBenefitsCatalog(
              {
                rubro,
                busqueda: busqueda || undefined,
              },
              { categories: preserveCategories },
            )
            .pipe(
              catchError((error: unknown) => {
                this.viewState.set('error');
                this.errorMessage.set(
                  isApiError(error)
                    ? error.message
                    : 'No pudimos cargar los beneficios. Reintentá en unos segundos.',
                );
                this.notifications.error(this.errorMessage());
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.catalog.set(payload);
        if (this.categoryFilter() === 'all') {
          this.rubroCategories.set(payload.categories);
        }
        this.viewState.set('success');
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected onSearch(term: string): void {
    this.searchInput$.next(term);
  }

  protected setCategory(value: string): void {
    if (this.categoryFilter() === value) {
      return;
    }
    this.categoryFilter.set(value);
    this.reload$.next();
  }

  protected setViewMode(mode: BenefitsCatalogView): void {
    this.viewMode.set(mode);
  }

  protected rubroTone(categoryName: string): string {
    return resolveBenefitRubroIcon(categoryName).tone;
  }

  protected rubroIcon(categoryName: string): string {
    return resolveBenefitRubroIcon(categoryName).icon;
  }
}
