import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';

@Component({
  selector: 'app-input',
  standalone: true,
  templateUrl: './app-input.html',
  styleUrl: './app-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppInput),
      multi: true,
    },
  ],
})
export class AppInput implements ControlValueAccessor {
  readonly label = input('');
  readonly type = input<InputType>('text');
  readonly placeholder = input('');
  readonly error = input('');
  readonly hint = input('');
  readonly disabled = input(false);
  readonly id = input(`app-input-${crypto.randomUUID()}`);

  protected readonly value = signal('');
  protected readonly cvaDisabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected get isDisabled(): boolean {
    return this.disabled() || this.cvaDisabled();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
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

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
