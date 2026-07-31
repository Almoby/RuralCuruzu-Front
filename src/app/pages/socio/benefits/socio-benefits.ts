import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BenefitService } from '../../../core/services/benefit.service';
import {
  Benefit,
  BenefitMerchantCard,
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
  private readonly destroyRef = inject(DestroyRef);

  readonly viewState = signal<ViewState>('loading');
  readonly catalog = signal<SocioBenefitsCatalogResponse | null>(null);
  readonly searchTerm = signal('');
  readonly categoryFilter = signal('all');
  readonly viewMode = signal<BenefitsCatalogView>('promotions');

  readonly title = computed(() => this.catalog()?.title ?? 'Beneficios y Comercios');
  readonly subtitle = computed(() => this.catalog()?.subtitle ?? '');
  readonly searchPlaceholder = computed(
    () => this.catalog()?.searchPlaceholder ?? 'Buscar beneficios o comercios...',
  );
  readonly categories = computed(() => this.catalog()?.categories ?? []);
  readonly viewModes = computed(() => this.catalog()?.viewModes ?? []);

  readonly filteredPromotions = computed(() => {
    const items = this.catalog()?.promotions ?? [];
    return items.filter((benefit) => this.matchesBenefit(benefit));
  });

  readonly filteredMerchants = computed(() => {
    const items = this.catalog()?.merchants ?? [];
    return items.filter((merchant) => this.matchesMerchant(merchant));
  });

  readonly availableCountLabel = computed(() => {
    if (this.viewMode() === 'merchants') {
      const merchants = this.filteredMerchants().length;
      return merchants === 1
        ? '1 comercio disponible'
        : `${merchants} comercios disponibles`;
    }

    const count = this.filteredPromotions().length;
    return `${count} beneficio${count === 1 ? '' : 's'} disponibles para vos`;
  });

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected setCategory(value: string): void {
    this.categoryFilter.set(value);
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

  private matchesBenefit(benefit: Benefit): boolean {
    if (!benefit.isActive) {
      return false;
    }

    const category = this.categoryFilter();
    const matchesCategory = category === 'all' || benefit.categoryName === category;
    if (!matchesCategory) {
      return false;
    }

    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return true;
    }

    return (
      benefit.title.toLowerCase().includes(term) ||
      benefit.merchantName.toLowerCase().includes(term) ||
      benefit.categoryName.toLowerCase().includes(term) ||
      benefit.description.toLowerCase().includes(term)
    );
  }

  private matchesMerchant(merchant: BenefitMerchantCard): boolean {
    const category = this.categoryFilter();
    const matchesCategory = category === 'all' || merchant.categoryName === category;
    if (!matchesCategory) {
      return false;
    }

    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return true;
    }

    return (
      merchant.name.toLowerCase().includes(term) ||
      merchant.categoryName.toLowerCase().includes(term) ||
      merchant.address.toLowerCase().includes(term) ||
      merchant.phone.toLowerCase().includes(term)
    );
  }

  private load(): void {
    this.viewState.set('loading');
    this.benefitService
      .getCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.catalog.set(payload);
          this.viewState.set('success');
        },
        error: () => {
          this.catalog.set(null);
          this.viewState.set('error');
        },
      });
  }
}
