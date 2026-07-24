import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AppIcon } from '../../shared/components/icon/app-icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);

  readonly title = input('Portal SRCC');
  readonly showBell = input(true);
  readonly menuToggle = output<void>();

  protected readonly user = this.authService.currentUser;

  protected readonly userInitial = computed(() => {
    const fullName = this.user()?.fullName?.trim();
    if (fullName) {
      const firstChar = fullName.charAt(0);
      return firstChar.toLocaleUpperCase('es-AR');
    }

    const email = this.user()?.email?.trim();
    if (email) {
      return email.charAt(0).toLocaleUpperCase('es-AR');
    }

    return '?';
  });

  protected readonly currentDateLabel = computed(() => {
    const formatter = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatter.format(new Date());
  });

  protected onMenuClick(): void {
    this.menuToggle.emit();
  }
}
