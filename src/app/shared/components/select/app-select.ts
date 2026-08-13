import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './app-select.html',
  styleUrl: './app-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppSelect),
      multi: true,
    },
  ],
})
export class AppSelect implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input('');
  readonly placeholder = input('Seleccionar...');
  readonly options = input<SelectOption[]>([]);
  readonly error = input('');
  readonly hint = input('');
  readonly disabled = input(false);
  readonly id = input(`app-select-${crypto.randomUUID()}`);

  protected readonly value = signal('');
  protected readonly cvaDisabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // When options recreate, native <select> can keep a stale selectedIndex and
    // drift one option ahead of the CVA value. Re-apply the model value to the DOM.
    effect(() => {
      const current = this.value();
      this.options();
      queueMicrotask(() => this.syncNativeSelectValue(current));
    });
  }

  protected get isDisabled(): boolean {
    return this.disabled() || this.cvaDisabled();
  }

  writeValue(value: string | null): void {
    const next = value ?? '';
    this.value.set(next);
    queueMicrotask(() => this.syncNativeSelectValue(next));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  protected onSelect(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  private syncNativeSelectValue(current: string): void {
    const select = this.host.nativeElement.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    if (select.value !== current) {
      select.value = current;
    }
  }
}
