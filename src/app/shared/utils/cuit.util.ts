/** Max characters of a fully formatted CUIT/CUIL (`XX-XXXXXXXX-X`). */
export const CUIT_FORMATTED_MAX_LENGTH = 13;

/**
 * Formats Argentine CUIT/CUIL as XX-XXXXXXXX-X while typing or pasting.
 * Keeps hyphens in the returned value (backend accepts this format).
 * Never keeps more than 11 digits.
 */
export function formatCuit(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/** True when value matches XX-XXXXXXXX-X with exactly 11 digits. */
export function isValidCuitFormat(value: string): boolean {
  return /^\d{2}-\d{8}-\d$/.test(value.trim());
}
