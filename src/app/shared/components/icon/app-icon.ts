import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './app-icon.html',
  styleUrl: './app-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.mask-image]': 'maskImage()',
    '[style.-webkit-mask-image]': 'maskImage()',
    '[attr.aria-hidden]': 'true',
  },
})
export class AppIcon {
  readonly name = input.required<string>();
  readonly size = input(20);

  protected readonly maskImage = computed(
    () => `url('assets/icons/${this.name()}.svg')`,
  );
}
