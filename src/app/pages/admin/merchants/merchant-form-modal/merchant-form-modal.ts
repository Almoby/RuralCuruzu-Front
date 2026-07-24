import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppButton,
  AppInput,
  AppModal,
  AppSelect,
  SelectOption,
} from '../../../../shared/components';
import {
  CreateMerchantRequest,
  Merchant,
  MerchantCategoryOption,
  UpdateMerchantRequest,
} from '../../../../core/interfaces/merchant.interface';
import { MerchantCategory } from '../../../../shared/enums';
import { cuitValidator } from './cuit.validator';

export type MerchantFormSave =
  | { mode: 'create'; payload: CreateMerchantRequest }
  | { mode: 'edit'; id: string; payload: UpdateMerchantRequest };

@Component({
  selector: 'app-merchant-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, AppModal, AppButton, AppInput, AppSelect],
  templateUrl: './merchant-form-modal.html',
  styleUrl: './merchant-form-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantFormModal {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly merchant = input<Merchant | null>(null);
  readonly categories = input<MerchantCategoryOption[]>([]);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<MerchantFormSave>();

  protected readonly form = this.fb.nonNullable.group({
    tradeName: ['', [Validators.required]],
    name: ['', [Validators.required]],
    cuit: ['', [Validators.required, cuitValidator]],
    category: [MerchantCategory.Farmacia as string, [Validators.required]],
    phone: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const current = this.merchant();
      if (!this.open()) {
        return;
      }

      if (current) {
        this.form.reset({
          tradeName: current.tradeName,
          name: current.name,
          cuit: current.cuit,
          category: current.category,
          phone: current.phone,
          email: current.email,
          address: current.address,
        });
      } else {
        this.form.reset({
          tradeName: '',
          name: '',
          cuit: '',
          category: MerchantCategory.Farmacia,
          phone: '',
          email: '',
          address: '',
        });
      }
    });
  }

  protected get isEdit(): boolean {
    return this.merchant() !== null;
  }

  protected get title(): string {
    return this.isEdit ? 'Editar Comercio' : 'Nuevo Comercio';
  }

  protected get submitLabel(): string {
    return this.isEdit ? 'Guardar' : 'Crear comercio';
  }

  protected get categoryOptions(): SelectOption[] {
    const options = this.categories();
    if (options.length > 0) {
      return options.map((item) => ({ value: item.value, label: item.label }));
    }
    return Object.values(MerchantCategory).map((value) => ({ value, label: value }));
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const category = value.category as MerchantCategory;

    if (this.isEdit) {
      const merchant = this.merchant();
      if (!merchant) {
        return;
      }
      this.save.emit({
        mode: 'edit',
        id: merchant.id,
        payload: {
          tradeName: value.tradeName.trim(),
          name: value.name.trim(),
          cuit: value.cuit.trim(),
          category,
          phone: value.phone.trim(),
          email: value.email.trim(),
          address: value.address.trim(),
        },
      });
      return;
    }

    this.save.emit({
      mode: 'create',
      payload: {
        tradeName: value.tradeName.trim(),
        name: value.name.trim(),
        cuit: value.cuit.trim(),
        category,
        phone: value.phone.trim(),
        email: value.email.trim(),
        address: value.address.trim(),
      },
    });
  }

  protected fieldError(controlName: keyof typeof this.form.controls): string {
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
      return 'CUIT inválido (formato 30-00000000-0)';
    }
    return 'Valor inválido';
  }
}
