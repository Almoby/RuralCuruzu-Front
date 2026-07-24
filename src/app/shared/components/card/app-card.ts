import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './app-card.html',
  styleUrl: './app-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCard {
  readonly title = input('');
}
