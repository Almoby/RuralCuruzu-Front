import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
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
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { SolicitudSocioFormValue } from '../../../core/interfaces/solicitud-socio.interface';
import {
  mapBackendFieldToFormControl,
  mapFormToSolicitudSocioRequest,
} from '../../../core/mappers/solicitud-socio.mapper';
import { MembershipRequestService } from '../../../core/services/membership-request.service';
import { MemberCategory } from '../../../shared/enums';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppCheckbox } from '../../../shared/components/checkbox/app-checkbox';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppInput } from '../../../shared/components/input/app-input';
import { AppSelect, SelectOption } from '../../../shared/components/select/app-select';

function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return value.length > 0 ? null : { required: true };
}

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

function termsAcceptedValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === true ? null : { required: true };
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

type FormControlName =
  | 'membershipType'
  | 'fullNameOrBusinessName'
  | 'postalAddress'
  | 'portalPisoDepartamento'
  | 'birthDate'
  | 'documentNumber'
  | 'phone'
  | 'personType'
  | 'email'
  | 'cuit'
  | 'establishmentName'
  | 'establishmentAddress'
  | 'responsableName'
  | 'responsableDocument'
  | 'acceptTerms';

@Component({
  selector: 'app-member-request',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    AppButton,
    AppCheckbox,
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
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('successHeading')
  private readonly successHeading?: ElementRef<HTMLHeadingElement>;

  protected readonly MemberCategory = MemberCategory;
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly successMessage = signal('');
  protected readonly successRequestNumber = signal('');
  protected readonly errorMessage = signal('');
  protected readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];

  protected readonly personTypeOptions: SelectOption[] = [
    { value: 'FISICA', label: 'Persona Física' },
    { value: 'JURIDICA', label: 'Persona Jurídica' },
  ];

  private readonly categoryDescriptions: Record<MemberCategory, string> = {
    [MemberCategory.Activo]:
      'Acceso completo a todos los beneficios y servicios de la cooperativa.',
    [MemberCategory.Adherente]:
      'Acceso a beneficios especiales como establecimiento adherido.',
  };

  protected readonly form = this.fb.nonNullable.group({
    membershipType: [MemberCategory.Activo as MemberCategory, Validators.required],
    fullNameOrBusinessName: ['', [Validators.required, requiredTrimmed, Validators.minLength(3)]],
    postalAddress: ['', [Validators.required, requiredTrimmed]],
    portalPisoDepartamento: [''],
    birthDate: [''],
    documentNumber: [''],
    phone: ['', [Validators.required, requiredTrimmed, Validators.minLength(8)]],
    personType: ['' as '' | 'FISICA' | 'JURIDICA', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    cuit: ['', [Validators.required, cuitValidator]],
    establishmentName: ['', [Validators.required, requiredTrimmed, Validators.minLength(2)]],
    establishmentAddress: ['', [Validators.required, requiredTrimmed, Validators.minLength(2)]],
    responsableName: [''],
    responsableDocument: [''],
    acceptTerms: [false, [termsAcceptedValidator]],
  });

  private readonly selectedCategory = signal<MemberCategory>(MemberCategory.Activo);
  private readonly selectedPersonType = signal<'' | 'FISICA' | 'JURIDICA'>('');

  protected readonly categoryDescription = computed(
    () => this.categoryDescriptions[this.selectedCategory()],
  );

  protected readonly isPersonaFisica = computed(() => this.selectedPersonType() === 'FISICA');
  protected readonly isPersonaJuridica = computed(() => this.selectedPersonType() === 'JURIDICA');

  protected readonly nameLabel = computed(() =>
    this.isPersonaJuridica() ? 'Razón Social *' : 'Apellido y Nombre *',
  );

  protected readonly namePlaceholder = computed(() =>
    this.isPersonaJuridica() ? 'Ej: Agropecuaria Del Sol S.A.' : 'Ej: García, Juan Carlos',
  );

  constructor() {
    this.form.controls.membershipType.valueChanges
      .pipe(
        startWith(this.form.controls.membershipType.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((category) => this.selectedCategory.set(category));

    this.form.controls.personType.valueChanges
      .pipe(startWith(this.form.controls.personType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((personType) => {
        this.selectedPersonType.set(personType);
        this.syncPersonTypeValidators(personType);
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

  protected fieldError(controlName: FormControlName): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (control.hasError('required')) {
      if (controlName === 'acceptTerms') {
        return 'Debés aceptar los términos y condiciones.';
      }
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
    if (control.hasError('backend')) {
      return String(control.getError('backend'));
    }
    return 'Dato inválido';
  }

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.clearBackendFieldErrors();
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting() || this.submitted()) {
      this.focusFirstInvalid();
      return;
    }

    const formValue = this.form.getRawValue() as SolicitudSocioFormValue;
    const payload = mapFormToSolicitudSocioRequest(formValue);

    this.submitting.set(true);

    this.membershipRequestService
      .createPublic(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.successMessage.set(
            response.mensaje?.trim() || 'Solicitud de socio enviada con éxito',
          );
          this.successRequestNumber.set(response.solicitud?.numeroSolicitud?.trim() || '');
          queueMicrotask(() => this.successHeading?.nativeElement.focus());
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.applyBackendErrors(error);
        },
      });
  }

  private syncPersonTypeValidators(personType: '' | 'FISICA' | 'JURIDICA'): void {
    const birthDate = this.form.controls.birthDate;
    const documentNumber = this.form.controls.documentNumber;
    const responsableName = this.form.controls.responsableName;
    const responsableDocument = this.form.controls.responsableDocument;

    if (personType === 'FISICA') {
      birthDate.setValidators([Validators.required]);
      documentNumber.setValidators([Validators.required, documentNumberValidator]);
      responsableName.clearValidators();
      responsableDocument.clearValidators();
      responsableName.setValue('');
      responsableDocument.setValue('');
    } else if (personType === 'JURIDICA') {
      birthDate.clearValidators();
      documentNumber.clearValidators();
      birthDate.setValue('');
      documentNumber.setValue('');
      responsableName.setValidators([Validators.required, requiredTrimmed, Validators.minLength(3)]);
      responsableDocument.setValidators([Validators.required, documentNumberValidator]);
    } else {
      birthDate.clearValidators();
      documentNumber.clearValidators();
      responsableName.clearValidators();
      responsableDocument.clearValidators();
    }

    birthDate.updateValueAndValidity({ emitEvent: false });
    documentNumber.updateValueAndValidity({ emitEvent: false });
    responsableName.updateValueAndValidity({ emitEvent: false });
    responsableDocument.updateValueAndValidity({ emitEvent: false });
  }

  private applyBackendErrors(error: unknown): void {
    if (!isApiError(error)) {
      this.errorMessage.set('No se pudo enviar la solicitud. Intentá nuevamente.');
      return;
    }

    let mappedAny = false;

    for (const item of error.fieldErrors ?? []) {
      const controlName = mapBackendFieldToFormControl(item.field) as FormControlName | null;
      if (controlName && controlName in this.form.controls) {
        const control = this.form.controls[controlName];
        control.setErrors({ ...(control.errors ?? {}), backend: item.message });
        control.markAsTouched();
        mappedAny = true;
      }
    }

    this.errorMessage.set(error.message || 'No se pudo enviar la solicitud.');
    if (!mappedAny) {
      this.focusFirstInvalid();
    }
  }

  private clearBackendFieldErrors(): void {
    (Object.keys(this.form.controls) as FormControlName[]).forEach((key) => {
      const control = this.form.controls[key];
      if (control.hasError('backend')) {
        const { backend: _removed, ...rest } = control.errors ?? {};
        control.setErrors(Object.keys(rest).length > 0 ? rest : null);
      }
    });
  }

  private focusFirstInvalid(): void {
    const order: FormControlName[] = [
      'membershipType',
      'personType',
      'fullNameOrBusinessName',
      'postalAddress',
      'portalPisoDepartamento',
      'birthDate',
      'documentNumber',
      'phone',
      'email',
      'cuit',
      'establishmentName',
      'establishmentAddress',
      'responsableName',
      'responsableDocument',
      'acceptTerms',
    ];

    for (const name of order) {
      const control = this.form.controls[name];
      if (control.invalid) {
        const el = document.querySelector<HTMLElement>(
          `[formcontrolname="${name}"], #${CSS.escape(name)}`,
        );
        el?.focus();
        break;
      }
    }
  }
}
