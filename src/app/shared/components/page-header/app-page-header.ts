import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './app-page-header.html',
  styleUrl: './app-page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
