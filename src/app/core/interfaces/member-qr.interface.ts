export type MemberQrStatus = 'active' | 'expired' | 'suspended';

export interface MemberQrProfile {
  memberId: string;
  memberNumber: string;
  memberName: string;
  /** Swagger `categoria` label when present (ACTIVO/ADHERENTE). */
  categoryLabel: string;
}

export interface MemberQrSummary {
  nextDueDateLabel: string;
  lastPaymentDateLabel: string;
  renewalNote: string;
  helperText: string;
}

export interface MemberQrPayload {
  /** Exact token from backend — encoded into the visual QR. */
  qrValue: string;
  /**
   * Short manual code from Swagger `codigoQr` (XXXX-XXXX-XXXX-XXXX).
   * Never used to render the visual QR.
   */
  codigoQr: string;
  status: MemberQrStatus;
  statusLabel: string;
  statusIcon: string;
  generatedAt: string;
  /** Token expiry (`expiraEn`) as ISO date-time when present. */
  expirationDate: string;
}

export interface MemberQrResponse {
  profile: MemberQrProfile;
  /** Null when the QR must not be shown (blocked / unavailable). */
  qr: MemberQrPayload | null;
  summary: MemberQrSummary;
  /** True only when estado is ACTIVO and token is present. */
  available: boolean;
  /** Backend `mensaje` or derived fallback. */
  message: string;
  /** ISO date-time of token expiry for auto-refresh scheduling. */
  expiresAt: string | null;
  /** Short manual code at top-level for easy UI binding (same as qr.codigoQr). */
  codigoQr: string;
}

export interface RefreshMemberQrResponse {
  qr: MemberQrPayload | null;
  available: boolean;
  message: string;
  expiresAt: string | null;
  profile: MemberQrProfile;
  summary: MemberQrSummary;
}

export interface ShareQrPayload {
  title: string;
  text: string;
  url: string;
}
