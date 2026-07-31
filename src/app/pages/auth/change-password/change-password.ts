import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { AuthService } from '../../../core/services/auth.service';
import { homeRouteForRole } from '../../../core/utils/auth-navigation.util';
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

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppAlert,
    AppButton,
    AppCard,
    AppIcon,
    AppInput,
  ],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showCurrent = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly showConfirm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly isMandatory = computed(() => this.authService.requiresPasswordChange());
  private readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];

  protected readonly form = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator('passwordNueva', 'confirmPassword') },
  );

  protected toggleCurrent(): void {
    this.showCurrent.update((value) => !value);
  }

  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  protected toggleConfirm(): void {
    this.showConfirm.update((value) => !value);
  }

  protected fieldError(
    controlName: 'passwordActual' | 'passwordNueva' | 'confirmPassword',
  ): string {
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

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const { passwordActual, passwordNueva } = this.form.getRawValue();

    this.authService
      .changePassword({ passwordActual, passwordNueva })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.successMessage.set(
            response.mensaje?.trim() || 'Tu contraseña se actualizó correctamente.',
          );

          const role = this.authService.currentRole();
          if (role) {
            void this.router.navigate(homeRouteForRole(role));
          }
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(
            isApiError(error)
              ? error.message
              : 'No pudimos cambiar la contraseña. Intentá nuevamente.',
          );
        },
      });
  }

  protected logout(): void {
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(this.loginRoute),
        error: () => void this.router.navigate(this.loginRoute),
      });
  }
}
