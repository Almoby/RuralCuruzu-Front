import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './app-empty-state.html',
  styleUrl: './app-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppEmptyState {
  readonly title = input('Sin resultados');
  readonly description = input('');
  readonly icon = input('');
}
