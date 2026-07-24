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
} from '../../../../shared/components';
import {
  Member,
  UpdateMemberRequest,
} from '../../../../core/interfaces/member.interface';

export interface MemberEditSave {
  id: string;
  payload: UpdateMemberRequest;
}

@Component({
  selector: 'app-member-edit-modal',
  standalone: true,
  imports: [ReactiveFormsModule, AppModal, AppButton, AppInput],
  templateUrl: './member-edit-modal.html',
  styleUrl: './member-edit-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberEditModal {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly member = input<Member | null>(null);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<MemberEditSave>();

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    address: ['', [Validators.required]],
    birthDate: ['', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    cuit: ['', [Validators.required]],
    establishmentName: ['', [Validators.required]],
    establishmentAddress: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const current = this.member();
      if (!this.open() || !current) {
        return;
      }

      this.form.reset({
        fullName: current.fullName,
        address: current.address ?? '',
        birthDate: current.birthDate ?? '',
        documentNumber: current.documentNumber,
        phone: current.phone,
        email: current.email,
        cuit: current.cuit ?? '',
        establishmentName: current.establishmentName ?? '',
        establishmentAddress: current.establishmentAddress ?? '',
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

    const member = this.member();
    if (!member) {
      return;
    }

    const value = this.form.getRawValue();
    const fullName = value.fullName.trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    this.save.emit({
      id: member.id,
      payload: {
        fullName,
        firstName: nameParts[0] ?? member.firstName,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : member.lastName,
        address: value.address.trim(),
        birthDate: value.birthDate,
        documentNumber: value.documentNumber.trim(),
        phone: value.phone.trim(),
        email: value.email.trim(),
        cuit: value.cuit.trim(),
        establishmentName: value.establishmentName.trim(),
        establishmentAddress: value.establishmentAddress.trim(),
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
    if (control.errors['minlength']) {
      return 'Nombre demasiado corto';
    }
    return 'Valor inválido';
  }
}
