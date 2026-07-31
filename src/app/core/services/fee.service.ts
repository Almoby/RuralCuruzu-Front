import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarDatosBancariosRequest,
  ActualizarReglaCuotaRequest,
  AdminCuotaDetail,
  AdminCuotaListItem,
  AdminCuotasResumenViewModel,
  AdminDatosBancariosViewModel,
  AdminFeePeriodOption,
  AdminReglaCuotaViewModel,
  AnularCuotaRequest,
  CuotaResponseDto,
  CuotaResumenResponseDto,
  DatosBancariosActualizadosResponseDto,
  DatosBancariosResponseDto,
  GeneracionCuotasResponseDto,
  ListarCuotasAdminParams,
  ReglaCuotaActualizadaResponseDto,
  ReglaCuotaResponseDto,
  RegistrarPagoCuotaRequest,
  RegistrarPagoResponseDto,
  ResumenCuotasResponseDto,
  RevisarPagoInformadoRequest,
  RevisarPagoInformadoResponseDto,
  SocioCategoriaCuota,
} from '../interfaces/admin-cuota.interface';
import {
  BankTransferDetails,
  FeePeriod,
  FeePeriodOption,
  GenerateFeesRequest,
  PaymentFilter,
  PaymentRecord,
  PaymentSummary,
  RegisterPaymentRequest,
} from '../interfaces/fee.interface';
import { PaymentMethod, PaymentStatus } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import { formatPeriodLabel } from '../../shared/utils';
import feesMock from '../../../assets/mock-data/fees.json';
import membersMock from '../../../assets/mock-data/members.json';
import bankTransferMock from '../../../assets/mock-data/bank-transfer-details.json';
import { Member } from '../interfaces/member.interface';
import { SKIP_ERROR_TOAST } from '../http/auth-http.tokens';
import {
  buildAdminPeriodOptions,
  mapCuotaDtoToViewModel,
  mapCuotaResumenDtoToViewModel,
  mapDatosBancariosDtoToViewModel,
  mapReglaCuotaDtoToViewModel,
  mapResumenCuotasDtoToViewModel,
} from '../mappers/admin-cuota.mapper';

/**
 * Fees / cuotas access.
 * - Admin Gestión de Cuotas → always real backend (`/admin/cuotas*`, reglas, datos bancarios).
 * - Portal Socio legacy → still mocks / invented `/fees*` paths when `useMocks`.
 */
@Injectable({ providedIn: 'root' })
export class FeeService {
  private readonly http = inject(HttpClient);
  private readonly adminCuotasBase = `${environment.apiBaseUrl}/admin/cuotas`;
  private readonly adminReglasBase = `${environment.apiBaseUrl}/admin/reglas-cuota`;
  private readonly adminDatosBancariosBase = `${environment.apiBaseUrl}/admin/datos-bancarios`;
  private readonly silentContext = new HttpContext().set(SKIP_ERROR_TOAST, true);

  /** Legacy in-memory store for Portal Socio mocks. */
  private payments: PaymentRecord[] = structuredClone(feesMock) as PaymentRecord[];
  private readonly bankTransferDetails: BankTransferDetails = structuredClone(
    bankTransferMock,
  ) as BankTransferDetails;

  // ---------------------------------------------------------------------------
  // Admin — backend real (ignores environment.useMocks)
  // ---------------------------------------------------------------------------

  /**
   * GET `${apiBaseUrl}/admin/cuotas`
   * Optional: estado, socioId, periodo.
   */
  getAdminCuotas(params?: ListarCuotasAdminParams): Observable<AdminCuotaListItem[]> {
    let httpParams = new HttpParams();
    if (params?.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }
    if (params?.socioId) {
      httpParams = httpParams.set('socioId', params.socioId);
    }
    if (params?.periodo) {
      httpParams = httpParams.set('periodo', params.periodo);
    }

    return this.http
      .get<CuotaResumenResponseDto[]>(this.adminCuotasBase, {
        params: httpParams,
        context: this.silentContext,
      })
      .pipe(map((items) => (items ?? []).map(mapCuotaResumenDtoToViewModel)));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/{id}`
   */
  getAdminCuotaById(id: string): Observable<AdminCuotaDetail> {
    return this.http
      .get<CuotaResponseDto>(`${this.adminCuotasBase}/${encodeURIComponent(id)}`, {
        context: this.silentContext,
      })
      .pipe(map(mapCuotaDtoToViewModel));
  }

  /**
   * GET `${apiBaseUrl}/admin/cuotas/resumen`
   */
  getAdminCuotasResumen(): Observable<AdminCuotasResumenViewModel> {
    return this.http
      .get<ResumenCuotasResponseDto>(`${this.adminCuotasBase}/resumen`, {
        context: this.silentContext,
      })
      .pipe(map(mapResumenCuotasDtoToViewModel));
  }

  /**
   * POST `${apiBaseUrl}/admin/cuotas/generar?periodo=`
   */
  generateAdminCuotas(periodo?: string): Observable<GeneracionCuotasResponseDto> {
    let httpParams = new HttpParams();
    if (periodo) {
      httpParams = httpParams.set('periodo', periodo);
    }

    return this.http.post<GeneracionCuotasResponseDto>(
      `${this.adminCuotasBase}/generar`,
      null,
      {
        params: httpParams,
        context: this.silentContext,
      },
    );
  }

  /**
   * POST `${apiBaseUrl}/admin/cuotas/pagos`
   */
  registerAdminPago(body: RegistrarPagoCuotaRequest): Observable<RegistrarPagoResponseDto> {
    return this.http.post<RegistrarPagoResponseDto>(`${this.adminCuotasBase}/pagos`, body, {
      context: this.silentContext,
    });
  }

  /**
   * PATCH `${apiBaseUrl}/admin/cuotas/{id}/revision`
   * Approve or reject an informed payment (cuota EN_REVISION).
   */
  reviseAdminPago(
    cuotaId: string,
    body: RevisarPagoInformadoRequest,
  ): Observable<RevisarPagoInformadoResponseDto> {
    return this.http.patch<RevisarPagoInformadoResponseDto>(
      `${this.adminCuotasBase}/${encodeURIComponent(cuotaId)}/revision`,
      body,
      { context: this.silentContext },
    );
  }

  /** Alias matching requested naming for approve. */
  approveAdminPago(cuotaId: string): Observable<RevisarPagoInformadoResponseDto> {
    return this.reviseAdminPago(cuotaId, { aprobar: true });
  }

  /** Alias matching requested naming for reject (motivo required by API). */
  rejectAdminPago(
    cuotaId: string,
    motivoRechazo: string,
  ): Observable<RevisarPagoInformadoResponseDto> {
    return this.reviseAdminPago(cuotaId, { aprobar: false, motivoRechazo });
  }

  /**
   * PATCH `${apiBaseUrl}/admin/cuotas/{id}/anular`
   */
  anularAdminCuota(cuotaId: string, body: AnularCuotaRequest): Observable<CuotaResponseDto> {
    return this.http.patch<CuotaResponseDto>(
      `${this.adminCuotasBase}/${encodeURIComponent(cuotaId)}/anular`,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * GET `${apiBaseUrl}/admin/reglas-cuota`
   */
  getAdminReglasCuota(): Observable<AdminReglaCuotaViewModel[]> {
    return this.http
      .get<ReglaCuotaResponseDto[]>(this.adminReglasBase, {
        context: this.silentContext,
      })
      .pipe(
        map((items) =>
          (items ?? [])
            .map(mapReglaCuotaDtoToViewModel)
            .filter((item): item is AdminReglaCuotaViewModel => item !== null),
        ),
      );
  }

  /**
   * GET `${apiBaseUrl}/admin/reglas-cuota/{categoria}`
   */
  getAdminReglaCuotaByCategoria(
    categoria: SocioCategoriaCuota,
  ): Observable<AdminReglaCuotaViewModel> {
    return this.http
      .get<ReglaCuotaResponseDto>(
        `${this.adminReglasBase}/${encodeURIComponent(categoria)}`,
        { context: this.silentContext },
      )
      .pipe(
        map((dto) => {
          const mapped = mapReglaCuotaDtoToViewModel({
            ...dto,
            categoriaAplicable: dto.categoriaAplicable ?? categoria,
          });
          if (!mapped) {
            throw new Error('La regla no tiene categoría válida');
          }
          return mapped;
        }),
      );
  }

  /**
   * PUT `${apiBaseUrl}/admin/reglas-cuota/{categoria}`
   */
  updateAdminReglaCuota(
    categoria: SocioCategoriaCuota,
    body: ActualizarReglaCuotaRequest,
  ): Observable<ReglaCuotaActualizadaResponseDto> {
    return this.http.put<ReglaCuotaActualizadaResponseDto>(
      `${this.adminReglasBase}/${encodeURIComponent(categoria)}`,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * GET `${apiBaseUrl}/admin/datos-bancarios`
   */
  getAdminDatosBancarios(): Observable<AdminDatosBancariosViewModel> {
    return this.http
      .get<DatosBancariosResponseDto>(this.adminDatosBancariosBase, {
        context: this.silentContext,
      })
      .pipe(map(mapDatosBancariosDtoToViewModel));
  }

  /**
   * PUT `${apiBaseUrl}/admin/datos-bancarios`
   */
  updateAdminDatosBancarios(
    body: ActualizarDatosBancariosRequest,
  ): Observable<DatosBancariosActualizadosResponseDto> {
    return this.http.put<DatosBancariosActualizadosResponseDto>(
      this.adminDatosBancariosBase,
      body,
      { context: this.silentContext },
    );
  }

  /**
   * Client-side period options for admin register-payment modal.
   * No Swagger endpoint for period catalog.
   */
  getAdminPeriodOptions(count = 8): AdminFeePeriodOption[] {
    return buildAdminPeriodOptions(count);
  }

  /**
   * No admin comprobante download endpoint in Swagger
   * (only `GET /socio/cuotas/pagos/{pagoId}/comprobante`).
   * Kept as documentation — do not call.
   */
  // downloadAdminComprobante — not available in Swagger for Admin.

  // ---------------------------------------------------------------------------
  // Legacy — Portal Socio / mocks (do not use from Admin Gestión de Cuotas)
  // ---------------------------------------------------------------------------

  getPayments(memberId?: string): Observable<PaymentRecord[]> {
    return this.list(memberId);
  }

  list(memberId?: string): Observable<PaymentRecord[]> {
    if (environment.useMocks) {
      const data = memberId
        ? this.payments.filter((payment) => payment.memberId === memberId)
        : [...this.payments];
      return mockResponse(data);
    }

    const url = memberId
      ? `${environment.apiBaseUrl}/fees?memberId=${memberId}`
      : `${environment.apiBaseUrl}/fees`;
    return this.http.get<PaymentRecord[]>(url);
  }

  getPaymentSummary(): Observable<PaymentSummary> {
    return this.summary();
  }

  summary(_period?: string): Observable<PaymentSummary> {
    if (environment.useMocks) {
      return mockResponse(this.buildSummary(this.payments));
    }
    return this.http.get<PaymentSummary>(`${environment.apiBaseUrl}/fees/summary`);
  }

  filterPayments(filter: PaymentFilter): Observable<PaymentRecord[]> {
    return this.getPayments().pipe(
      map((items) => items.filter((item) => this.matchesFilter(item, filter))),
    );
  }

  getMembersForPayment(): Observable<Member[]> {
    if (environment.useMocks) {
      const members = (structuredClone(membersMock) as Member[]).filter(
        (member) => member.isActive,
      );
      return mockResponse(members);
    }
    return this.http.get<Member[]>(`${environment.apiBaseUrl}/fees/members`);
  }

  getPeriodOptions(count = 8): Observable<FeePeriodOption[]> {
    if (environment.useMocks) {
      return mockResponse(this.buildPeriodOptions(count));
    }
    return this.http.get<FeePeriodOption[]>(`${environment.apiBaseUrl}/fees/periods`);
  }

  getBankTransferDetails(): Observable<BankTransferDetails> {
    if (environment.useMocks) {
      return mockResponse({ ...this.bankTransferDetails });
    }
    return this.http.get<BankTransferDetails>(`${environment.apiBaseUrl}/fees/bank-transfer`);
  }

  registerPayment(payload: RegisterPaymentRequest): Observable<PaymentRecord> {
    if (environment.useMocks) {
      return mockResponse(this.createMockPayment(payload));
    }
    return this.http.post<PaymentRecord>(`${environment.apiBaseUrl}/fees/payments`, payload);
  }

  /**
   * Socio transfer report with receipt file — FormData ready for future multipart API.
   * Mock extracts fields and reuses the same in-memory payment registration.
   */
  reportTransferPayment(formData: FormData): Observable<PaymentRecord> {
    if (environment.useMocks) {
      const memberId = String(formData.get('memberId') ?? '');
      const period = String(formData.get('period') ?? '');
      const amount = Number(formData.get('amount') ?? 0);
      const notesRaw = formData.get('notes');
      const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : undefined;
      const file = formData.get('file');
      const receiptNumber =
        file instanceof File && file.name.trim()
          ? file.name.trim()
          : `REC-${Date.now()}`;

      return mockResponse(
        this.createMockPayment({
          memberId,
          period,
          amount,
          paymentMethod: PaymentMethod.Transferencia,
          receiptNumber,
          notes,
        }),
      );
    }

    return this.http.post<PaymentRecord>(
      `${environment.apiBaseUrl}/fees/payments/transfer`,
      formData,
    );
  }

  private createMockPayment(payload: RegisterPaymentRequest): PaymentRecord {
    const members = membersMock as Member[];
    const member = members.find((item) => item.id === payload.memberId);

    /**
     * Mock decision: registered payments are marked Aprobado automatically
     * (matches Figma subtitle). Efectivo additionally skips any review UX.
     */
    const payment: PaymentRecord = {
      id: `fee-${String(this.payments.length + 1).padStart(3, '0')}`,
      memberId: payload.memberId,
      memberCode: member?.memberCode ?? 'S-0000',
      memberName: member?.fullName ?? 'Socio',
      period: payload.period,
      amount: payload.amount,
      status: PaymentStatus.Aprobado,
      dueDate: `${payload.period}-09`,
      paidAt: payload.paidAt ?? new Date().toISOString(),
      paymentMethod: payload.paymentMethod,
      receiptNumber: payload.receiptNumber ?? `REC-${Date.now()}`,
      notes: payload.notes,
    };
    this.payments = [payment, ...this.payments];
    return payment;
  }

  generateFees(periodOrRequest: string | GenerateFeesRequest): Observable<PaymentRecord[]> {
    const period =
      typeof periodOrRequest === 'string' ? periodOrRequest : periodOrRequest.period;

    if (environment.useMocks) {
      const members = membersMock as Member[];
      const existingMemberIds = new Set(
        this.payments
          .filter((payment) => payment.period === period)
          .map((payment) => payment.memberId),
      );
      const generated = members
        .filter((member) => member.isActive && !existingMemberIds.has(member.id))
        .map((member, index) => {
          const payment: PaymentRecord = {
            id: `fee-gen-${period}-${index + 1}`,
            memberId: member.id,
            memberCode: member.memberCode,
            memberName: member.fullName,
            period,
            amount: member.monthlyFee,
            status: PaymentStatus.Pendiente,
            dueDate: `${period}-09`,
          };
          return payment;
        });
      this.payments = [...generated, ...this.payments];
      return mockResponse(generated);
    }
    return this.http.post<PaymentRecord[]>(`${environment.apiBaseUrl}/fees/generate`, {
      period,
    });
  }

  private buildSummary(items: PaymentRecord[]): PaymentSummary {
    const approved = items.filter((item) => item.status === PaymentStatus.Aprobado);
    const pending = items.filter((item) => item.status === PaymentStatus.Pendiente);
    const rejected = items.filter((item) => item.status === PaymentStatus.Rechazado);

    return {
      collectedAmount: approved.reduce((acc, item) => acc + item.amount, 0),
      inReviewAmount: pending.reduce((acc, item) => acc + item.amount, 0),
      cashCollectedAmount: approved
        .filter((item) => item.paymentMethod === PaymentMethod.Efectivo)
        .reduce((acc, item) => acc + item.amount, 0),
      totalCount: items.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
    };
  }

  private matchesFilter(item: PaymentRecord, filter: PaymentFilter): boolean {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'pending') {
      return item.status === PaymentStatus.Pendiente;
    }
    if (filter === 'approved') {
      return item.status === PaymentStatus.Aprobado;
    }
    return item.status === PaymentStatus.Rechazado;
  }

  private buildPeriodOptions(count: number): FeePeriodOption[] {
    const options: FeePeriodOption[] = [];
    const now = new Date();
    for (let i = 0; i < count; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value: FeePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value, label: formatPeriodLabel(value) });
    }
    return options;
  }
}
