import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  templateUrl: './app-loading.html',
  styleUrl: './app-loading.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoading {
  readonly fullscreen = input(false);
  readonly message = input('Cargando...');
}
