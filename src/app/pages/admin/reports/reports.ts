import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, startWith, switchMap, take, tap } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, TooltipItem } from 'chart.js';
import {
  AppAlert,
  AppEmptyState,
  AppIcon,
  AppLoading,
  AppPageHeader,
} from '../../../shared/components';
import { ReportService } from '../../../core/services/report.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  CobranzaMensualDto,
  UsoBeneficioPorComercioDto,
} from '../../../core/interfaces/admin-dashboard.interface';
import { CuotaResumenResponseDto } from '../../../core/interfaces/admin-cuota.interface';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  MemberDebtItem,
  ReportsDashboardResponse,
} from '../../../core/interfaces/report.interface';
import {
  buildBenefitsByCommerceChartTitle,
  buildBenefitsByCommerceForPeriod,
  buildCollectionsVsPending,
  currentCalendarBenefitPeriod,
  extractYearsFromCobranza,
  extractYearsFromUsoPorPeriodo,
  filterCobranzaByYear,
  formatBenefitPeriodLabel,
} from '../../../core/mappers/admin-report.mapper';
import { initialsFromName } from '../utils/admin-labels';
import {
  CHART_COLORS,
  chartGridStyle,
  chartLegendBottomLabels,
  chartTickStyle,
  currencyTooltipLabel,
  formatChartCurrency,
  formatChartCurrencyShort,
} from '../utils/chart-theme';

type ReportsViewState = 'loading' | 'success' | 'empty' | 'error';
type ChartMenu =
  | 'collectionYear'
  | 'collectedMonth'
  | 'debtTop'
  | 'overduePageSize'
  | 'collectedPageSize'
  | null;

const DEBT_TOP_OPTIONS = [10, 20, 50] as const;
const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

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

function currentCalendarYear(): number {
  return new Date().getFullYear();
}

function clampPage(page: number, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.min(page, totalPages);
}

function pageRangeLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) {
    return 'Mostrando 0–0 de 0';
  }
  const safePage = clampPage(page, total, pageSize);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  return `Mostrando ${start}–${end} de ${total}`;
}

function truncateChartLabel(value: string, max = 14): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

function sortOverdueMembers(items: MemberDebtItem[]): MemberDebtItem[] {
  return [...items].sort(
    (a, b) =>
      b.amount - a.amount ||
      (b.overdueCount ?? 0) - (a.overdueCount ?? 0) ||
      a.memberName.localeCompare(b.memberName, 'es'),
  );
}

function sortDebtByMember(items: MemberDebtItem[]): MemberDebtItem[] {
  return [...items].sort(
    (a, b) =>
      b.amount - a.amount ||
      (b.overdueCount ?? 0) - (a.overdueCount ?? 0) ||
      a.memberName.localeCompare(b.memberName, 'es'),
  );
}

function sortCollectedFees(items: MemberDebtItem[]): MemberDebtItem[] {
  return [...items].sort((a, b) => {
    const paidA = a.paidAt?.trim() ?? '';
    const paidB = b.paidAt?.trim() ?? '';
    if (paidA !== paidB) {
      return paidB.localeCompare(paidA);
    }
    const periodA = a.period?.trim() ?? '';
    const periodB = b.period?.trim() ?? '';
    if (periodA !== periodB) {
      return periodB.localeCompare(periodA);
    }
    return a.memberName.localeCompare(b.memberName, 'es');
  });
}

function niceAxisMax(maxValue: number, fallback: number): number {
  if (maxValue <= 0) {
    return fallback;
  }
  const magnitude = 10 ** Math.max(0, String(Math.floor(maxValue)).length - 2);
  return Math.ceil(maxValue / magnitude) * magnitude;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    AppPageHeader,
    AppIcon,
    AppLoading,
    AppAlert,
    AppEmptyState,
    BaseChartDirective,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly reportService = inject(ReportService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly exporting = signal(false);
  protected readonly data = signal<ReportsDashboardResponse | null>(null);
  protected readonly rawCuotas = signal<CuotaResumenResponseDto[]>([]);
  protected readonly selectedPeriod = signal('');
  protected readonly openMenu = signal<ChartMenu>(null);
  protected readonly errorMessage = signal('No se pudieron cargar los reportes.');

  /** Accumulated cobranza by year (Swagger returns one year per request). */
  private readonly cobranzaByYear = signal<ReadonlyMap<number, CobranzaMensualDto[]>>(
    new Map(),
  );
  protected readonly usoBeneficiosPorComercio = signal<UsoBeneficioPorComercioDto[]>([]);
  protected readonly selectedCollectionYear = signal(currentCalendarYear());
  protected readonly collectionYearLoading = signal(false);

  protected readonly debtTopLimit = signal<(typeof DEBT_TOP_OPTIONS)[number]>(10);
  protected readonly overdueMembersPage = signal(1);
  protected readonly overdueMembersPageSize = signal<(typeof LIST_PAGE_SIZE_OPTIONS)[number]>(
    10,
  );
  protected readonly collectedFeesPage = signal(1);
  protected readonly collectedFeesPageSize = signal<(typeof LIST_PAGE_SIZE_OPTIONS)[number]>(
    10,
  );

  protected readonly debtTopOptions = DEBT_TOP_OPTIONS;
  protected readonly listPageSizeOptions = LIST_PAGE_SIZE_OPTIONS;

  protected readonly viewState = computed<ReportsViewState>(() => {
    if (this.loading() && !this.data()) {
      return 'loading';
    }
    if (this.loadError() && !this.data()) {
      return 'error';
    }
    if (!this.data()) {
      return 'empty';
    }
    return 'success';
  });

  protected readonly title = computed(() => this.data()?.title ?? 'Reportes');
  protected readonly subtitle = computed(
    () => this.data()?.subtitle ?? 'Análisis y estadísticas de la cooperativa',
  );

  protected readonly metrics = computed(() => this.data()?.metrics ?? []);

  protected readonly sortedDebtByMember = computed(() =>
    sortDebtByMember(this.data()?.debtByMember.items ?? []),
  );

  protected readonly visibleDebtByMember = computed(() =>
    this.sortedDebtByMember().slice(0, this.debtTopLimit()),
  );

  protected readonly sortedOverdueMembers = computed(() =>
    sortOverdueMembers(this.data()?.overdueMembers.items ?? []),
  );

  protected readonly overdueMembersTotal = computed(
    () => this.sortedOverdueMembers().length,
  );

  protected readonly overdueMembersSafePage = computed(() =>
    clampPage(
      this.overdueMembersPage(),
      this.overdueMembersTotal(),
      this.overdueMembersPageSize(),
    ),
  );

  protected readonly paginatedOverdueMembers = computed(() => {
    const size = this.overdueMembersPageSize();
    const page = this.overdueMembersSafePage();
    const start = (page - 1) * size;
    return this.sortedOverdueMembers().slice(start, start + size);
  });

  protected readonly overdueCanGoPrev = computed(
    () => this.overdueMembersSafePage() > 1,
  );

  protected readonly overdueCanGoNext = computed(() => {
    const total = this.overdueMembersTotal();
    const size = this.overdueMembersPageSize();
    return this.overdueMembersSafePage() * size < total;
  });

  protected readonly sortedCollectedFees = computed(() =>
    sortCollectedFees(this.data()?.monthlyCollectedFees.items ?? []),
  );

  protected readonly collectedFeesTotal = computed(
    () => this.sortedCollectedFees().length,
  );

  protected readonly collectedFeesSafePage = computed(() =>
    clampPage(
      this.collectedFeesPage(),
      this.collectedFeesTotal(),
      this.collectedFeesPageSize(),
    ),
  );

  protected readonly paginatedCollectedFees = computed(() => {
    const size = this.collectedFeesPageSize();
    const page = this.collectedFeesSafePage();
    const start = (page - 1) * size;
    return this.sortedCollectedFees().slice(start, start + size);
  });

  protected readonly collectedRangeLabel = computed(() => {
    const total = this.collectedFeesTotal();
    const base = pageRangeLabel(
      this.collectedFeesSafePage(),
      this.collectedFeesPageSize(),
      total,
    );
    return `${base} ${total === 1 ? 'pago' : 'pagos'}`;
  });

  protected readonly collectedCanGoPrev = computed(
    () => this.collectedFeesSafePage() > 1,
  );

  protected readonly collectedCanGoNext = computed(() => {
    const total = this.collectedFeesTotal();
    const size = this.collectedFeesPageSize();
    return this.collectedFeesSafePage() * size < total;
  });

  protected readonly overdueRangeText = computed(() => {
    const total = this.overdueMembersTotal();
    const base = pageRangeLabel(
      this.overdueMembersSafePage(),
      this.overdueMembersPageSize(),
      total,
    );
    return `${base} ${total === 1 ? 'socio' : 'socios'}`;
  });

  protected readonly topBenefits = computed(() => this.data()?.topBenefits.items ?? []);
  protected readonly monthOptions = computed(
    () => this.data()?.monthlyCollectedFees.monthOptions ?? [],
  );
  protected readonly selectedMonthLabel = computed(() => {
    const period = this.selectedPeriod();
    const option = this.monthOptions().find((item) => item.value === period);
    return option?.label ?? this.data()?.monthlyCollectedFees.monthLabel ?? 'Mes';
  });
  protected readonly collectedTitle = computed(
    () => this.data()?.monthlyCollectedFees.title ?? '',
  );
  protected readonly overdueTitle = computed(
    () => this.data()?.overdueMembers.title ?? '',
  );
  protected readonly benefitsTitle = computed(
    () => this.data()?.topBenefits.title ?? '',
  );
  protected readonly currentBenefitPeriod = computed(() => currentCalendarBenefitPeriod());

  protected readonly currentBenefitPeriodLabel = computed(() => {
    const period = this.currentBenefitPeriod();
    return formatBenefitPeriodLabel(period.year, period.month);
  });

  protected readonly commerceTitle = computed(() => {
    const period = this.currentBenefitPeriod();
    return buildBenefitsByCommerceChartTitle(period.year, period.month);
  });

  protected readonly commerceEmptyMessage = computed(
    () => `No hay usos de beneficios en ${this.currentBenefitPeriodLabel()}.`,
  );

  protected readonly collectionsTitle = computed(() => 'Cobrados vs pendientes');
  protected readonly debtTitle = computed(
    () => this.data()?.debtByMember.title ?? '',
  );

  protected readonly collectionYearOptions = computed(() => {
    const years = new Set<number>();
    for (const year of this.cobranzaByYear().keys()) {
      years.add(year);
    }
    for (const year of extractYearsFromUsoPorPeriodo(this.usoBeneficiosPorComercio())) {
      years.add(year);
    }
    years.add(currentCalendarYear());
    return Array.from(years).sort((a, b) => b - a);
  });

  protected readonly filteredCollectionSeries = computed(() => {
    const year = this.selectedCollectionYear();
    const cached = this.cobranzaByYear().get(year);
    if (!cached) {
      return buildCollectionsVsPending([], year);
    }
    return buildCollectionsVsPending(cached, year);
  });

  protected readonly filteredBenefitUsageByCommerce = computed(() => {
    const period = this.currentBenefitPeriod();
    return buildBenefitsByCommerceForPeriod(
      this.usoBeneficiosPorComercio(),
      period.year,
      period.month,
      { titleWithPeriod: true },
    );
  });

  protected readonly collectionsChartData = computed((): ChartData<'line'> | null => {
    const chart = this.filteredCollectionSeries();
    if (chart.labels.length === 0) {
      return null;
    }

    return {
      labels: chart.labels,
      datasets: chart.series.map((series) => ({
        label: series.name,
        data: series.values,
        borderColor: series.color,
        backgroundColor: series.color,
        pointBackgroundColor: series.color,
        pointBorderColor: CHART_COLORS.white,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        tension: 0.25,
        fill: false,
      })),
    };
  });

  protected readonly collectionsChartOptions = computed(
    (): ChartConfiguration<'line'>['options'] => {
      const chart = this.filteredCollectionSeries();
      const max = chart.yAxisMax || 600000;

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: chartLegendBottomLabels,
          },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'line'>) =>
                currencyTooltipLabel(item.raw, item.dataset.label ?? item.label ?? ''),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: chartTickStyle,
            border: { display: false },
          },
          y: {
            min: 0,
            max,
            ticks: {
              ...chartTickStyle,
              stepSize: max / 6,
              callback: (value) => formatChartCurrencyShort(Number(value)),
            },
            grid: chartGridStyle,
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly debtChartData = computed((): ChartData<'bar'> | null => {
    const items = this.visibleDebtByMember();
    if (items.length === 0) {
      return null;
    }

    return {
      labels: items.map((item) => truncateChartLabel(item.shortName)),
      datasets: [
        {
          label: 'Deuda',
          data: items.map((item) => item.amount),
          backgroundColor: CHART_COLORS.brown,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 42,
          categoryPercentage: 0.55,
          barPercentage: 0.8,
        },
      ],
    };
  });

  protected readonly debtChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const items = this.visibleDebtByMember();
      const maxValue = Math.max(0, ...items.map((item) => item.amount));
      const max = niceAxisMax(maxValue, 10000);

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                const index = tooltipItems[0]?.dataIndex ?? 0;
                return items[index]?.memberName ?? '';
              },
              label: (item: TooltipItem<'bar'>) => {
                const member = items[item.dataIndex];
                if (!member) {
                  return currencyTooltipLabel(item.raw, 'Deuda');
                }
                const lines = [
                  `N° socio: ${member.memberCode}`,
                  `Deuda total: ${formatChartCurrency(member.amount)}`,
                ];
                if (typeof member.overdueCount === 'number') {
                  lines.push(`Cuotas vencidas: ${member.overdueCount}`);
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: chartTickStyle.font.family },
              color: CHART_COLORS.text,
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
            },
            border: { display: false },
          },
          y: {
            min: 0,
            max,
            ticks: {
              ...chartTickStyle,
              stepSize: Math.max(max / 5, 1),
              callback: (value) => formatChartCurrencyShort(Number(value)),
            },
            grid: chartGridStyle,
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly commerceChartData = computed((): ChartData<'bar'> | null => {
    const chart = this.filteredBenefitUsageByCommerce();
    if (chart.items.length === 0) {
      return null;
    }

    return {
      labels: chart.items.map((item) => item.name),
      datasets: [
        {
          label: chart.title,
          data: chart.items.map((item) => item.value),
          backgroundColor: CHART_COLORS.primary,
          borderWidth: 0,
          borderRadius: 3,
          maxBarThickness: 14,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
        },
      ],
    };
  });

  protected readonly commerceChartOptions = computed(
    (): ChartConfiguration<'bar'>['options'] => {
      const chart = this.filteredBenefitUsageByCommerce();
      const scale = chart.scale.length > 0 ? chart.scale : [0, 60, 120, 180, 240];
      const max = Math.max(...scale, 0);

      return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'bar'>) => {
                const value = typeof item.raw === 'number' ? item.raw : Number(item.raw);
                return `${item.label}: ${value}`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max,
            ticks: {
              stepSize: scale.length > 1 ? scale[1] - scale[0] : 60,
              ...chartTickStyle,
            },
            grid: chartGridStyle,
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: chartTickStyle.font.family },
              color: CHART_COLORS.text,
            },
            border: { display: false },
          },
        },
      };
    },
  );

  protected readonly initialsFromName = initialsFromName;
  protected readonly formatCurrency = formatChartCurrency;

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(false);
        }),
        switchMap(() =>
          this.reportService.getAdminReports(undefined, this.selectedPeriod() || undefined).pipe(
            catchError((error: unknown) => {
              this.loadError.set(true);
              this.loading.set(false);
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No se pudieron cargar los reportes.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.data.set(result.report);
        this.rawCuotas.set(result.cuotas);
        this.selectedPeriod.set(result.report.monthlyCollectedFees.selectedPeriod);
        this.overdueMembersPage.set(1);
        this.collectedFeesPage.set(1);

        const cobranza = result.dashboard?.cobranzaMensual ?? [];
        const comercios = result.dashboard?.usoBeneficiosPorComercio ?? [];
        this.usoBeneficiosPorComercio.set(comercios);

        const yearsFromCobranza = extractYearsFromCobranza(cobranza);
        const currentYear = currentCalendarYear();
        const defaultCollectionYear = yearsFromCobranza.includes(currentYear)
          ? currentYear
          : (yearsFromCobranza[0] ?? currentYear);

        const nextCobranza = new Map<number, CobranzaMensualDto[]>();
        if (yearsFromCobranza.length === 0) {
          nextCobranza.set(defaultCollectionYear, cobranza);
        } else if (yearsFromCobranza.length === 1) {
          // Swagger: typically one year per response — keep the full series under that year.
          nextCobranza.set(yearsFromCobranza[0], cobranza);
        } else {
          for (const year of yearsFromCobranza) {
            nextCobranza.set(year, filterCobranzaByYear(cobranza, year));
          }
        }
        this.cobranzaByYear.set(nextCobranza);
        this.selectedCollectionYear.set(defaultCollectionYear);

        this.loading.set(false);
        this.loadError.set(false);
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected toggleMenu(menu: ChartMenu): void {
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected selectCollectionYear(year: number): void {
    this.openMenu.set(null);
    if (year === this.selectedCollectionYear() && this.cobranzaByYear().has(year)) {
      return;
    }

    this.selectedCollectionYear.set(year);
    if (this.cobranzaByYear().has(year)) {
      return;
    }

    // Swagger: one year per response → fetch that year.
    this.collectionYearLoading.set(true);
    this.reportService
      .getCobranzaMensualForYear(year)
      .pipe(
        take(1),
        finalize(() => this.collectionYearLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ cobranzaMensual }) => {
          const next = new Map(this.cobranzaByYear());
          next.set(year, cobranzaMensual);
          this.cobranzaByYear.set(next);
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error)
              ? error.message
              : 'No se pudo cargar la cobranza del año seleccionado',
          );
        },
      });
  }

  protected selectMonth(period: string): void {
    this.selectedPeriod.set(period);
    this.openMenu.set(null);
    this.collectedFeesPage.set(1);

    const current = this.data();
    if (!current) {
      return;
    }

    this.data.set(
      this.reportService.withCollectedPeriod(current, this.rawCuotas(), period),
    );
  }

  protected selectDebtTop(limit: (typeof DEBT_TOP_OPTIONS)[number]): void {
    this.openMenu.set(null);
    this.debtTopLimit.set(limit);
  }

  protected setOverduePageSize(size: (typeof LIST_PAGE_SIZE_OPTIONS)[number]): void {
    this.openMenu.set(null);
    this.overdueMembersPageSize.set(size);
    this.overdueMembersPage.set(1);
  }

  protected setCollectedPageSize(size: (typeof LIST_PAGE_SIZE_OPTIONS)[number]): void {
    this.openMenu.set(null);
    this.collectedFeesPageSize.set(size);
    this.collectedFeesPage.set(1);
  }

  protected goOverduePrev(): void {
    if (!this.overdueCanGoPrev()) {
      return;
    }
    this.overdueMembersPage.set(this.overdueMembersSafePage() - 1);
  }

  protected goOverdueNext(): void {
    if (!this.overdueCanGoNext()) {
      return;
    }
    this.overdueMembersPage.set(this.overdueMembersSafePage() + 1);
  }

  protected goCollectedPrev(): void {
    if (!this.collectedCanGoPrev()) {
      return;
    }
    this.collectedFeesPage.set(this.collectedFeesSafePage() - 1);
  }

  protected goCollectedNext(): void {
    if (!this.collectedCanGoNext()) {
      return;
    }
    this.collectedFeesPage.set(this.collectedFeesSafePage() + 1);
  }

  protected exportData(): void {
    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.reportService
      .exportAdminReport()
      .pipe(
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file.blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = file.fileName;
          anchor.click();
          URL.revokeObjectURL(url);
          this.notifications.success('Reporte exportado');
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo exportar el reporte',
          );
        },
      });
  }
}
