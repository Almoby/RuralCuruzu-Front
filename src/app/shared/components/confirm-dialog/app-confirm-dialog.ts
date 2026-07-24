import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected onConfirm(): void {
    this.confirm.emit();
  }

  protected onCancel(): void {
    this.cancel.emit();
  }

  protected onBackdropClick(): void {
    this.cancel.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
