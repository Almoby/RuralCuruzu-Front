import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateEs',
  standalone: true,
})
export class DateEsPipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options,
    }).format(date);
  }
}
