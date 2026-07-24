import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BenefitUsageRanking,
  CommerceBenefitUsageReport,
  ExportReportRow,
  MemberDebtReport,
  MonthlyCollectedFeesReport,
  MonthlyPaymentsReport,
  OverdueMemberReport,
  ReportMetric,
  ReportsDashboardResponse,
} from '../interfaces/report.interface';
import { mockResponse } from '../utils/mock.util';
import reportsMock from '../../../assets/mock-data/reports-dashboard.json';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly store: ReportsDashboardResponse = structuredClone(
    reportsMock,
  ) as ReportsDashboardResponse;

  getReports(): Observable<ReportsDashboardResponse> {
    if (environment.useMocks) {
      return mockResponse(structuredClone(this.store));
    }
    return this.http.get<ReportsDashboardResponse>(`${environment.apiBaseUrl}/reports`);
  }

  /** @deprecated Prefer getReports() */
  getReportSummary(_periodLabel?: string): Observable<ReportsDashboardResponse> {
    return this.getReports();
  }

  getMetrics(): Observable<ReportMetric[]> {
    return this.getReports().pipe(map((data) => data.metrics));
  }

  getCollectionsVsPending(): Observable<MonthlyPaymentsReport> {
    return this.getReports().pipe(map((data) => data.collectionsVsPending));
  }

  getDebtByMember(): Observable<MemberDebtReport> {
    return this.getReports().pipe(map((data) => data.debtByMember));
  }

  getOverdueMembers(): Observable<OverdueMemberReport> {
    return this.getReports().pipe(map((data) => data.overdueMembers));
  }

  getMonthlyCollectedFees(): Observable<MonthlyCollectedFeesReport> {
    return this.getReports().pipe(map((data) => data.monthlyCollectedFees));
  }

  getTopBenefits(): Observable<BenefitUsageRanking> {
    return this.getReports().pipe(map((data) => data.topBenefits));
  }

  getBenefitsByCommerce(): Observable<CommerceBenefitUsageReport> {
    return this.getReports().pipe(map((data) => data.benefitsByCommerce));
  }

  exportReports(): Observable<Blob> {
    if (environment.useMocks) {
      const rows = this.buildExportRows(this.store);
      const csv = this.toCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      return mockResponse(blob);
    }
    return this.http.get(`${environment.apiBaseUrl}/reports/export`, {
      responseType: 'blob',
    });
  }

  private buildExportRows(data: ReportsDashboardResponse): ExportReportRow[] {
    const rows: ExportReportRow[] = [];

    data.metrics.forEach((metric) => {
      rows.push({
        section: 'Métricas',
        label: metric.label,
        value: String(metric.value),
      });
    });

    data.collectionsVsPending.labels.forEach((label, index) => {
      data.collectionsVsPending.series.forEach((series) => {
        rows.push({
          section: data.collectionsVsPending.title,
          label: `${label} — ${series.name}`,
          value: String(series.values[index] ?? 0),
        });
      });
    });

    data.debtByMember.items.forEach((item) => {
      rows.push({
        section: data.debtByMember.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.overdueMembers.items.forEach((item) => {
      rows.push({
        section: data.overdueMembers.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.monthlyCollectedFees.items.forEach((item) => {
      rows.push({
        section: data.monthlyCollectedFees.title,
        label: `${item.memberName} (${item.memberCode})`,
        value: String(item.amount),
      });
    });

    data.topBenefits.items.forEach((item) => {
      rows.push({
        section: data.topBenefits.title,
        label: `${item.rank}. ${item.title} — ${item.merchantName}`,
        value: String(item.usesPerMonth),
      });
    });

    data.benefitsByCommerce.items.forEach((item) => {
      rows.push({
        section: data.benefitsByCommerce.title,
        label: item.name,
        value: String(item.value),
      });
    });

    return rows;
  }

  private toCsv(rows: ExportReportRow[]): string {
    const header = 'Sección,Etiqueta,Valor';
    const body = rows
      .map((row) =>
        [row.section, row.label, row.value]
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    return `${header}\n${body}\n`;
  }
}
