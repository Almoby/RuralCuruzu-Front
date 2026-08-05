/**
 * Admin Reports contracts based on Swagger endpoints that feed the Figma screen:
 * - GET /api/admin/dashboard
 * - GET /api/admin/dashboard/exportar
 * - GET /api/admin/cuotas
 * - GET /api/admin/socios
 *
 * There is no `/api/admin/reportes` controller in swagger-SRCC.json.
 */

import { CuotaResumenResponseDto } from './admin-cuota.interface';
import { AdminDashboardDto } from './admin-dashboard.interface';
import { ReportsDashboardResponse } from './report.interface';

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
  sociosActivosCount: number | null;
  /** True when the dashboard request failed. */
  dashboardFailed: boolean;
  /** True when the cuotas request failed. */
  cuotasFailed: boolean;
}

/** View-model + raw cuotas (for client-side month filter). */
export interface AdminReportsLoadResult {
  report: ReportsDashboardResponse;
  cuotas: CuotaResumenResponseDto[];
}
