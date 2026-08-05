import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { AuthService } from '../../../core/services/auth.service';
import { passwordsMatchValidator } from '../../../core/utils/password.validators';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppCard } from '../../../shared/components/card/app-card';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppInput } from '../../../shared/components/input/app-input';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

function isInvalidOrExpiredTokenError(error: ApiError): boolean {
  if (error.status === 404 || error.status === 410) {
    return true;
  }
  if (error.status !== 400) {
    return false;
  }
  return /token|enlace|inv[aá]lido|expir|venci|usado/i.test(error.message);
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    AppButton,
    AppCard,
    AppIcon,
    AppInput,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly showConfirm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly invalidLink = signal(false);
  protected readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];
  protected readonly forgotRoute = ['/', ...APP_ROUTES.auth.forgotPassword.split('/')];

  /** Query token kept only in memory for the request body — never persisted. */
  private token = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();

  protected readonly form = this.fb.nonNullable.group(
    {
      nuevaPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator('nuevaPassword', 'confirmPassword') },
  );

  constructor() {
    if (!this.token) {
      this.invalidLink.set(true);
      this.errorMessage.set('El enlace para restablecer la contraseña no es válido.');
    }
  }

  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  protected toggleConfirm(): void {
    this.showConfirm.update((value) => !value);
  }

  protected fieldError(controlName: 'nuevaPassword' | 'confirmPassword'): string {
    const control = this.form.controls[controlName];
    if (!control.touched || (!control.invalid && !this.form.hasError('passwordsMismatch'))) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control.hasError('minlength')) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (
      controlName === 'confirmPassword' &&
      this.form.hasError('passwordsMismatch') &&
      control.touched
    ) {
      return 'Las contraseñas no coinciden';
    }
    return 'Dato inválido';
  }

  protected goToLogin(): void {
    void this.router.navigate(this.loginRoute);
  }

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.invalidLink() || !this.token || this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const nuevaPassword = this.form.controls.nuevaPassword.value;

    this.authService
      .resetPassword({ token: this.token, nuevaPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.form.reset({
            nuevaPassword: '',
            confirmPassword: '',
          });
          this.token = '';
          // Drop token from the URL without storing it anywhere.
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
          this.successMessage.set(
            response.mensaje?.trim() || 'Tu contraseña fue actualizada correctamente.',
          );
        },
        error: (error: unknown) => {
          this.submitting.set(false);

          if (isApiError(error) && isInvalidOrExpiredTokenError(error)) {
            this.invalidLink.set(true);
            this.errorMessage.set(
              'El enlace es inválido o ya venció. Solicitá uno nuevo.',
            );
            return;
          }

          this.errorMessage.set(
            isApiError(error)
              ? error.message
              : 'No pudimos restablecer la contraseña. Intentá nuevamente.',
          );
        },
      });
  }
}
