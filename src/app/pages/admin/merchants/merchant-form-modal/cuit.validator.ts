import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

/** Validates Argentine CUIT format: XX-XXXXXXXX-X */
export const cuitValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return /^\d{2}-\d{8}-\d$/.test(value) ? null : { cuit: true };
};
