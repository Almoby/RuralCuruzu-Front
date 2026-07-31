export type MemberQrStatus = 'active' | 'expired' | 'suspended';

export interface MemberQrProfile {
  memberId: string;
  memberNumber: string;
  memberName: string;
}

export interface MemberQrSummary {
  nextDueDateLabel: string;
  lastPaymentDateLabel: string;
  renewalNote: string;
  helperText: string;
}

export interface MemberQrPayload {
  qrValue: string;
  status: MemberQrStatus;
  statusLabel: string;
  statusIcon: string;
  generatedAt: string;
  expirationDate: string;
}

export interface MemberQrResponse {
  profile: MemberQrProfile;
  qr: MemberQrPayload;
  summary: MemberQrSummary;
}

export interface RefreshMemberQrResponse {
  qr: MemberQrPayload;
}

export interface ShareQrPayload {
  title: string;
  text: string;
  url: string;
}
