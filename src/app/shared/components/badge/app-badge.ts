import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'primary'
  | 'brown'
  | 'gold'
  | 'violet';

@Component({
  selector: 'app-badge',
  standalone: true,
  templateUrl: './app-badge.html',
  styleUrl: './app-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppBadge {
  readonly variant = input<BadgeVariant>('neutral');
}
