import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'soft'
  | 'danger-outline';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit';

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './app-button.html',
  styleUrl: './app-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
  readonly fullWidth = input(false);

  readonly click = output<MouseEvent>();

  protected onClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.click.emit(event);
  }
}
