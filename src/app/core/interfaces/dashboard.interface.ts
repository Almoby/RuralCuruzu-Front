import { UsoBeneficioPorComercioDto } from './admin-dashboard.interface';

export type TrendDirection = 'increase' | 'decrease' | 'neutral';

export type DashboardValueFormat = 'integer' | 'currency' | 'compact';

export type DashboardIconTone = 'primary' | 'success' | 'warning' | 'violet' | 'danger';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface NamedValue {
  name: string;
  value: number;
  color?: string;
}

export interface DashboardMetricCard {
  id: string;
  title: string;
  value: number;
  valueFormat: DashboardValueFormat;
  description: string;
  icon: string;
  tone: DashboardIconTone;
  trendDirection: TrendDirection;
  trendText: string;
  showTrendIcon: boolean;
}

export interface DashboardChartSeries {
  id: string;
  name: string;
  color: string;
  values: number[];
}

export interface DashboardMonthlyCollections {
  title: string;
  labels: string[];
  yAxisLabels: string[];
  yAxisMax: number;
  series: DashboardChartSeries[];
  legend: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}

export interface DashboardMemberStatusSegment {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface DashboardMemberStatus {
  title: string;
  segments: DashboardMemberStatusSegment[];
}

export interface DashboardCommerceUsageItem {
  id: string;
  name: string;
  value: number;
}

export interface DashboardBenefitsByCommerce {
  title: string;
  scale: number[];
  items: DashboardCommerceUsageItem[];
}

/** Aliases aligned with chart domain naming (API-ready). */
export type MonthlyCollectionChart = DashboardMonthlyCollections;
export type MemberStatusChart = DashboardMemberStatus;
export type CommerceBenefitsChart = DashboardBenefitsByCommerce;

/** Full admin dashboard payload — ready to swap mocks for HttpClient/Swagger. */
export interface AdminDashboardStats {
  title: string;
  subtitle: string;
  summaryCards: DashboardMetricCard[];
  financialCards: DashboardMetricCard[];
  monthlyCollections: DashboardMonthlyCollections;
  memberStatus: DashboardMemberStatus;
  /** Raw Swagger series used by the filtered “Uso de beneficios por comercio” chart. */
  usoBeneficiosPorComercio: UsoBeneficioPorComercioDto[];
  benefitsByCommerce: DashboardBenefitsByCommerce;

  /**
   * Ranking de beneficios más usados (Swagger `beneficiosMasUtilizados`).
   * Present in the API but not rendered by the current Admin Dashboard layout.
   */
  topBenefits?: NamedValue[];

  /**
   * Mapped from API for contract completeness / Reportes reuse.
   * No dedicated Admin Dashboard chart in the current layout.
   */
  cobranzaMensualPorCategoria: Array<{
    periodo: string;
    mesLabel: string;
    cobradoActivo: number;
    cobradoAdherente: number;
  }>;

  /**
   * Mapped from API (`sociosConDeuda`). Used by Reportes; not a Dashboard block.
   */
  sociosConDeuda: Array<{
    socioId: string;
    numeroSocio: string;
    nombre: string;
    montoAdeudado: number;
    cantidadCuotasVencidas: number;
  }>;

  /** Extra indicators typed from Swagger (no extra cards in current layout). */
  sociosActivos: number;
  sociosNuevosEsteAnio: number;
  sociosConCuotaPendiente: number;
  beneficiosUtilizadosHistoricoTotal: number;

  /** Legacy fields kept for other admin screens until they migrate. */
  totalMembers: number;
  activeMembers: number;
  pendingRequests: number;
  activeMerchants: number;
  feesCollectedMonth: number;
  feesPendingMonth: number;
  redemptionsMonth: number;
  membersByCategory: NamedValue[];
  feesTrend: ChartPoint[];
  redemptionsTrend: ChartPoint[];
  topMerchants: NamedValue[];
}

/** Fee banner visual states for Mi Panel (backend-ready). */
export type MembershipFeeStatus = 'current' | 'pending' | 'overdue';

export interface MemberProfileSummary {
  memberCode: string;
  fullName: string;
  firstName: string;
  planLabel: string;
}

export interface MembershipStatusBanner {
  status: MembershipFeeStatus;
  title: string;
  message: string;
  icon: string;
}

export interface QuickAccessItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export interface MemberFinancialSummary {
  monthlyFee: number;
  monthlyFeeHint: string;
  savingsTotal: number;
  benefitsUsedCount: number;
  benefitsUsedHint: string;
  lastPaymentAmount: number;
  lastPaymentHint: string;
}

export interface AvailableBenefitPreview {
  id: string;
  title: string;
  merchantName: string;
  categoryName: string;
  discountBadge: string;
}

export interface UsedBenefitPreview {
  id: string;
  title: string;
  merchantName: string;
  dateLabel: string;
  savingsAmount: number;
}

/** Full socio Mi Panel payload — ready to swap mocks for HttpClient/Swagger. */
export interface MemberDashboardResponse {
  profile: MemberProfileSummary;
  membershipStatus: MembershipStatusBanner;
  quickAccess: QuickAccessItem[];
  financial: MemberFinancialSummary;
  availableBenefits: AvailableBenefitPreview[];
  recentUsage: UsedBenefitPreview[];

  /** Legacy fields kept for Historial and other socio screens. */
  memberCode: string;
  fullName: string;
  feeStatusLabel: string;
  nextDueDate?: string;
  pendingAmount: number;
  availableBenefitsCount: number;
  redemptionsThisMonth: number;
  recentBenefits: NamedValue[];
  savingsEstimate: number;
  usageTrend: ChartPoint[];
}

