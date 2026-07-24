import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from '@angular/core';

export type ModalSize = 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './app-modal.html',
  styleUrl: './app-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppModal {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly size = input<ModalSize>('md');
  readonly closeOnBackdrop = input(true);

  readonly close = output<void>();

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          this.close.emit();
        }
      };

      document.addEventListener('keydown', onKeyDown);

      onCleanup(() => {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener('keydown', onKeyDown);
      });
    });
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.close.emit();
    }
  }

  protected onCloseClick(): void {
    this.close.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
