import { Pipe, PipeTransform } from '@angular/core';

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return '₹' + fmt.format(v ?? 0);
  }
}
