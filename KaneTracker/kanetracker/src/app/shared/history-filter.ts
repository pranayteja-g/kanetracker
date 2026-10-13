import { Transaction } from '../models/transaction.interface';
import { toInput } from './utils';

export interface HFilter { cat: string; acc: string; tag: string; trip: number; min: number | null; max: number | null; from: string; to: string }
export const EMPTY_FILTER = (): HFilter => ({ cat: '', acc: '', tag: '', trip: 0, min: null, max: null, from: '', to: '' });

/** Pure: does a transaction pass the advanced filter? */
export function passes(t: Transaction, f: HFilter): boolean {
  if (f.cat && t.category !== f.cat) return false;
  if (f.acc && (t.account || '') !== f.acc) return false;
  if (f.tag && !(t.tags || []).includes(f.tag)) return false;
  if (f.trip && t.tripId !== f.trip) return false;
  if (f.min != null && Number(f.min) > 0 && t.amount < Number(f.min)) return false;
  if (f.max != null && Number(f.max) > 0 && t.amount > Number(f.max)) return false;
  if (f.from || f.to) {
    const d = toInput(new Date(t.date));
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
  }
  return true;
}


