import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { isValidCuitFormat } from '../../../../shared/utils/cuit.util';

/** Validates Argentine CUIT/CUIL format: XX-XXXXXXXX-X (11 digits). */
export const cuitValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return isValidCuitFormat(value) ? null : { cuit: true };
};
