import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppAlert,
  AppButton,
  AppInput,
  AppLoading,
  AppModal,
  AppSelect,
  SelectOption,
} from '../../../../shared/components';
import {
  ActualizarSocioParcialRequestDto,
  AdminMemberDetail,
  AdminSocioEditFormValue,
  SocioCategoria,
} from '../../../../core/interfaces/admin-socio.interface';
import {
  hasActualizarSocioChanges,
  mapDetailToEditFormValue,
  mapEditFormToActualizarSocioRequest,
} from '../../../../core/mappers/admin-socio.mapper';

export interface MemberEditSave {
  id: string;
  payload: ActualizarSocioParcialRequestDto;
}

@Component({
  selector: 'app-member-edit-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppModal,
    AppButton,
    AppInput,
    AppSelect,
    AppAlert,
    AppLoading,
  ],
  templateUrl: './member-edit-modal.html',
  styleUrl: './member-edit-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberEditModal {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly member = input<AdminMemberDetail | null>(null);
  readonly loading = input(false);
  readonly submitting = input(false);
  readonly successMessage = input('');
  readonly serverFieldErrors = input<Readonly<Record<string, string>>>({});

  readonly close = output<void>();
  readonly save = output<MemberEditSave>();

  private originalForm: AdminSocioEditFormValue | null = null;

  protected readonly formError = signal('');

  protected readonly categoryOptions: SelectOption[] = [
    { value: 'ACTIVO', label: 'Socio Activo' },
    { value: 'ADHERENTE', label: 'Socio Adherente' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    categoria: ['ACTIVO' as SocioCategoria, Validators.required],
    telefono: [''],
    correoElectronico: ['', [Validators.email]],
    direccion: [''],
    portalPisoDepartamento: [''],
    nombreEstablecimiento: [''],
    direccionEstablecimiento: [''],
  });

  constructor() {
    effect(() => {
      const current = this.member();
      if (!this.open() || !current || this.loading()) {
        return;
      }

      const values = mapDetailToEditFormValue(current);
      this.originalForm = values;
      this.formError.set('');
      this.form.reset(values);
      this.form.markAsPristine();
      this.form.markAsUntouched();
    });

    effect(() => {
      if (!this.open()) {
        this.originalForm = null;
        this.formError.set('');
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
    if (this.submitting() || this.loading() || this.successMessage()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const member = this.member();
    const original = this.originalForm;
    if (!member || !original) {
      return;
    }

    const value = this.form.getRawValue();
    const formValue: AdminSocioEditFormValue = {
      categoria: value.categoria,
      telefono: value.telefono,
      correoElectronico: value.correoElectronico,
      direccion: value.direccion,
      portalPisoDepartamento: value.portalPisoDepartamento,
      nombreEstablecimiento: value.nombreEstablecimiento,
      direccionEstablecimiento: value.direccionEstablecimiento,
    };

    const payload = mapEditFormToActualizarSocioRequest(formValue, original);
    if (!hasActualizarSocioChanges(payload)) {
      this.formError.set('No hay cambios para guardar.');
      return;
    }

    this.formError.set('');
    this.save.emit({ id: member.id, payload });
  }

  protected fieldError(
    controlName: keyof typeof this.form.controls,
  ): string {
    const server = this.serverFieldErrors()[controlName];
    if (server) {
      return server;
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
    return 'Valor inválido';
  }

  protected personTypeLabel(): string {
    const member = this.member();
    if (!member) {
      return '';
    }
    return member.personType === 'JURIDICA'
      ? 'Persona jurídica'
      : 'Persona física';
  }
}
