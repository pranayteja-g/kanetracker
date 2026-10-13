import { Transaction } from '../models/transaction.interface';

export const ME = 'me';

export interface Settlement { id: string; person: string; amount: number; date: string }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** My share of an equal split between me and `others` people. */
export function myShare(total: number, others: number): number {
  return r2(total / (others + 1));
}

/**
 * Balance per person. Positive = they owe me, negative = I owe them.
 * settlement.amount > 0: they paid me; < 0: I paid them.
 */
export function computeBalances(txs: Transaction[], settlements: Settlement[]): Record<string, number> {
  const b: Record<string, number> = {};
  const add = (p: string, v: number) => { b[p] = r2((b[p] || 0) + v); };
  for (const t of txs) {
    const s = t.split;
    if (t.type !== 'expense' || !s || !s.with?.length) continue;
    if (s.paidBy === ME) {
      const each = (s.total - t.amount) / s.with.length;
      for (const p of s.with) add(p, each);
    } else {
      add(s.paidBy, -t.amount);
    }
  }
  for (const st of settlements) add(st.person, -st.amount);
  for (const k of Object.keys(b)) if (Math.abs(b[k]) < 0.005) b[k] = 0;
  return b;
}

export function totals(b: Record<string, number>): { owedToMe: number; iOwe: number } {
  let owedToMe = 0, iOwe = 0;
  for (const v of Object.values(b)) v > 0 ? (owedToMe += v) : (iOwe -= v);
  return { owedToMe: r2(owedToMe), iOwe: r2(iOwe) };
}
