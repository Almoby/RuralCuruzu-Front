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
  benefitsByCommerce: DashboardBenefitsByCommerce;

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

export interface SocioDashboardStats {
  memberCode: string;
  fullName: string;
  feeStatusLabel: string;
  nextDueDate?: string;
  pendingAmount: number;
  availableBenefits: number;
  redemptionsThisMonth: number;
  recentBenefits: NamedValue[];
  savingsEstimate: number;
  usageTrend: ChartPoint[];
}

export interface ComercioDashboardStats {
  merchantId: string;
  merchantName: string;
  activePromotions: number;
  validationsToday: number;
  validationsMonth: number;
  uniqueMembersMonth: number;
  validationsTrend: ChartPoint[];
  topPromotions: NamedValue[];
}
