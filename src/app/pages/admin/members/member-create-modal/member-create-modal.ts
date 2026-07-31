import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppButton,
  AppInput,
  AppModal,
  AppSelect,
  SelectOption,
} from '../../../../shared/components';
import {
  AdminSocioCreateFormValue,
  AltaManualSocioRequest,
  SocioEstado,
} from '../../../../core/interfaces/admin-socio.interface';
import { mapFormToAltaManualSocioRequest } from '../../../../core/mappers/admin-socio.mapper';
import { MemberCategory } from '../../../../shared/enums';
import { TipoPersonaSolicitud } from '../../../../core/interfaces/solicitud-socio.interface';

export interface MemberCreateSave {
  payload: AltaManualSocioRequest;
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
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly submitting = input(false);

  readonly close = output<void>();
  readonly save = output<MemberCreateSave>();

  protected readonly personTypeOptions: SelectOption[] = [
    { value: 'FISICA', label: 'Persona física' },
    { value: 'JURIDICA', label: 'Persona jurídica' },
  ];

  protected readonly categoryOptions: SelectOption[] = [
    { value: MemberCategory.Activo, label: 'Socio Activo' },
    { value: MemberCategory.Adherente, label: 'Socio Adherente' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'INACTIVO', label: 'Inactivo' },
    { value: 'DADO_DE_BAJA', label: 'Dado de baja' },
  ];

  protected readonly selectedPersonType = signal<TipoPersonaSolicitud | ''>('');

  protected readonly form = this.fb.nonNullable.group({
    personType: ['' as '' | TipoPersonaSolicitud, Validators.required],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    documentNumber: [''],
    birthDate: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    address: ['', [Validators.required]],
    portalFloor: [''],
    cuit: ['', [Validators.required]],
    establishmentName: ['', [Validators.required]],
    establishmentAddress: ['', [Validators.required]],
    responsableName: [''],
    responsableDocument: [''],
    category: [MemberCategory.Activo as string, Validators.required],
    membershipStatus: ['ACTIVO' as SocioEstado, Validators.required],
  });

  protected readonly isFisica = computed(() => this.selectedPersonType() === 'FISICA');
  protected readonly isJuridica = computed(() => this.selectedPersonType() === 'JURIDICA');

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.form.reset({
        personType: '',
        fullName: '',
        documentNumber: '',
        birthDate: '',
        email: '',
        phone: '',
        address: '',
        portalFloor: '',
        cuit: '',
        establishmentName: '',
        establishmentAddress: '',
        responsableName: '',
        responsableDocument: '',
        category: MemberCategory.Activo,
        membershipStatus: 'ACTIVO',
      });
      this.selectedPersonType.set('');
    });

    this.form.controls.personType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.selectedPersonType.set(value);
        this.syncPersonTypeValidators(value);
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
    if (!value.personType) {
      return;
    }

    const formValue: AdminSocioCreateFormValue = {
      personType: value.personType,
      fullName: value.fullName,
      documentNumber: value.documentNumber,
      birthDate: value.birthDate,
      email: value.email,
      phone: value.phone,
      address: value.address,
      portalFloor: value.portalFloor,
      cuit: value.cuit,
      establishmentName: value.establishmentName,
      establishmentAddress: value.establishmentAddress,
      responsableName: value.responsableName,
      responsableDocument: value.responsableDocument,
      category: value.category as MemberCategory,
      membershipStatus: value.membershipStatus,
    };

    this.save.emit({
      payload: mapFormToAltaManualSocioRequest(formValue),
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
      return 'Texto demasiado corto';
    }
    return 'Valor inválido';
  }

  private syncPersonTypeValidators(personType: '' | TipoPersonaSolicitud): void {
    const { documentNumber, birthDate, responsableName, responsableDocument } =
      this.form.controls;

    documentNumber.clearValidators();
    birthDate.clearValidators();
    responsableName.clearValidators();
    responsableDocument.clearValidators();

    if (personType === 'FISICA') {
      documentNumber.setValidators([Validators.required]);
      birthDate.setValidators([Validators.required]);
    } else if (personType === 'JURIDICA') {
      responsableName.setValidators([Validators.required]);
      responsableDocument.setValidators([Validators.required]);
    }

    documentNumber.updateValueAndValidity({ emitEvent: false });
    birthDate.updateValueAndValidity({ emitEvent: false });
    responsableName.updateValueAndValidity({ emitEvent: false });
    responsableDocument.updateValueAndValidity({ emitEvent: false });
  }
}
