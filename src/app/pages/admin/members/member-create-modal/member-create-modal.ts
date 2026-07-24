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
import { CreateMemberRequest } from '../../../../core/interfaces/member.interface';
import { MemberPlan } from '../../../../shared/enums';

export interface MemberCreateSave {
  payload: CreateMemberRequest;
}

@Component({
  selector: 'app-member-create-modal',
  standalone: true,
  imports: [ReactiveFormsModule, AppModal, AppButton, AppInput, AppSelect],
  templateUrl: './member-create-modal.html',
  styleUrl: './member-create-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberCreateModal {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<MemberCreateSave>();

  protected readonly categoryOptions: SelectOption[] = [
    { value: MemberPlan.Oro, label: 'Oro' },
    { value: MemberPlan.Plata, label: 'Plata' },
    { value: MemberPlan.Premium, label: 'Premium' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'true', label: 'Activo' },
    { value: 'false', label: 'Inactivo' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    birthDate: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    address: ['', [Validators.required]],
    category: [MemberPlan.Oro as string, [Validators.required]],
    isActive: ['true', [Validators.required]],
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.form.reset({
        firstName: '',
        lastName: '',
        documentNumber: '',
        birthDate: '',
        email: '',
        phone: '',
        address: '',
        category: MemberPlan.Oro,
        isActive: 'true',
      });
    });
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
    this.save.emit({
      payload: {
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: value.email.trim(),
        documentNumber: value.documentNumber.trim(),
        phone: value.phone.trim(),
        category: value.category as MemberPlan,
        address: value.address.trim(),
        birthDate: value.birthDate,
        isActive: value.isActive === 'true',
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
    return 'Valor inválido';
  }
}
