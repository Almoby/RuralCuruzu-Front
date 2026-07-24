import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './app-pagination.html',
  styleUrl: './app-pagination.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPagination {
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly total = input(0);

  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() => {
    const size = this.pageSize();
    if (size <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.total() / size));
  });

  protected readonly from = computed(() => {
    if (this.total() === 0) {
      return 0;
    }
    return (this.page() - 1) * this.pageSize() + 1;
  });

  protected readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  protected readonly canGoPrev = computed(() => this.page() > 1);
  protected readonly canGoNext = computed(() => this.page() < this.totalPages());

  protected goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }
    this.pageChange.emit(page);
  }

  protected prev(): void {
    this.goTo(this.page() - 1);
  }

  protected next(): void {
    this.goTo(this.page() + 1);
  }
}
