import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppButton,
  AppInput,
  AppModal,
} from '../../../../shared/components';
import {
  AdminMerchant,
  AdminMerchantCategoryOption,
  AdminMerchantFormValue,
} from '../../../../core/interfaces/admin-comercio.interface';
import {
  CUIT_FORMATTED_MAX_LENGTH,
  formatCuit,
} from '../../../../shared/utils/cuit.util';
import { cuitValidator } from './cuit.validator';

export type MerchantFormSave =
  | { mode: 'create'; payload: AdminMerchantFormValue }
  | { mode: 'edit'; id: string; payload: AdminMerchantFormValue };

@Component({
  selector: 'app-merchant-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, AppModal, AppButton, AppInput],
  templateUrl: './merchant-form-modal.html',
  styleUrl: './merchant-form-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantFormModal {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  /** Caps the CUIT input at `XX-XXXXXXXX-X` (11 digits). */
  readonly cuitMaxLength = CUIT_FORMATTED_MAX_LENGTH;

  readonly open = input(false);
  readonly merchant = input<AdminMerchant | null>(null);
  /** Kept for parent compatibility; rubro is free text (Swagger string). */
  readonly categories = input<AdminMerchantCategoryOption[]>([]);
  readonly submitting = input(false);
  /** Server-side field errors keyed by control name (e.g. `cuit`). */
  readonly serverFieldErrors = input<Readonly<Record<string, string>>>({});

  readonly close = output<void>();
  readonly save = output<MerchantFormSave>();

  protected readonly form = this.fb.nonNullable.group({
    tradeName: ['', [Validators.required]],
    name: ['', [Validators.required]],
    cuit: ['', [Validators.required, cuitValidator]],
    category: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required]],
  });

  protected readonly isEdit = computed(() => this.merchant() !== null);

  protected readonly title = computed(() =>
    this.isEdit() ? 'Editar Comercio' : 'Nuevo Comercio',
  );

  protected readonly submitLabel = computed(() =>
    this.isEdit() ? 'Guardar' : 'Crear comercio',
  );

  constructor() {
    this.form.controls.cuit.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const formatted = formatCuit(value ?? '');
        if (formatted !== (value ?? '')) {
          this.form.controls.cuit.setValue(formatted, { emitEvent: false });
        }
      });

    effect(() => {
      const isOpen = this.open();
      const current = this.merchant();

      if (!isOpen) {
        this.resetFormState();
        return;
      }

      if (current) {
        const rawCuit = current.cuit === 'No informado' ? '' : current.cuit;
        const rubro =
          !current.category || current.category === 'No informado'
            ? ''
            : current.category;
        this.form.reset({
          tradeName: current.tradeName === 'No informado' ? '' : current.tradeName,
          name: current.name === 'No informado' ? '' : current.name,
          cuit: formatCuit(rawCuit),
          category: rubro,
          phone: current.phone === 'No informado' ? '' : current.phone,
          email: current.email === 'No informado' ? '' : current.email,
          address: current.address === 'No informado' ? '' : current.address,
        });
      } else {
        this.resetFormState();
      }
    });
  }

  protected onClose(): void {
    if (this.submitting()) {
      return;
    }
    this.close.emit();
  }

  protected onSubmit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: AdminMerchantFormValue = {
      tradeName: value.tradeName.trim(),
      name: value.name.trim(),
      cuit: formatCuit(value.cuit.trim()),
      category: value.category.trim(),
      phone: value.phone.trim(),
      email: value.email.trim(),
      address: value.address.trim(),
    };

    if (this.isEdit()) {
      const merchant = this.merchant();
      if (!merchant) {
        return;
      }
      this.save.emit({ mode: 'edit', id: merchant.id, payload });
      return;
    }

    this.save.emit({ mode: 'create', payload });
  }

  protected fieldError(controlName: keyof typeof this.form.controls): string {
    const serverError = this.serverFieldErrors()[controlName];
    if (serverError) {
      return serverError;
    }

    const control = this.form.controls[controlName];
    if (!control.touched || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'Campo obligatorio';
    }
    if (control.errors['email']) {
      return 'Email inválido';
    }
    if (control.errors['cuit']) {
      return 'El CUIT/CUIL debe tener el formato XX-XXXXXXXX-X.';
    }
    return 'Valor inválido';
  }

  private resetFormState(): void {
    this.form.reset({
      tradeName: '',
      name: '',
      cuit: '',
      category: '',
      phone: '',
      email: '',
      address: '',
    });
  }
}
