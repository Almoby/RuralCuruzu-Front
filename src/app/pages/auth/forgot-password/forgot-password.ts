import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { AuthService } from '../../../core/services/auth.service';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppCard } from '../../../shared/components/card/app-card';
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
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AppAlert, AppButton, AppCard, AppInput],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected fieldError(): string {
    const control = this.form.controls.email;
    if (!control.touched || !control.invalid) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control.hasError('email')) {
      return 'Ingresá un email válido';
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
    const email = this.form.controls.email.value.trim();

    this.authService
      .forgotPassword({ email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.successMessage.set(
            response.mensaje?.trim() ||
              'Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.',
          );
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(
            isApiError(error)
              ? error.message
              : 'No pudimos procesar la solicitud. Intentá nuevamente.',
          );
        },
      });
  }
}
