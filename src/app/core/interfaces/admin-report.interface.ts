/**
 * Admin Reports contracts based on Swagger endpoints that feed the Figma screen:
 * - GET /api/admin/dashboard (primary KPIs, debt, benefits, collections series)
 * - GET /api/admin/dashboard/exportar
 * - GET /api/admin/cuotas (only for “Cuotas cobradas por mes” PAGADA rows)
 *
 * There is no `/api/admin/reportes` controller in swagger-SRCC.json.
 */

import { CuotaResumenResponseDto } from './admin-cuota.interface';
import { AdminDashboardDto } from './admin-dashboard.interface';
import { ReportsDashboardResponse } from './report.interface';

/** Same optional filters as GET /admin/dashboard (service-ready; no UI filters yet). */
export interface AdminReportQueryParams {
  año?: number;
  categoria?: 'ACTIVO' | 'ADHERENTE';
  tipoPersona?: 'FISICA' | 'JURIDICA';
}

export interface AdminReportExportFile {
  blob: Blob;
  fileName: string;
}

/** Raw payloads combined for the Reports page. */
export interface AdminReportRawBundle {
  dashboard: AdminDashboardDto | null;
  cuotas: CuotaResumenResponseDto[];
  /** True when the dashboard request failed. */
  dashboardFailed: boolean;
  /** True when the cuotas request failed. */
  cuotasFailed: boolean;
}

/** View-model + raw payloads for client-side chart filters. */
export interface AdminReportsLoadResult {
  report: ReportsDashboardResponse;
  cuotas: CuotaResumenResponseDto[];
  dashboard: AdminDashboardDto | null;
}
