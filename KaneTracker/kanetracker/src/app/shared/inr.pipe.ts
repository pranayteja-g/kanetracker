import { Pipe, PipeTransform } from '@angular/core';
import { fmtMoney } from './currency';

/** Formats an amount in the user's base currency. (Name kept as `inr` for existing templates.) */
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return fmtMoney(v);
  }
}
