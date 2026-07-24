import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  contentChild,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
}

export type TableRow = Record<string, unknown>;

@Directive({
  selector: 'ng-template[appTableActions]',
  standalone: true,
})
export class AppTableActionsDirective {
  constructor(public readonly template: TemplateRef<{ $implicit: TableRow; index: number }>) {}
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './app-table.html',
  styleUrl: './app-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTable {
  readonly columns = input<TableColumn[]>([]);
  readonly rows = input<TableRow[]>([]);
  readonly emptyMessage = input('No hay datos para mostrar');
  readonly trackByKey = input('id');

  protected readonly actionsTemplate = contentChild(AppTableActionsDirective);

  protected cellValue(row: TableRow, key: string): string {
    const value = row[key];

    if (value === null || value === undefined) {
      return '—';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '—';
  }

  protected trackRow(row: TableRow, index: number): string | number {
    const key = this.trackByKey();
    const value = row[key];

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    return index;
  }
}
