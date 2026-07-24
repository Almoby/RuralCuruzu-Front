import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './app-alert.html',
  styleUrl: './app-alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppAlert {
  readonly variant = input<AlertVariant>('info');
  readonly message = input('');
  readonly dismissible = input(false);

  readonly dismissed = output<void>();

  protected readonly visible = signal(true);

  protected dismiss(): void {
    this.visible.set(false);
    this.dismissed.emit();
  }
}
