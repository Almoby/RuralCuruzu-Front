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
import { Benefit } from '../../../core/interfaces/benefit.interface';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppLoading,
  AppModal,
  AppPageHeader,
  AppSearch,
} from '../../../shared/components';
import { DateEsPipe } from '../../../shared/pipes';

type BenefitFilter = 'all' | 'promo' | 'discount';

@Component({
  selector: 'app-socio-benefits',
  standalone: true,
  imports: [
    AppPageHeader,
    AppSearch,
    AppCard,
    AppBadge,
    AppButton,
    AppModal,
    AppLoading,
    AppEmptyState,
    DateEsPipe,
  ],
  templateUrl: './socio-benefits.html',
  styleUrl: './socio-benefits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioBenefits {
  private readonly benefitService = inject(BenefitService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly searchTerm = signal('');
  readonly filter = signal<BenefitFilter>('all');
  readonly benefits = signal<Benefit[]>([]);
  readonly selected = signal<Benefit | null>(null);
  readonly detailOpen = signal(false);

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.filter();

    return this.benefits().filter((benefit) => {
      const matchesTerm =
        !term ||
        benefit.title.toLowerCase().includes(term) ||
        benefit.merchantName.toLowerCase().includes(term) ||
        benefit.categoryName.toLowerCase().includes(term) ||
        benefit.description.toLowerCase().includes(term);

      const isPromo = benefit.discountLabel.toLowerCase().includes('x');
      const matchesFilter =
        filter === 'all' ||
        (filter === 'promo' && isPromo) ||
        (filter === 'discount' && !isPromo);

      return matchesTerm && matchesFilter;
    });
  });

  readonly availableCount = computed(() => this.filtered().length);

  constructor() {
    this.benefitService
      .listForSocio(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (benefits) => {
          this.benefits.set(benefits);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  setFilter(filter: BenefitFilter): void {
    this.filter.set(filter);
  }

  openDetail(benefit: Benefit): void {
    this.selected.set(benefit);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }
}
