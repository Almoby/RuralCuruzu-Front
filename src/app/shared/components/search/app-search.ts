import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

@Component({
  selector: 'app-search',
  standalone: true,
  templateUrl: './app-search.html',
  styleUrl: './app-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSearch {
  readonly placeholder = input('Buscar...');
  readonly disabled = input(false);
  readonly searchTerm = model('');

  readonly valueChange = output<string>();

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.searchTerm.set(next);
    this.valueChange.emit(next);
  }

  protected clear(): void {
    this.searchTerm.set('');
    this.valueChange.emit('');
  }
}
