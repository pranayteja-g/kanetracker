import { Transaction } from '../models/transaction.interface';

export interface Transfer { id: string; from: string; to: string; amount: number; date: string; note?: string }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Money in/out per account from entries and transfers (opening balances not included). */
export function accountFlows(txs: Transaction[], transfers: Transfer[]): Record<string, number> {
  const f: Record<string, number> = {};
  const add = (a: string, v: number) => { f[a] = r2((f[a] || 0) + v); };
  for (const t of txs) {
    if (!t.account) continue;
    if (t.type === 'income') { add(t.account, t.amount); continue; }
    const s = t.split;
    // shared bill: if a friend paid, nothing left my account; if I paid, the whole bill did
    if (s?.with?.length) { if (s.paidBy === 'me') add(t.account, -s.total); continue; }
    add(t.account, -t.amount);
  }
  for (const x of transfers) { add(x.from, -x.amount); add(x.to, x.amount); }
  return f;
}

export function balances(names: string[], opening: Record<string, number>, flows: Record<string, number>): Record<string, number> {
  const b: Record<string, number> = {};
  for (const n of names) b[n] = r2((opening[n] || 0) + (flows[n] || 0));
  return b;
}
