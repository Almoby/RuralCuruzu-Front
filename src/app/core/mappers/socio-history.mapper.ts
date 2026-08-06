import {
  MedioPagoCuota,
  PagoEstado,
  PagoResponseDto,
} from '../interfaces/admin-cuota.interface';
import {
  SocioHistoryBenefitItem,
  SocioHistoryPaymentItem,
  SocioHistoryRawBundle,
  SocioHistoryViewModel,
} from '../interfaces/socio-history.interface';
import { SocioHistorialBeneficioDto } from '../interfaces/socio-panel.interface';
import { medioPagoLabel } from './admin-cuota.mapper';
import { formatFeePeriodTitle } from '../../shared/utils';

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Parses LocalDateTime / Instant-like strings without relying on Date.toString().
 * Returns epoch ms for sorting, or null when unparseable.
 */
function parseSortTime(value: string | null | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const trimmed = value.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
    trimmed,
  );
  if (local) {
    const year = Number(local[1]);
    const month = Number(local[2]) - 1;
    const day = Number(local[3]);
    const hour = Number(local[4] ?? '0');
    const minute = Number(local[5] ?? '0');
    const second = Number(local[6] ?? '0');
    const ms = new Date(year, month, day, hour, minute, second).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/** Formats date-time as `d/m/yyyy a las HH:mm` without UTC day shift for LocalDateTime. */
function formatHistoryDateTime(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '';
  }
  const trimmed = value.trim();
  const withTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(trimmed);
  if (withTime) {
    return `${Number(withTime[3])}/${Number(withTime[2])}/${withTime[1]} a las ${withTime[4]}:${withTime[5]}`;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (dateOnly) {
    return `${Number(dateOnly[3])}/${Number(dateOnly[2])}/${dateOnly[1]}`;
  }
  return trimmed;
}

/** Formats date as `d/m/yyyy` for payment rows. */
function formatHistoryDate(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '';
  }
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
  }
  return trimmed;
}

function paymentStatusLabel(estado: PagoEstado | null | undefined): string {
  switch (estado) {
    case 'APROBADO':
      return 'Aprobado';
    case 'EN_REVISION':
      return 'Pendiente';
    case 'RECHAZADO':
      return 'Rechazado';
    default:
      return 'Sin estado';
  }
}

function paymentMethodLabelOrNull(medio: MedioPagoCuota | undefined): string | null {
  if (medio == null) {
    return null;
  }
  const label = medioPagoLabel(medio);
  return label === '—' ? null : label;
}

export function mapSocioBenefitHistoryDtoToViewModel(
  items: SocioHistorialBeneficioDto[],
): SocioHistoryBenefitItem[] {
  return (items ?? [])
    .map((item, index) => {
      const sort = parseSortTime(item.fechaUso);
      return {
        id: item.id?.trim() || `uso-${index}`,
        benefitTitle: item.beneficioTitulo?.trim() || 'Beneficio',
        merchantName: item.comercioNombre?.trim() || 'Comercio',
        typeName: item.tipoBeneficioNombre?.trim() || '',
        usedAtLabel: formatHistoryDateTime(item.fechaUso) || 'Sin fecha',
        savingsAmount: num(item.montoAhorro),
        estado: item.estado ?? null,
        sortTime: sort ?? Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

export function mapSocioPaymentHistoryDtoToViewModel(
  items: PagoResponseDto[],
): SocioHistoryPaymentItem[] {
  return (items ?? [])
    .map((item, index) => {
      const dateSource = item.fechaPago ?? item.fechaCreacion;
      const sort = parseSortTime(dateSource);
      const estado = item.estado ?? null;
      const period = item.periodo?.trim() || '';
      return {
        id: item.id?.trim() || `pago-${index}`,
        periodTitle: period ? formatFeePeriodTitle(period) : 'Cuota',
        amount: num(item.importe),
        paymentMethodLabel: paymentMethodLabelOrNull(item.medioPago),
        dateLabel: formatHistoryDate(dateSource) || 'Sin fecha',
        estado,
        statusLabel: paymentStatusLabel(estado),
        isApproved: estado === 'APROBADO',
        sortTime: sort ?? Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

/**
 * Metrics:
 * - savingsTotal / usedBenefitsCount → from USADO historial rows (`montoAhorro` sum / count).
 * - approvedPaymentsCount → pagos with estado APROBADO.
 * Lists include all returned rows (incl. ANULADO / EN_REVISION / RECHAZADO), newest first.
 */
export function mapSocioHistoryBundleToViewModel(
  bundle: SocioHistoryRawBundle,
): SocioHistoryViewModel {
  const benefits = mapSocioBenefitHistoryDtoToViewModel(bundle.historial);
  const payments = mapSocioPaymentHistoryDtoToViewModel(bundle.pagos);
  const used = (bundle.historial ?? []).filter((item) => item.estado === 'USADO');

  return {
    savingsTotal: used.reduce((total, item) => total + num(item.montoAhorro), 0),
    usedBenefitsCount: used.length,
    approvedPaymentsCount: (bundle.pagos ?? []).filter((item) => item.estado === 'APROBADO')
      .length,
    benefits,
    payments,
  };
}
