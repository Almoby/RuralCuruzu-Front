import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RadioOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-radio-group',
  standalone: true,
  templateUrl: './app-radio-group.html',
  styleUrl: './app-radio-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppRadioGroup),
      multi: true,
    },
  ],
})
export class AppRadioGroup implements ControlValueAccessor {
  readonly label = input('');
  readonly options = input<RadioOption[]>([]);
  readonly disabled = input(false);
  readonly name = input(`app-radio-${crypto.randomUUID()}`);
  readonly error = input('');

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

  protected onSelect(value: string): void {
    if (this.isDisabled) {
      return;
    }

    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
