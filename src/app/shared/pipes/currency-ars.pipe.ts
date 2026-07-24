import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyArs',
  standalone: true,
})
export class CurrencyArsPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }

    return this.formatter.format(value);
  }
}
