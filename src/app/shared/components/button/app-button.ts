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
    // Stop native bubbling: an output named `click` + bubbled DOM click on the host
    // would invoke parent `(click)` handlers twice per physical click.
    event.stopPropagation();

    if (this.disabled()) {
      event.preventDefault();
      return;
    }

    this.click.emit(event);
  }
}
