import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from '@angular/core';
import { AppButton } from '../button/app-button';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [AppButton],
  templateUrl: './app-confirm-dialog.html',
  styleUrl: './app-confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppConfirmDialog {
  readonly open = input(false);
  readonly title = input('Confirmar acción');
  readonly message = input('');
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');
  readonly danger = input(false);
  /** When true: disable actions, show spinner, block backdrop / Escape / cancel. */
  readonly busy = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') {
          return;
        }
        // Block Escape while processing so this dialog (and any modal underneath) stay open.
        if (this.busy()) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      document.addEventListener('keydown', onKeyDown, true);
      onCleanup(() => document.removeEventListener('keydown', onKeyDown, true));
    });
  }

  protected onConfirm(): void {
    if (this.busy()) {
      return;
    }
    this.confirm.emit();
  }

  protected onCancel(): void {
    if (this.busy()) {
      return;
    }
    this.cancel.emit();
  }

  protected onBackdropClick(): void {
    if (this.busy()) {
      return;
    }
    this.cancel.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
