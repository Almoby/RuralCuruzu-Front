import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppIcon } from '../icon/app-icon';

export type StatTrend = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './app-stat-card.html',
  styleUrl: './app-stat-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppStatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input('');
  /** Asset icon name from `assets/icons` (e.g. people, payments). */
  readonly icon = input('');
  readonly trend = input<StatTrend | ''>('');
}
