/**
 * Helpers for sidebar / chrome identity labels.
 * Rejects technical IDs (Mongo ObjectId, UUID) so they never appear as "numeroSocio".
 */

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTechnicalId(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return false;
  }
  return OBJECT_ID_RE.test(trimmed) || UUID_RE.test(trimmed);
}

const PLACEHOLDER_CODES = new Set(['—', '–', '-', 'n/a', 'na', 'null', 'undefined']);

/** Returns a displayable business code, or null if empty/technical/placeholder. */
export function asDisplayableBusinessCode(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || isTechnicalId(trimmed) || PLACEHOLDER_CODES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

export function formatIdentityLabel(
  name: string,
  code: string | null | undefined,
): string {
  const fullName = name.trim();
  if (!fullName) {
    return '';
  }
  const displayCode = asDisplayableBusinessCode(code);
  if (!displayCode) {
    return fullName;
  }
  return `${displayCode} · ${fullName}`;
}
