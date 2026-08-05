import {
  CuotaEstado,
  CuotaResumenResponseDto,
  DatosBancariosResponseDto,
  MedioPagoCuota,
  PagoEstado,
  PagoResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  SocioPaymentsBankDetails,
  SocioPaymentsCuotaItem,
  SocioPaymentsRawBundle,
  SocioPaymentsReceiptItem,
  SocioPaymentsViewModel,
} from '../interfaces/socio-payments.interface';
import { medioPagoLabel } from './admin-cuota.mapper';
import { formatFeePeriodTitle, formatPeriodLabel } from '../../shared/utils';
import { BankDetailRow } from '../interfaces/fee.interface';

/**
 * Swagger (informar-pago / link-de-pago):
 * "Aplica a cuotas propias en estado PENDIENTE, VENCIDA o RECHAZADA"
 * (RN-17: un intento previo rechazado no impide otro).
 *
 * Generating a Mercado Pago preference is NOT payment confirmation.
 * Frontend must never invent PAGADA / EN_REVISION from opening the URL.
 */
const REPORTABLE_STATES: ReadonlySet<CuotaEstado> = new Set([
  'PENDIENTE',
  'VENCIDA',
  'RECHAZADA',
]);

const PENDING_ONLINE_CUOTA_STATES: ReadonlySet<CuotaEstado> = new Set([
  'INFORMADA',
  'EN_REVISION',
]);

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Formats LocalDate `YYYY-MM-DD` as `d/m/yyyy` without UTC shift. */
function formatLocalDateLabel(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function parsePeriodSortKey(period: string | null | undefined): number {
  if (!period?.trim()) {
    return Number.NEGATIVE_INFINITY;
  }
  const match = /^(\d{4})-(\d{2})/.exec(period.trim());
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(match[1]) * 100 + Number(match[2]);
}

function parseSortTime(value: string | null | undefined): number {
  if (!value?.trim()) {
    return Number.NEGATIVE_INFINITY;
  }
  const trimmed = value.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
    trimmed,
  );
  if (local) {
    const ms = new Date(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4] ?? '0'),
      Number(local[5] ?? '0'),
      Number(local[6] ?? '0'),
    ).getTime();
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

export function canReportPayment(estado: CuotaEstado | null | undefined): boolean {
  return estado != null && REPORTABLE_STATES.has(estado);
}

export function canPayWithLink(estado: CuotaEstado | null | undefined): boolean {
  return canReportPayment(estado);
}

/**
 * Online link attempt in flight: cuota blocked (INFORMADA/EN_REVISION) with
 * pago vigente LINK_DE_PAGO that is not APROBADO yet.
 * Never treats link generation alone as confirmation.
 */
export function hasPendingOnlinePayment(
  estado: CuotaEstado | null | undefined,
  pagoVigente: PagoResponseDto | null | undefined,
): boolean {
  if (estado == null || !PENDING_ONLINE_CUOTA_STATES.has(estado)) {
    return false;
  }
  if (pagoVigente?.medioPago !== 'LINK_DE_PAGO') {
    return false;
  }
  return pagoVigente.estado !== 'APROBADO';
}

export function canDownloadSocioReceipt(pago: {
  estado?: PagoEstado | null;
  comprobanteRuta?: string | null;
}): boolean {
  if (pago.estado === 'APROBADO') {
    return true;
  }
  return !!pago.comprobanteRuta?.trim();
}

function cuotaEstadoLabel(estado: CuotaEstado | null): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'Pendiente';
    case 'INFORMADA':
      return 'Informada';
    case 'EN_REVISION':
      return 'En revisión';
    case 'PAGADA':
      return 'Pagada';
    case 'VENCIDA':
      return 'Vencida';
    case 'RECHAZADA':
      return 'Rechazada';
    case 'ANULADA':
      return 'Anulada';
    default:
      return 'Sin estado';
  }
}

function pagoEstadoLabel(estado: PagoEstado | null): string {
  switch (estado) {
    case 'APROBADO':
      return 'Aprobado';
    case 'EN_REVISION':
      return 'En revisión';
    case 'RECHAZADO':
      return 'Rechazado';
    default:
      return 'Sin estado';
  }
}

/** Today's calendar date as `YYYY-MM-DD` (InformarPagoCuotaRequest.fecha). */
export function todayLocalDateIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mapSocioCuotaDtoToViewModel(
  dto: CuotaResumenResponseDto,
  index = 0,
): SocioPaymentsCuotaItem {
  const estado = dto.estado ?? null;
  const period = text(dto.periodo);
  const pagoVigente = dto.pagoVigente ?? null;
  const pagoVigenteEstado = pagoVigente?.estado ?? null;
  const pagoVigenteMedio: MedioPagoCuota | null = pagoVigente?.medioPago ?? null;

  return {
    id: text(dto.id, `cuota-${index}`),
    period,
    periodTitle: period ? formatFeePeriodTitle(period) : 'Cuota',
    receiptTitle: period ? `Cuota ${formatPeriodLabel(period)}` : 'Cuota',
    amount: num(dto.importe),
    dueDate: text(dto.fechaVencimiento),
    dueDateLabel: formatLocalDateLabel(dto.fechaVencimiento) || 'Sin vencimiento',
    estado,
    estadoLabel: cuotaEstadoLabel(estado),
    memberCode: text(dto.socioNumeroSocio),
    memberName: text(dto.socioNombre, 'Socio'),
    canReportPayment: canReportPayment(estado),
    canPayWithLink: canPayWithLink(estado),
    pagoVigenteId: pagoVigente?.id?.trim() || null,
    pagoVigenteEstado,
    pagoVigenteMedio,
    hasPendingOnlinePayment: hasPendingOnlinePayment(estado, pagoVigente),
  };
}

export function mapSocioPaymentDtoToReceiptItem(
  dto: PagoResponseDto,
  index = 0,
): SocioPaymentsReceiptItem {
  const period = text(dto.periodo);
  const dateSource = dto.fechaPago ?? dto.fechaCreacion;
  const medio = medioPagoLabel(dto.medioPago);
  const estado = dto.estado ?? null;
  return {
    id: text(dto.id, `pago-${index}`),
    period,
    receiptTitle: period ? `Cuota ${formatPeriodLabel(period)}` : 'Comprobante',
    amount: num(dto.importe),
    paymentMethodLabel: medio === '—' ? null : medio,
    dateLabel: formatLocalDateLabel(dateSource) || 'Sin fecha',
    estado,
    estadoLabel: pagoEstadoLabel(estado),
    canDownload: canDownloadSocioReceipt(dto),
  };
}

export function mapSocioBankDetailsDtoToViewModel(
  dto: DatosBancariosResponseDto | null,
): SocioPaymentsBankDetails | null {
  if (!dto) {
    return null;
  }
  return {
    banco: text(dto.banco, '—'),
    cbu: text(dto.cbu, '—'),
    alias: text(dto.alias, '—'),
    titular: text(dto.titular, '—'),
    cuit: text(dto.cuit, '—'),
  };
}

export function buildSocioBankDetailRows(
  bank: SocioPaymentsBankDetails | null,
  amountLabel: string,
  memberCode: string,
): BankDetailRow[] {
  if (!bank) {
    return [];
  }

  return [
    { key: 'bank', label: 'Banco', value: bank.banco, copyable: false },
    { key: 'cbu', label: 'CBU', value: bank.cbu, copyable: true },
    { key: 'alias', label: 'Alias', value: bank.alias, copyable: true },
    { key: 'holder', label: 'Titular', value: bank.titular, copyable: false },
    { key: 'cuit', label: 'CUIT', value: bank.cuit, copyable: false },
    { key: 'amount', label: 'Monto', value: amountLabel, copyable: false },
    {
      key: 'concept',
      label: 'Concepto / Referencia',
      value: memberCode || '—',
      copyable: !!memberCode,
    },
  ];
}

/**
 * Metrics / lists derived from full Socio responses:
 * - currentCuota: highest `periodo` (YYYY-MM)
 * - previousCuotas: remaining cuotas
 * - receipts: all payment attempts (GET /pagos), newest first — powers Comprobantes + download
 */
export function mapSocioPaymentsBundleToViewModel(
  bundle: SocioPaymentsRawBundle,
  session?: { memberCode?: string; displayName?: string },
): SocioPaymentsViewModel {
  const cuotas = (bundle.cuotas ?? [])
    .map((item, index) => mapSocioCuotaDtoToViewModel(item, index))
    .sort((a, b) => parsePeriodSortKey(b.period) - parsePeriodSortKey(a.period));

  const currentCuota = cuotas[0] ?? null;
  const previousCuotas = cuotas.slice(1);

  const receipts = (bundle.pagos ?? [])
    .slice()
    .sort(
      (a, b) =>
        parseSortTime(b.fechaPago ?? b.fechaCreacion) -
        parseSortTime(a.fechaPago ?? a.fechaCreacion),
    )
    .map((item, index) => mapSocioPaymentDtoToReceiptItem(item, index));

  const bank = mapSocioBankDetailsDtoToViewModel(bundle.bank);
  const memberCode =
    currentCuota?.memberCode ||
    text(session?.memberCode) ||
    text(bundle.pagos?.[0]?.socioNumeroSocio);
  const memberName =
    currentCuota?.memberName ||
    text(session?.displayName, 'Socio') ||
    text(bundle.pagos?.[0]?.socioNombre, 'Socio');

  return {
    currentCuota,
    previousCuotas,
    receipts,
    bank,
    memberCode,
    memberName,
  };
}
