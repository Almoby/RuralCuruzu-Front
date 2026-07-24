import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { PersonType } from '../../../core/interfaces/member-request.interface';
import { MembershipRequestService } from '../../../core/services/membership-request.service';
import { MemberCategory } from '../../../shared/enums';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppInput } from '../../../shared/components/input/app-input';
import { AppSelect, SelectOption } from '../../../shared/components/select/app-select';

function documentNumberValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 10 ? null : { documentNumber: true };
}

function cuitValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/\s/g, '');
  const withDashes = /^\d{2}-\d{8}-\d$/.test(normalized);
  const digitsOnly = /^\d{11}$/.test(normalized.replace(/\D/g, ''));
  return withDashes || digitsOnly ? null : { cuit: true };
}

@Component({
  selector: 'app-member-request',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    AppButton,
    AppIcon,
    AppInput,
    AppSelect,
  ],
  templateUrl: './member-request.html',
  styleUrl: './member-request.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberRequest {
  private readonly fb = inject(FormBuilder);
  private readonly membershipRequestService = inject(MembershipRequestService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly MemberCategory = MemberCategory;
  protected readonly submitting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];

  protected readonly personTypeOptions: SelectOption[] = [
    { value: 'fisica', label: 'Persona Física' },
    { value: 'juridica', label: 'Persona Jurídica' },
  ];

  private readonly categoryDescriptions: Record<MemberCategory, string> = {
    [MemberCategory.Activo]:
      'Acceso completo a todos los beneficios y servicios de la cooperativa.',
    [MemberCategory.Adherente]:
      'Acceso a beneficios especiales como establecimiento adherido.',
  };

  protected readonly form = this.fb.nonNullable.group({
    membershipType: [MemberCategory.Activo as MemberCategory, Validators.required],
    fullNameOrBusinessName: ['', [Validators.required, Validators.minLength(3)]],
    postalAddress: ['', Validators.required],
    birthDate: ['', Validators.required],
    documentNumber: ['', [Validators.required, documentNumberValidator]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    personType: ['' as PersonType | '', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    cuit: ['', [Validators.required, cuitValidator]],
    establishmentName: [''],
    establishmentAddress: [''],
  });

  private readonly selectedCategory = signal<MemberCategory>(MemberCategory.Activo);

  protected readonly categoryDescription = computed(
    () => this.categoryDescriptions[this.selectedCategory()],
  );

  protected readonly establishmentRequired = computed(
    () => this.selectedCategory() === MemberCategory.Adherente,
  );

  constructor() {
    this.form.controls.membershipType.valueChanges
      .pipe(
        startWith(this.form.controls.membershipType.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((category) => {
        this.selectedCategory.set(category);
        this.syncEstablishmentValidators(category);
      });
  }

  protected selectMembershipType(category: MemberCategory): void {
    this.form.controls.membershipType.setValue(category);
    this.form.controls.membershipType.markAsTouched();
  }

  protected onMembershipKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const next =
      this.selectedCategory() === MemberCategory.Activo
        ? MemberCategory.Adherente
        : MemberCategory.Activo;
    this.selectMembershipType(next);
  }

  protected fieldError(
    controlName:
      | 'membershipType'
      | 'fullNameOrBusinessName'
      | 'postalAddress'
      | 'birthDate'
      | 'documentNumber'
      | 'phone'
      | 'personType'
      | 'email'
      | 'cuit'
      | 'establishmentName'
      | 'establishmentAddress',
  ): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control.hasError('email')) {
      return 'Ingresá un email válido';
    }
    if (control.hasError('documentNumber')) {
      return 'Ingresá un documento válido';
    }
    if (control.hasError('cuit')) {
      return 'Ingresá un CUIT válido (Ej: 20-28345678-9)';
    }
    if (control.hasError('minlength')) {
      return 'Completá este dato correctamente';
    }
    return 'Dato inválido';
  }

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);

    this.membershipRequestService
      .create({
        fullName: value.fullNameOrBusinessName.trim(),
        email: value.email.trim(),
        documentNumber: value.documentNumber.trim(),
        phone: value.phone.trim(),
        category: value.membershipType,
        address: value.postalAddress.trim(),
        birthDate: value.birthDate,
        personType: value.personType as PersonType,
        cuit: value.cuit.trim(),
        establishmentName: value.establishmentName.trim() || undefined,
        establishmentAddress: value.establishmentAddress.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.successMessage.set(
            'Tu solicitud fue enviada correctamente. Te contactaremos por email.',
          );
          this.form.reset({
            membershipType: MemberCategory.Activo,
            personType: '',
          });
          this.syncEstablishmentValidators(MemberCategory.Activo);
          window.setTimeout(() => {
            void this.router.navigate(this.loginRoute);
          }, 1800);
        },
        error: (error: { message?: string }) => {
          this.submitting.set(false);
          this.errorMessage.set(error.message ?? 'No se pudo enviar la solicitud');
        },
      });
  }

  private syncEstablishmentValidators(category: MemberCategory): void {
    const required = category === MemberCategory.Adherente;
    const nameControl = this.form.controls.establishmentName;
    const addressControl = this.form.controls.establishmentAddress;

    nameControl.setValidators(required ? [Validators.required, Validators.minLength(2)] : []);
    addressControl.setValidators(required ? [Validators.required, Validators.minLength(2)] : []);
    nameControl.updateValueAndValidity({ emitEvent: false });
    addressControl.updateValueAndValidity({ emitEvent: false });
  }
}
