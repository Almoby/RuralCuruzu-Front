export interface ReportMetric {
  id: string;
  label: string;
  value: number;
  icon: string;
  tone: 'primary' | 'warning' | 'info' | 'success';
}

export interface ReportChartSeries {
  name: string;
  color: string;
  values: number[];
}

export interface MonthlyPaymentsReport {
  title: string;
  year: number;
  labels: string[];
  series: ReportChartSeries[];
  yAxisMax: number;
}

export interface MemberDebtItem {
  memberId: string;
  memberName: string;
  shortName: string;
  memberCode: string;
  amount: number;
  /** From `sociosConDeuda.cantidadCuotasVencidas` when available. */
  overdueCount?: number;
  /** Payment date (`yyyy-MM-dd`) for collected-fee rows when available. */
  paidAt?: string;
  /** Fee period (`yyyy-MM`) for collected-fee rows. */
  period?: string;
  /** From CuotaResumenResponse.categoria for collected-fee rows. */
  categoria?: 'ACTIVO' | 'ADHERENTE' | null;
}

export interface MemberDebtReport {
  title: string;
  items: MemberDebtItem[];
  yAxisMax: number;
}

export interface OverdueMemberReport {
  title: string;
  items: MemberDebtItem[];
}

export interface ReportMonthOption {
  value: string;
  label: string;
}

export interface MonthlyCollectedFeesReport {
  title: string;
  monthLabel: string;
  /** Available `yyyy-MM` periods with display labels. */
  monthOptions: ReportMonthOption[];
  /** Currently selected period (`yyyy-MM`). */
  selectedPeriod: string;
  items: MemberDebtItem[];
}

export interface BenefitUsageRankingItem {
  rank: number;
  title: string;
  merchantName: string;
  usesPerMonth: number;
  tone: 'gold' | 'silver' | 'bronze' | 'neutral';
}

export interface BenefitUsageRanking {
  title: string;
  items: BenefitUsageRankingItem[];
}

export interface CommerceBenefitUsageItem {
  name: string;
  value: number;
}

export interface CommerceBenefitUsageReport {
  title: string;
  items: CommerceBenefitUsageItem[];
  scale: number[];
}

export interface ReportsDashboardResponse {
  title: string;
  subtitle: string;
  metrics: ReportMetric[];
  collectionsVsPending: MonthlyPaymentsReport;
  debtByMember: MemberDebtReport;
  overdueMembers: OverdueMemberReport;
  monthlyCollectedFees: MonthlyCollectedFeesReport;
  topBenefits: BenefitUsageRanking;
  benefitsByCommerce: CommerceBenefitUsageReport;
}
