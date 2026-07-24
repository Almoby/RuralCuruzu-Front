import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../shared/enums';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppCard } from '../../../shared/components/card/app-card';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppInput } from '../../../shared/components/input/app-input';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly registerRoute = ['/', ...APP_ROUTES.auth.register.split('/')];

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  protected fieldError(controlName: 'email' | 'password'): string {
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
    if (control.hasError('minlength')) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    return 'Dato inválido';
  }

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    const credentials = this.form.getRawValue();

    this.authService
      .login(credentials)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          void this.router.navigate(this.homeRouteForRole(response.user.role));
        },
        error: (error: { message?: string }) => {
          this.submitting.set(false);
          this.errorMessage.set(error.message ?? 'No se pudo iniciar sesión');
        },
      });
  }

  private homeRouteForRole(role: UserRole): string[] {
    if (role === UserRole.Admin) {
      return ['/', ...APP_ROUTES.admin.dashboard.split('/')];
    }
    if (role === UserRole.Socio) {
      return ['/', ...APP_ROUTES.socio.dashboard.split('/')];
    }
    return ['/', ...APP_ROUTES.comercio.home.split('/')];
  }
}
