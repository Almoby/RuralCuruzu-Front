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
import {
  AuthService,
  SESSION_EXPIRED_LOGIN_REASON,
} from '../../../core/services/auth.service';
import {
  homeRouteForRole,
  isSafeInternalReturnUrl,
} from '../../../core/utils/auth-navigation.util';
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

function readSessionExpiredFlag(router: Router, route: ActivatedRoute): boolean {
  const navState = router.getCurrentNavigation()?.extras.state as
    | { sessionExpired?: boolean }
    | undefined;
  if (navState?.sessionExpired === true) {
    return true;
  }

  const historyState = window.history.state as { sessionExpired?: boolean } | null;
  if (historyState?.sessionExpired === true) {
    return true;
  }

  return route.snapshot.queryParamMap.get('reason') === SESSION_EXPIRED_LOGIN_REASON;
}

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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly sessionExpiredMessage = signal('');
  /** True while redirecting `/auth/login?token=` → restablecer-password. */
  protected readonly redirectingToReset = signal(false);
  protected readonly registerRoute = ['/', ...APP_ROUTES.auth.register.split('/')];
  protected readonly forgotPasswordRoute = [
    '/',
    ...APP_ROUTES.auth.forgotPassword.split('/'),
  ];

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(1)]],
  });

  constructor() {
    const recoveryToken = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();
    if (recoveryToken.length > 0) {
      // Backend emails currently link to Login; forward to the real reset screen.
      this.redirectingToReset.set(true);
      void this.router.navigate(['/', ...APP_ROUTES.auth.resetPassword.split('/')], {
        queryParams: { token: recoveryToken },
        replaceUrl: true,
      });
      return;
    }

    if (readSessionExpiredFlag(this.router, this.route)) {
      this.sessionExpiredMessage.set('Tu sesión expiró. Iniciá sesión nuevamente.');
      // Drop reason from the URL so a normal refresh of Login does not keep the banner.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { reason: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

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
    return 'Dato inválido';
  }

  protected onSubmit(): void {
    this.errorMessage.set('');
    this.sessionExpiredMessage.set('');
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
        next: (session) => {
          this.submitting.set(false);

          if (session.requiresPasswordChange) {
            void this.router.navigate(['/', ...APP_ROUTES.auth.changePassword.split('/')]);
            return;
          }

          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          if (returnUrl && isSafeInternalReturnUrl(returnUrl, session.role)) {
            void this.router.navigateByUrl(returnUrl);
            return;
          }

          void this.router.navigate(homeRouteForRole(session.role));
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(
            isApiError(error) ? error.message : 'No se pudo iniciar sesión',
          );
        },
      });
  }
}
